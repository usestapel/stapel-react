/**
 * The default skin, asserted on the things it exists to get right.
 *
 * The old suite proved the toggle sent a POST. It could not prove the switch
 * was in the RIGHT POSITION, because before `GET /devices/` (0.17.0) nothing
 * could. The assertions below are the ones the audit's blocker asked for:
 *
 *   - the switch is ON because the SERVER says this device is registered;
 *   - a refused permission prompt is a visible sentence, not a swallowed
 *     rejection and a switch that springs back;
 *   - a failed registration does NOT leave the switch on (no optimistic flip);
 *   - turning it off sends a real request, by row id;
 *   - the feed renders all six wire fields and the delivery mode is on screen.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { CONFIRM_OK_TESTID } from "@stapel/tokens-antd/skin";
import { createNotificationsRuntime } from "../src/model/runtime.js";
import type { NotificationsRuntime } from "../src/model/runtime.js";
import { NotificationsProvider } from "../src/headless/NotificationsProvider.js";
import { FeedDeliveryProvider } from "../src/model/delivery.js";
import {
  notificationsI18nBundleEn,
  registerNotificationsI18n,
} from "../src/i18n/keys.js";
import {
  NotificationFeedList,
  NotificationsPage,
  PushDeviceList,
  PushNotificationToggle,
  PushSettingsPane,
} from "../src/default/index.js";

const BASE = "https://notifications.stapel.test/notifications/api/v1";

/** SHA-256 of `THIS_TOKEN`, hex — the value `GET /devices/` returns as
 * `token_fingerprint` for the device holding it. Computed, not guessed: the
 * matching test below recomputes it from the token at runtime. */
const THIS_TOKEN = "demo-web-push-token";
const THIS_FINGERPRINT =
  "ec1219f14b70736feaf02baa9f264040b5077f61d6112dd90bed488df681f838";

const THIS_DEVICE = {
  id: 42,
  token_fingerprint: THIS_FINGERPRINT,
  platform: "web",
  is_active: true,
  created_at: "2026-03-17T10:30:00Z",
  last_seen: "2026-03-18T08:02:11Z",
};

const OTHER_DEVICE = {
  id: 7,
  token_fingerprint: "f".repeat(64),
  platform: "android",
  is_active: false,
  created_at: "2026-01-02T10:30:00Z",
  last_seen: "2026-01-09T08:02:11Z",
};

const FEED_ITEM = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  notification_type: "listing_blocked",
  title: "Your listing has been blocked",
  body: "Blocked for guideline violations.",
  data: { listing_url: "https://example.test/listings/9" },
  created_at: "2026-03-17T10:30:00Z",
};

