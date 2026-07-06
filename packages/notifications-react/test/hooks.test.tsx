import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createNotificationsRuntime } from "../src/model/runtime.js";
import type { NotificationsRuntime } from "../src/model/runtime.js";
import { NotificationsProvider } from "../src/headless/NotificationsProvider.js";
import { NotificationFeed } from "../src/headless/NotificationFeed.js";
import { DeviceRegistration } from "../src/headless/DeviceRegistration.js";
import { useNotificationFeed } from "../src/model/queries.js";

/** Base the msw handlers mount on (mirrors stapel-notifications `/notifications/api/`). */
const BASE = "https://notifications.stapel.test/notifications/api";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function feedPage(hasNext: boolean, idSuffix: string) {
  return {
    items: [
      {
        id: `550e8400-e29b-41d4-a716-4466554400${idSuffix}`,
        notification_type: "listing_blocked",
        title: "Your listing has been blocked",
        body: "Blocked for guideline violations.",
        data: {},
        created_at: "2026-03-17T10:30:00Z",
      },
    ],
    next_anchor: hasNext ? "anchor-2" : null,
    prev_anchor: null,
    has_next: hasNext,
    has_prev: false,
    count: 1,
  };
}

function wrap(runtime: NotificationsRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationsProvider runtime={runtime}>{children}</NotificationsProvider>
    </QueryClientProvider>
  );
}

describe("useNotificationFeed (happy path)", () => {
  it("fetches and returns a page of feed items", async () => {
    server.use(
      http.get(`${BASE}/feed/`, () => HttpResponse.json(feedPage(false, "00")))
    );
    const runtime = createNotificationsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useNotificationFeed(), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0]?.title).toContain("blocked");
  });
});

describe("<NotificationFeed> (headless, load-more)", () => {
  it("renders items and advances a page through next_anchor", async () => {
    server.use(
      http.get(`${BASE}/feed/`, ({ request }) => {
        const anchor = new URL(request.url).searchParams.get("anchor");
        return HttpResponse.json(
          anchor === "anchor-2" ? feedPage(false, "02") : feedPage(true, "01")
        );
      })
    );
    const runtime = createNotificationsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <NotificationFeed>
          {({ items, hasNextPage, fetchNextPage }) => (
            <div>
              <span data-testid="count">{items.length}</span>
              <span data-testid="has-next">{String(hasNextPage)}</span>
              <button onClick={fetchNextPage}>more</button>
            </div>
          )}
        </NotificationFeed>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("count").textContent).toBe("1")
    );
    expect(screen.getByTestId("has-next").textContent).toBe("true");
    screen.getByText("more").click();
    await waitFor(() =>
      expect(screen.getByTestId("count").textContent).toBe("2")
    );
    await waitFor(() =>
      expect(screen.getByTestId("has-next").textContent).toBe("false")
    );
  });
});

describe("<DeviceRegistration> (happy path + error)", () => {
  it("registers a token and exposes the echoed result", async () => {
    server.use(
      http.post(`${BASE}/devices/`, () =>
        HttpResponse.json({ token: "tok-1", platform: "web" }, { status: 201 })
      )
    );
    const runtime = createNotificationsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <DeviceRegistration>
          {({ register, registered }) => (
            <div>
              <span data-testid="platform">{registered?.platform ?? "none"}</span>
              <button onClick={() => register("tok-1", "web")}>go</button>
            </div>
          )}
        </DeviceRegistration>
      )
    );
    expect(screen.getByTestId("platform").textContent).toBe("none");
    screen.getByText("go").click();
    await waitFor(() =>
      expect(screen.getByTestId("platform").textContent).toBe("web")
    );
  });

  it("surfaces a StapelApiError (localizable code) on a 404 unregister", async () => {
    server.use(
      http.delete(`${BASE}/devices/:token/`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.404.token_not_found",
            error: "Device token not found.",
            params: {},
          },
          { status: 404 }
        )
      )
    );
    const runtime = createNotificationsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <DeviceRegistration>
          {({ unregister, error }) => (
            <div>
              <span data-testid="code">{error?.code ?? "none"}</span>
              <button onClick={() => unregister("ghost")}>rm</button>
            </div>
          )}
        </DeviceRegistration>
      )
    );
    screen.getByText("rm").click();
    await waitFor(() =>
      expect(screen.getByTestId("code").textContent).toBe(
        "error.404.token_not_found"
      )
    );
  });
});
