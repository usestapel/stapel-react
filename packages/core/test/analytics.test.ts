import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backoffDelay, createAnalytics } from "../src/analytics/createAnalytics.js";
import { trackFlowStep } from "../src/analytics/flow.js";
import { memoryStorage } from "../src/storage.js";
import type { AnalyticsEvent, AnalyticsProvider } from "../src/analytics/types.js";

interface SpyProvider extends AnalyticsProvider {
  tracked: AnalyticsEvent[];
  identified: { userHash: string; traits?: Record<string, unknown> }[];
  paged: { name: string; props?: Record<string, unknown> }[];
}

function spyProvider(): SpyProvider {
  const provider: SpyProvider = {
    tracked: [],
    identified: [],
    paged: [],
    track: (event) => {
      provider.tracked.push(event);
    },
    identify: (userHash, traits) => {
      provider.identified.push(
        traits === undefined ? { userHash } : { userHash, traits }
      );
    },
    page: (name, props) => {
      provider.paged.push(props === undefined ? { name } : { name, props });
    },
  };
  return provider;
}

async function sha256HexRef(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
  vi.useRealTimers();
});

describe("fan-out", () => {
  it("delivers every event to all registered providers", async () => {
    const a = spyProvider();
    const b = spyProvider();
    const analytics = createAnalytics({
      providers: { a, b },
      consent: "granted",
      storage: memoryStorage(),
    });
    analytics.track("cart.viewed", { items: 3 });
    analytics.track("cart.checkout", { total: 42 });
    await analytics.flush();

    for (const provider of [a, b]) {
      expect(provider.tracked.map((e) => e.name)).toEqual([
        "cart.viewed",
        "cart.checkout",
      ]);
      expect(provider.tracked[0]?.props).toEqual({ items: 3 });
      expect(provider.tracked[0]?.kind).toBe("track");
      expect(provider.tracked[0]?.ts).toBeTypeOf("number");
    }
  });

  it("page uses provider.page when present and falls back to track otherwise", async () => {
    const withPage = spyProvider();
    const trackOnly: AnalyticsProvider & { tracked: AnalyticsEvent[] } = {
      tracked: [],
      track: (event) => {
        trackOnly.tracked.push(event);
      },
    };
    const analytics = createAnalytics({
      providers: { withPage, trackOnly },
      consent: "granted",
      storage: memoryStorage(),
    });
    analytics.page("pricing", { plan: "pro" });
    await analytics.flush();

    expect(withPage.paged).toEqual([
      { name: "pricing", props: { plan: "pro" } },
    ]);
    expect(withPage.tracked).toEqual([]);
    expect(trackOnly.tracked[0]?.kind).toBe("page");
    expect(trackOnly.tracked[0]?.name).toBe("pricing");
  });

  it("register/unregister change the fan-out at runtime", async () => {
    const a = spyProvider();
    const b = spyProvider();
    const analytics = createAnalytics({
      providers: { a },
      consent: "granted",
      storage: memoryStorage(),
    });
    analytics.register("b", b);
    analytics.track("first");
    await analytics.flush();
    analytics.unregister("b");
    analytics.track("second");
    await analytics.flush();

    expect(a.tracked.map((e) => e.name)).toEqual(["first", "second"]);
    expect(b.tracked.map((e) => e.name)).toEqual(["first"]);
  });
});

describe("consent gate", () => {
  it("buffers while pending and flushes on granted", async () => {
    const provider = spyProvider();
    const analytics = createAnalytics({
      providers: { provider },
      storage: memoryStorage(),
    });
    analytics.track("signup.started");
    await analytics.flush();
    expect(provider.tracked).toEqual([]);
    expect(analytics.getConsent()).toBe("pending");

    await analytics.setConsent("granted");
    expect(provider.tracked.map((e) => e.name)).toEqual(["signup.started"]);
  });

  it("drops the buffer on denied and turns later calls into no-ops", async () => {
    const provider = spyProvider();
    const storage = memoryStorage();
    const analytics = createAnalytics({ providers: { provider }, storage });
    analytics.track("signup.started");
    await analytics.flush();
    await analytics.setConsent("denied");
    analytics.track("signup.completed");
    await analytics.flush();

    expect(provider.tracked).toEqual([]);
    expect(await storage.get("stapel-analytics:events")).toBeUndefined();
  });

  it("persists consent across recreation", async () => {
    const storage = memoryStorage();
    const first = createAnalytics({ storage });
    await first.setConsent("granted");

    const second = createAnalytics({ storage });
    await second.flush(); // waits for async restore
    expect(second.getConsent()).toBe("granted");
  });

  it("restores a pending buffer persisted by a previous instance", async () => {
    const storage = memoryStorage();
    const first = createAnalytics({ storage });
    first.track("onboarding.step", { n: 1 });
    await first.flush(); // persists the buffer (no delivery: pending)

    const provider = spyProvider();
    const second = createAnalytics({ providers: { provider }, storage });
    await second.setConsent("granted");
    expect(provider.tracked.map((e) => e.name)).toEqual(["onboarding.step"]);
    expect(provider.tracked[0]?.props).toEqual({ n: 1 });
  });
});