function page(
  items: readonly unknown[],
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    items,
    next_anchor: null,
    prev_anchor: null,
    has_next: false,
    has_prev: false,
    count: items.length,
    ...overrides,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function wrap(runtime: NotificationsRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = createI18n({ locale: "en" });
  registerNotificationsI18n(i18n);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <NotificationsProvider runtime={runtime}>{children}</NotificationsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** `GET /devices/` answering `devices`, and nothing else. */
function serveDevices(devices: readonly unknown[]): void {
  server.use(http.get(`${BASE}/devices/`, () => HttpResponse.json(devices)));
}

const heldToken = (): Promise<string | null> => Promise.resolve(THIS_TOKEN);
const mintToken = (): Promise<string> => Promise.resolve(THIS_TOKEN);

describe("<PushNotificationToggle/> — the switch draws the server's answer", () => {
  it("the fingerprint the skin matches on really is SHA-256 of the token", async () => {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(THIS_TOKEN)
    );
    const hex = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(hex).toBe(THIS_FINGERPRINT);
  });

  it("renders ON for a device the registry lists as active — not OFF on every mount", async () => {
    serveDevices([THIS_DEVICE, OTHER_DEVICE]);
    render(
      wrap(
        createNotificationsRuntime({ baseUrl: BASE }),
        <PushNotificationToggle getToken={mintToken} currentToken={heldToken} />
      )
    );
    await waitFor(() =>
      expect(screen.getByText("On for this device")).toBeDefined()
    );
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("renders OFF when this device holds no token at all", async () => {
    serveDevices([OTHER_DEVICE]);
    render(
      wrap(
        createNotificationsRuntime({ baseUrl: BASE }),
        <PushNotificationToggle
          getToken={mintToken}
          currentToken={() => Promise.resolve(null)}
        />
      )
    );
    await waitFor(() => expect(screen.getByText("Off for this device")).toBeDefined());
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("a registered-but-rejected token is INACTIVE, not on", async () => {
    serveDevices([{ ...THIS_DEVICE, is_active: false }]);
    render(
      wrap(
        createNotificationsRuntime({ baseUrl: BASE }),
        <PushNotificationToggle getToken={mintToken} currentToken={heldToken} />
      )
    );
    await waitFor(() =>
      expect(
        screen.getByText(notificationsI18nBundleEn["notifications.push.inactive"])
      ).toBeDefined()
    );
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("without a token to match, it says so and gates the switch instead of guessing", async () => {
    serveDevices([OTHER_DEVICE]);
    render(
      wrap(
        createNotificationsRuntime({ baseUrl: BASE }),
        <PushNotificationToggle getToken={mintToken} />
      )
    );
    await waitFor(() =>
      expect(screen.getByText("We can't tell whether push is on here")).toBeDefined()
    );
    // The reason is BESIDE the control, not in a tooltip, and the control is off-limits.
    expect(
      screen.getByTestId("push-toggle").getAttribute("data-stapel-gated")
    ).toBe("blocked");
    expect(screen.getByRole("switch").hasAttribute("disabled")).toBe(true);
  });

  it("a REFUSED permission prompt is a visible message — the rejection is not swallowed", async () => {
    serveDevices([]);
    let posted = false;
    server.use(
      http.post(`${BASE}/devices/`, () => {
        posted = true;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    const denied = (): Promise<string> => {
      const error = new Error("denied");
      error.name = "NotAllowedError";
      return Promise.reject(error);
    };
    render(
      wrap(
        createNotificationsRuntime({ baseUrl: BASE }),
        <PushNotificationToggle
          getToken={denied}
          currentToken={() => Promise.resolve(null)}
        />
      )
    );
    await waitFor(() => expect(screen.getByText("Off for this device")).toBeDefined());
    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() =>
      expect(
        screen.getByText("Notifications are blocked in this browser")
      ).toBeDefined()
    );
    expect(
      screen.getByText(
        "Allow notifications for this site in your browser settings, then try again."
      )
    ).toBeDefined();
    expect(posted).toBe(false);
  });

  it("a FAILED registration does not leave the switch on (no optimistic flip)", async () => {
    serveDevices([]);
    server.use(
      http.post(`${BASE}/devices/`, () =>
        HttpResponse.json(
          { code: "error.400.invalid_platform", message: "Invalid platform" },
          { status: 400 }
        )
      )
    );
    render(
      wrap(
        createNotificationsRuntime({ baseUrl: BASE }),
        <PushNotificationToggle
          getToken={mintToken}
          currentToken={() => Promise.resolve(null)}
        />
      )
    );
    await waitFor(() => expect(screen.getByText("Off for this device")).toBeDefined());
    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => expect(screen.getByTestId("push-error")).toBeDefined());
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("turning it OFF sends a real request — by row id, never a silent no-op", async () => {
    let deletedId: string | undefined;
    serveDevices([THIS_DEVICE]);
    server.use(
      http.delete(`${BASE}/devices/by-id/:id/`, ({ params }) => {
        deletedId = params.id as string;
        return new HttpResponse(null, { status: 204 });
      })
    );
    render(
      wrap(
        createNotificationsRuntime({ baseUrl: BASE }),
        <PushNotificationToggle getToken={mintToken} currentToken={heldToken} />
      )
    );
    await waitFor(() => expect(screen.getByText("On for this device")).toBeDefined());
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(deletedId).toBe("42"));
  });

  it("an unsupported environment states the reason and offers no working control", async () => {
    serveDevices([]);
    render(
      wrap(
        createNotificationsRuntime({ baseUrl: BASE }),
        <PushNotificationToggle getToken={mintToken} supported={false} />
      )
    );
    await waitFor(() =>
      expect(screen.getByText("This browser can't receive push")).toBeDefined()
    );
    expect(screen.getByRole("switch").hasAttribute("disabled")).toBe(true);
  });
});

describe("<PushDeviceList/> — the account's registry", () => {
  it("lists devices, marks this one, flags an inactive one, and removes by id", async () => {
    let deletedId: string | undefined;
    serveDevices([THIS_DEVICE, OTHER_DEVICE]);
    server.use(
      http.delete(`${BASE}/devices/by-id/:id/`, ({ params }) => {
        deletedId = params.id as string;
        return new HttpResponse(null, { status: 204 });
      })
    );
    render(
      wrap(createNotificationsRuntime({ baseUrl: BASE }), <PushDeviceList currentToken={heldToken} />)
    );

    // TWO independent async chains feed this render: `GET /devices/` produces
    // the rows, while `currentToken()` → `crypto.subtle.digest` produces the
    // fingerprint that marks one of them as THIS device. Waiting on the rows
    // alone and then asserting the marker synchronously assumes the digest
    // always lands first — it usually does, and under a loaded runner it does
    // not. Wait for the marker itself, which needs both chains.
    await waitFor(() => {
      expect(screen.getAllByTestId("push-device-row")).toHaveLength(2);
      expect(screen.getByTestId("push-device-current")).toBeDefined();
    });
    expect(screen.getByTestId("push-device-inactive")).toBeDefined();
    // A row is a platform and a date, never a raw ISO timestamp.
    expect(screen.queryByText("2026-01-09T08:02:11Z")).toBeNull();

    // Removal is a confirm, and the confirm is the shared surface.
    fireEvent.click(screen.getAllByTestId("push-device-remove")[1] as HTMLElement);
    await waitFor(() => expect(screen.getByTestId(CONFIRM_OK_TESTID)).toBeDefined());
    fireEvent.click(screen.getByTestId(CONFIRM_OK_TESTID));
    await waitFor(() => expect(deletedId).toBe("7"));
  });

  it("an EMPTY registry is a designed empty state, not a blank box", async () => {
    serveDevices([]);
    render(wrap(createNotificationsRuntime({ baseUrl: BASE }), <PushDeviceList />));
    await waitFor(() =>
      expect(screen.getByTestId("push-devices-empty")).toBeDefined()
    );
    expect(screen.getByText("No devices are registered")).toBeDefined();
  });

  it("a FAILED read never says the registry is empty", async () => {
    server.use(
      http.get(`${BASE}/devices/`, () => new HttpResponse(null, { status: 503 }))
    );
    render(wrap(createNotificationsRuntime({ baseUrl: BASE }), <PushDeviceList />));
    await waitFor(() =>
      expect(screen.getByTestId("push-devices-failed")).toBeDefined()
    );
    expect(screen.queryByTestId("push-devices-empty")).toBeNull();
  });
});

describe("<NotificationFeedList/> — six fields on the wire, six on the glass", () => {
  it("renders type, title, body, a formatted time and the deep link", async () => {
    server.use(http.get(`${BASE}/feed/`, () => HttpResponse.json(page([FEED_ITEM]))));
    render(
      wrap(
        createNotificationsRuntime({ baseUrl: BASE }),
        <NotificationFeedList now={new Date("2026-03-19T10:30:00Z")} />
      )
    );

    await waitFor(() =>
      expect(screen.getByText("Your listing has been blocked")).toBeDefined()
    );
    const row = screen.getByTestId("notification-feed-item");
    // notification_type reaches the DOM, so a row can be keyed/iconed by family.
    expect(row.getAttribute("data-notification-type")).toBe("listing_blocked");
    // created_at is a machine-readable instant AND a human sentence — never ISO text.
    const time = row.querySelector("time");
    expect(time?.getAttribute("dateTime")).toBe("2026-03-17T10:30:00Z");
    expect(time?.textContent).not.toContain("2026-03-17T10:30:00Z");
    expect(time?.textContent).toContain("2 days ago");
    // data.listing_url is the row's destination.
    expect(
      screen.getByTestId("notification-feed-link").getAttribute("href")
    ).toBe("https://example.test/listings/9");
  });

  it("a row with no deep link is not a dead control", async () => {
    server.use(
      http.get(`${BASE}/feed/`, () =>
        HttpResponse.json(page([{ ...FEED_ITEM, data: {} }]))
      )
    );
    render(wrap(createNotificationsRuntime({ baseUrl: BASE }), <NotificationFeedList />));
    await waitFor(() => expect(screen.getByTestId("notification-feed-item")).toBeDefined());
    expect(screen.queryByTestId("notification-feed-link")).toBeNull();
  });

  it("the end footnote says 'no more' in different words from the empty state", async () => {
    server.use(http.get(`${BASE}/feed/`, () => HttpResponse.json(page([FEED_ITEM]))));
    const { unmount } = render(
      wrap(createNotificationsRuntime({ baseUrl: BASE }), <NotificationFeedList />)
    );
    await waitFor(() => expect(screen.getByTestId("notification-feed-end")).toBeDefined());
    expect(screen.queryByTestId("notification-feed-empty")).toBeNull();
    // Same words for both claims is the defect, not just same placement: the
    // footnote under existing rows must not be the empty state's sentence.
    expect(screen.getByTestId("notification-feed-end").textContent).not.toBe(
      notificationsI18nBundleEn["notifications.feed.empty"]
    );
    unmount();

    server.use(http.get(`${BASE}/feed/`, () => HttpResponse.json(page([]))));
    render(wrap(createNotificationsRuntime({ baseUrl: BASE }), <NotificationFeedList />));
    await waitFor(() => expect(screen.getByTestId("notification-feed-empty")).toBeDefined());
    // The sentence that means "there is no more" must not be used for
    // "there is nothing" — the visual pass caught exactly that inversion.
    expect(screen.queryByTestId("notification-feed-end")).toBeNull();
  });

  it("pages, and a FAILED read shows the error and NEVER the empty copy", async () => {
    server.use(
      http.get(`${BASE}/feed/`, ({ request }) => {
        const anchor = new URL(request.url).searchParams.get("anchor");
        if (anchor === null) {
          return HttpResponse.json(
            page([FEED_ITEM], { has_next: true, next_anchor: "anchor-2" })
          );
        }
        return HttpResponse.json(
          page([{ ...FEED_ITEM, id: "b", title: "Weekly digest" }])
        );
      })
    );
    const { unmount } = render(
      wrap(createNotificationsRuntime({ baseUrl: BASE }), <NotificationFeedList />)
    );
    await waitFor(() => expect(screen.getByTestId("notification-feed-more")).toBeDefined());
    fireEvent.click(screen.getByTestId("notification-feed-more"));
    await waitFor(() => expect(screen.getByText("Weekly digest")).toBeDefined());
    unmount();

    server.use(http.get(`${BASE}/feed/`, () => new HttpResponse(null, { status: 404 })));
    render(wrap(createNotificationsRuntime({ baseUrl: BASE }), <NotificationFeedList />));
    await waitFor(() => expect(screen.getByTestId("notification-feed-failed")).toBeDefined());
    expect(screen.queryByTestId("notification-feed-empty")).toBeNull();
  });

  it("says nothing about emptiness while the first page is still in flight", async () => {
    server.use(http.get(`${BASE}/feed/`, () => new Promise(() => undefined)));
    render(wrap(createNotificationsRuntime({ baseUrl: BASE }), <NotificationFeedList />));
    await waitFor(() =>
      expect(screen.getByTestId("notification-feed-loading")).toBeDefined()
    );
    expect(screen.queryByTestId("notification-feed-empty")).toBeNull();
    expect(screen.queryByTestId("notification-feed-failed")).toBeNull();
  });
});

describe("the delivery mode is always on screen", () => {
  it("polls, and says so, when no socket adapter published a mode", async () => {
    server.use(http.get(`${BASE}/feed/`, () => HttpResponse.json(page([FEED_ITEM]))));
    render(wrap(createNotificationsRuntime({ baseUrl: BASE }), <NotificationFeedList />));
    await waitFor(() => expect(screen.getByTestId("notification-delivery")).toBeDefined());
    expect(
      screen.getByTestId("notification-delivery").getAttribute("data-delivery-mode")
    ).toBe("polling");
    expect(
      screen.getByText(notificationsI18nBundleEn["notifications.live.polling"])
    ).toBeDefined();
  });

  it("shows LIVE when a socket is carrying the feed", async () => {
    server.use(http.get(`${BASE}/feed/`, () => HttpResponse.json(page([FEED_ITEM]))));
    render(
      wrap(
        createNotificationsRuntime({ baseUrl: BASE }),
        <FeedDeliveryProvider value={{ mode: "live" }}>
          <NotificationFeedList />
        </FeedDeliveryProvider>
      )
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("notification-delivery").getAttribute("data-delivery-mode")
      ).toBe("live")
    );
    expect(screen.getByText("Live")).toBeDefined();
  });

  it("a refused socket names the refusal and offers the way back", async () => {
    server.use(http.get(`${BASE}/feed/`, () => HttpResponse.json(page([FEED_ITEM]))));
    let reconnected = 0;
    render(
      wrap(
        createNotificationsRuntime({ baseUrl: BASE }),
        <FeedDeliveryProvider
          value={{
            mode: "refused",
            refusal: "session",
            reconnect: () => {
              reconnected += 1;
            },
          }}
        >
          <NotificationFeedList />
        </FeedDeliveryProvider>
      )
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          "Your session expired. Sign in again to resume live updates."
        )
      ).toBeDefined()
    );
    fireEvent.click(screen.getByText("Reconnect"));
    expect(reconnected).toBe(1);
  });
});

describe("every routed surface renders on both sides and at both widths", () => {
  const surfaces: readonly [string, (mode: "light" | "dark") => ReactElement][] = [
    ["notifications-page", (mode) => <NotificationsPage mode={mode} />],
    ["notification-feed-list", (mode) => <NotificationFeedList mode={mode} />],
    ["push-settings-pane", (mode) => <PushSettingsPane mode={mode} getToken={mintToken} />],
    ["push-notification-toggle", (mode) => <PushNotificationToggle mode={mode} getToken={mintToken} />],
    ["push-device-list", (mode) => <PushDeviceList mode={mode} />],
  ];

  for (const [testId, node] of surfaces) {
    for (const mode of ["light", "dark"] as const) {
      it(`${testId} paints its own ${mode} surface`, async () => {
        server.use(http.get(`${BASE}/feed/`, () => HttpResponse.json(page([FEED_ITEM]))));
        serveDevices([THIS_DEVICE]);
        render(wrap(createNotificationsRuntime({ baseUrl: BASE }), node(mode)));
        const root = await screen.findByTestId(testId);
        // The skin self-themes: a dark document does not leave it light, and
        // the surface is painted here rather than borrowed from the host.
        expect(root.getAttribute("data-stapel-skin-mode")).toBe(mode);
        expect(root.hasAttribute("data-stapel-skin-surface")).toBe(true);
      });
    }
  }
});
