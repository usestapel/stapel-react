import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createAnalytics } from "../src/analytics/createAnalytics.js";
import {
  consoleProvider,
  stapelCollectorProvider,
} from "../src/analytics/providers.js";
import { memoryStorage } from "../src/storage.js";
import type { StapelClient } from "../src/client.js";
import type { AnalyticsEvent } from "../src/analytics/types.js";

const BASE = "https://collector.stapel.test";
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => {
  server.close();
});

function fakeEvent(name: string): AnalyticsEvent {
  return { id: name, kind: "track", name, props: {}, ts: 1 };
}

describe("stapelCollectorProvider", () => {
  it("POSTs one {events: [...]} batch with the write key via the facade", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${BASE}/analytics/api/events`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ accepted: 2 });
      })
    );
    const analytics = createAnalytics({
      providers: {
        stapel: stapelCollectorProvider({ baseUrl: BASE, writeKey: "wk-1" }),
      },
      consent: "granted",
      storage: memoryStorage(),
    });
    analytics.track("cart.viewed", { items: 3 });
    analytics.track("cart.checkout");
    await analytics.flush();

    expect(bodies).toHaveLength(1);
    const body = bodies[0] as {
      events: { name: string; props: Record<string, unknown> }[];
      write_key: string;
    };
    expect(body.write_key).toBe("wk-1");
    expect(body.events.map((e) => e.name)).toEqual([
      "cart.viewed",
      "cart.checkout",
    ]);
    expect(body.events[0]?.props).toEqual({ items: 3 });
  });

  it("throws on a non-2xx response so the facade retries the batch", async () => {
    let attempts = 0;
    server.use(
      http.post(`${BASE}/analytics/api/events`, () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json({ error: "boom" }, { status: 500 });
        }
        return HttpResponse.json({ accepted: 1 });
      })
    );
    const analytics = createAnalytics({
      providers: { stapel: stapelCollectorProvider({ baseUrl: BASE }) },
      consent: "granted",
      storage: memoryStorage(),
      batch: { backoffBaseMs: 1 },
    });
    analytics.track("retry.me");
    await analytics.flush(); // 500 → provider throws → batch stays
    await analytics.flush(); // re-delivered
    expect(attempts).toBe(2);
  });

  it("uses navigator.sendBeacon for the final flush when the page is hidden", async () => {
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });
    const visibilityState = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");

    const provider = stapelCollectorProvider({ baseUrl: BASE, writeKey: "wk" });
    await provider.track(fakeEvent("teardown.event"));
    await provider.flush?.();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe(`${BASE}/analytics/api/events`);
    // jsdom's Blob has no .text(); go through FileReader.
    const blobText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(String(reader.result));
      };
      reader.onerror = () => {
        reject(new Error("FileReader failed"));
      };
      reader.readAsText(blob);
    });
    const payload = JSON.parse(blobText) as {
      events: { name: string }[];
      write_key: string;
    };
    expect(payload.events.map((e) => e.name)).toEqual(["teardown.event"]);
    expect(payload.write_key).toBe("wk");

    visibilityState.mockRestore();
    delete (navigator as { sendBeacon?: unknown }).sendBeacon;
  });

  it("delivers through an injected StapelClient", async () => {
    const post = vi.fn(() => Promise.resolve({ accepted: 1 }));
    const provider = stapelCollectorProvider({
      client: {
        baseUrl: BASE,
        post,
      } as unknown as StapelClient,
    });
    await provider.track(fakeEvent("via.client"));
    await provider.flush?.();
    expect(post).toHaveBeenCalledWith(
      "/analytics/api/events",
      expect.objectContaining({
        events: [expect.objectContaining({ name: "via.client" })],
      })
    );
  });

  it("requires a baseUrl or client", () => {
    expect(() => stapelCollectorProvider({})).toThrowError(/baseUrl/);
  });
});

describe("consoleProvider", () => {
  it("logs events and never throws, even with a broken console", async () => {
    const debugSpy = vi
      .spyOn(console, "debug")
      .mockImplementation(() => undefined);
    const provider = consoleProvider();
    await provider.track(fakeEvent("dev.event"));
    await provider.identify?.("abc123", { plan: "pro" });
    await provider.page?.("home");
    expect(debugSpy).toHaveBeenCalledTimes(3);

    debugSpy.mockImplementation(() => {
      throw new Error("console exploded");
    });
    expect(() => provider.track(fakeEvent("still.fine"))).not.toThrow();
  });
});