describe("offline queue", () => {
  it("survives instance recreation: track offline, recreate, flush delivers", async () => {
    const storage = memoryStorage();
    // "Offline": no providers registered yet, nothing can be delivered.
    const offline = createAnalytics({ consent: "granted", storage });
    offline.track("order.created", { id: "o1" });
    offline.track("order.paid", { id: "o1" });
    await offline.flush();

    const provider = spyProvider();
    const online = createAnalytics({
      providers: { provider },
      consent: "granted",
      storage,
    });
    await online.flush();
    expect(provider.tracked.map((e) => e.name)).toEqual([
      "order.created",
      "order.paid",
    ]);
  });

  it("flushes automatically when the queue reaches batch.maxSize", async () => {
    const provider = spyProvider();
    const analytics = createAnalytics({
      providers: { provider },
      consent: "granted",
      storage: memoryStorage(),
      batch: { maxSize: 3 },
    });
    analytics.track("e1");
    analytics.track("e2");
    expect(provider.tracked).toEqual([]);
    analytics.track("e3"); // hits maxSize → auto flush
    await vi.waitFor(
      () => {
        expect(provider.tracked).toHaveLength(3);
      },
      { timeout: 10_000 } // 1s default flakes under parallel full-CI load
    );
  });

  it("delivered events are removed from the persisted queue", async () => {
    const storage = memoryStorage();
    const provider = spyProvider();
    const analytics = createAnalytics({
      providers: { provider },
      consent: "granted",
      storage,
    });
    analytics.track("done.event");
    await analytics.flush();
    expect(await storage.get("stapel-analytics:events")).toEqual([]);
  });
});

describe("delivery retry", () => {
  it("computes exponential backoff capped at 30s", () => {
    expect(backoffDelay(1, 500)).toBe(500);
    expect(backoffDelay(2, 500)).toBe(1000);
    expect(backoffDelay(3, 500)).toBe(2000);
    expect(backoffDelay(4, 500)).toBe(4000);
    expect(backoffDelay(20, 500)).toBe(30_000);
  });

  it("keeps a failed batch queued and does not re-call providers that succeeded", async () => {
    const good = spyProvider();
    let failuresLeft = 1;
    const flaky: AnalyticsProvider & { calls: number } = {
      calls: 0,
      track: () => {
        flaky.calls += 1;
        if (failuresLeft > 0) {
          failuresLeft -= 1;
          throw new Error("network down");
        }
      },
    };
    const analytics = createAnalytics({
      providers: { good, flaky },
      consent: "granted",
      storage: memoryStorage(),
      batch: { backoffBaseMs: 1 },
    });
    analytics.track("purchase");
    await analytics.flush(); // attempt 1: good ok, flaky throws
    expect(good.tracked).toHaveLength(1);
    expect(flaky.calls).toBe(1);

    await analytics.flush(); // attempt 2: only flaky re-called
    expect(good.tracked).toHaveLength(1);
    expect(flaky.calls).toBe(2);
  });

  it("retries automatically with backoff after a failed attempt", async () => {
    vi.useFakeTimers();
    let failuresLeft = 1;
    const flaky = spyProvider();
    const failingTrack = flaky.track.bind(flaky);
    flaky.track = (event) => {
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        throw new Error("offline");
      }
      failingTrack(event);
    };
    const analytics = createAnalytics({
      providers: { flaky },
      consent: "granted",
      storage: memoryStorage(),
      batch: { backoffBaseMs: 200 },
    });
    analytics.track("retry.me");
    await analytics.flush(); // fails, schedules retry in 200ms
    expect(flaky.tracked).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(200);
    expect(flaky.tracked.map((e) => e.name)).toEqual(["retry.me"]);
  });

  it("drops the batch with a console.warn after maxAttempts", async () => {
    const broken: AnalyticsProvider & { calls: number } = {
      calls: 0,
      track: () => {
        broken.calls += 1;
        throw new Error("always down");
      },
    };
    const after = spyProvider();
    const analytics = createAnalytics({
      providers: { broken },
      consent: "granted",
      storage: memoryStorage(),
      batch: { maxAttempts: 3, backoffBaseMs: 1 },
    });
    analytics.track("doomed");
    await analytics.flush();
    await analytics.flush();
    await analytics.flush(); // attempt 3 → drop
    expect(broken.calls).toBe(3);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("dropping a batch")
    );

    // Queue is clean afterwards: a healthy provider gets only new events.
    analytics.register("after", after);
    analytics.track("fresh");
    broken.track = () => undefined;
    await analytics.flush();
    expect(after.tracked.map((e) => e.name)).toEqual(["fresh"]);
  });
});

describe("PII guard", () => {
  it("strip: redacts email/phone-like values (nested too) and warns once per event", async () => {
    const provider = spyProvider();
    const analytics = createAnalytics({
      providers: { provider },
      consent: "granted",
      storage: memoryStorage(),
    });
    analytics.track("signup.completed", {
      email: "ada@example.com",
      phone: "+7 (999) 123-45-67",
      note: "hello world",
      nested: { contact: "bob@corp.io" },
    });
    analytics.track("signup.completed", { email: "second@example.com" });
    await analytics.flush();

    expect(provider.tracked[0]?.props).toEqual({
      email: "[redacted]",
      phone: "[redacted]",
      note: "hello world",
      nested: { contact: "[redacted]" },
    });
    const piiWarnings = warnSpy.mock.calls.filter((call) =>
      String(call[0]).includes("PII-like")
    );
    expect(piiWarnings).toHaveLength(1);
  });

  it("warn: keeps values but warns", async () => {
    const provider = spyProvider();
    const analytics = createAnalytics({
      providers: { provider },
      consent: "granted",
      piiGuard: "warn",
      storage: memoryStorage(),
    });
    analytics.track("lead.captured", { email: "ada@example.com" });
    await analytics.flush();
    expect(provider.tracked[0]?.props).toEqual({ email: "ada@example.com" });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("PII-like"));
  });

  it("off: passes values through silently", async () => {
    const provider = spyProvider();
    const analytics = createAnalytics({
      providers: { provider },
      consent: "granted",
      piiGuard: "off",
      storage: memoryStorage(),
    });
    analytics.track("lead.captured", { email: "ada@example.com" });
    await analytics.flush();
    expect(provider.tracked[0]?.props).toEqual({ email: "ada@example.com" });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("identify", () => {
  it("hashes the user id to a stable SHA-256 hex; traits pass the PII guard", async () => {
    const provider = spyProvider();
    const analytics = createAnalytics({
      providers: { provider },
      consent: "granted",
      storage: memoryStorage(),
    });
    analytics.identify("user-1", { plan: "pro", email: "u@x.io" });
    analytics.identify("user-1");
    await analytics.flush();

    const expected = await sha256HexRef("user-1");
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
    expect(provider.identified).toHaveLength(2);
    expect(provider.identified[0]?.userHash).toBe(expected);
    expect(provider.identified[1]?.userHash).toBe(expected);
    expect(provider.identified[0]?.traits).toEqual({
      plan: "pro",
      email: "[redacted]",
    });
  });

  it("providers without identify receive it as a track event carrying userHash", async () => {
    const trackOnly: AnalyticsProvider & { tracked: AnalyticsEvent[] } = {
      tracked: [],
      track: (event) => {
        trackOnly.tracked.push(event);
      },
    };
    const analytics = createAnalytics({
      providers: { trackOnly },
      consent: "granted",
      storage: memoryStorage(),
    });
    analytics.identify("user-2");
    await analytics.flush();
    expect(trackOnly.tracked[0]?.kind).toBe("identify");
    expect(trackOnly.tracked[0]?.userHash).toBe(await sha256HexRef("user-2"));
  });
});

describe("registry", () => {
  it("warns on unregistered event names but still delivers", async () => {
    const provider = spyProvider();
    const analytics = createAnalytics({
      providers: { provider },
      consent: "granted",
      registry: ["cart.viewed"],
      storage: memoryStorage(),
    });
    analytics.track("cart.viewed");
    expect(warnSpy).not.toHaveBeenCalled();
    analytics.track("rogue.event");
    analytics.track("rogue.event"); // warn deduped per name
    await analytics.flush();

    const registryWarnings = warnSpy.mock.calls.filter((call) =>
      String(call[0]).includes("not in the registry")
    );
    expect(registryWarnings).toHaveLength(1);
    expect(provider.tracked.map((e) => e.name)).toEqual([
      "cart.viewed",
      "rogue.event",
      "rogue.event",
    ]);
  });
});

describe("trackFlowStep", () => {
  it("emits flow.<flowId>.<stepId> with the phase merged into props", async () => {
    const provider = spyProvider();
    const analytics = createAnalytics({
      providers: { provider },
      consent: "granted",
      storage: memoryStorage(),
    });
    trackFlowStep(analytics, "onboarding", "otp", "completed", { ms: 12 });
    trackFlowStep(analytics, "checkout", "payment", "failed");
    await analytics.flush();

    expect(provider.tracked[0]?.name).toBe("flow.onboarding.otp");
    expect(provider.tracked[0]?.props).toEqual({ phase: "completed", ms: 12 });
    expect(provider.tracked[1]?.name).toBe("flow.checkout.payment");
    expect(provider.tracked[1]?.props).toEqual({ phase: "failed" });
  });
});
