import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { loadedRowsOrEmpty } from "@stapel/core";
import { createNotificationsRuntime } from "../src/model/runtime.js";
import type { NotificationsRuntime } from "../src/model/runtime.js";
import { NotificationsProvider } from "../src/headless/NotificationsProvider.js";
import { NotificationFeed } from "../src/headless/NotificationFeed.js";
import { DeviceRegistration } from "../src/headless/DeviceRegistration.js";
import { useNotificationFeed } from "../src/model/queries.js";

/** Base the msw handlers mount on (mirrors stapel-notifications `/notifications/api/`). */
const BASE = "https://notifications.stapel.test/notifications/api/v1";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function feedPage(hasNext: boolean, idSuffix: string, unread = 1) {
  return {
    items: [
      {
        id: `550e8400-e29b-41d4-a716-4466554400${idSuffix}`,
        notification_type: "listing_blocked",
        title: "Your listing has been blocked",
        body: "Blocked for guideline violations.",
        data: {},
        created_at: "2026-03-17T10:30:00Z",
        read_at: null,
      },
    ],
    next_anchor: hasNext ? "anchor-2" : null,
    prev_anchor: null,
    has_next: hasNext,
    has_prev: false,
    count: 1,
    unread_count: unread,
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
          {({ state, hasNextPage, fetchNextPage }) => (
            <div>
              <span data-testid="count">{loadedRowsOrEmpty(state).length}</span>
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

describe("marking read — the request, the optimistic write, and the way back", () => {
  /**
   * Renders the headless bag's read half as text, so each assertion below is
   * about what a skin can actually see.
   */
  function ReadBar(): ReactElement {
    return (
      <NotificationFeed>
        {({ state, unreadCount, markAll, markAllRead, markRead, markReadError }) => {
          const rows = loadedRowsOrEmpty(state);
          return (
            <div>
              <span data-testid="unread">{unreadCount}</span>
              <span data-testid="gate">{String(markAll.available)}</span>
              <span data-testid="gate-reason">
                {markAll.available ? "" : markAll.block.code}
              </span>
              <span data-testid="read-at">{rows[0]?.read_at ?? "null"}</span>
              <span data-testid="error">{markReadError?.code ?? "none"}</span>
              <button onClick={markAllRead}>all</button>
              <button
                onClick={() => {
                  if (rows[0] !== undefined) markRead(rows[0]);
                }}
              >
                one
              </button>
            </div>
          );
        }}
      </NotificationFeed>
    );
  }

  it("sends the ids branch alone — never `all: false` beside it", async () => {
    // Both targets is the same 400 as neither (`error.400.read_target_required`),
    // so an `all: false` tagging along with the ids is a request that cannot
    // succeed. The union in api/types.ts makes it unspellable; this proves the
    // body that leaves the client.
    let body: unknown;
    server.use(
      http.get(`${BASE}/feed/`, () => HttpResponse.json(feedPage(false, "00"))),
      http.post(`${BASE}/feed/read/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ marked: 1, unread_count: 0 });
      })
    );
    const runtime = createNotificationsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ReadBar />));
    await waitFor(() => expect(screen.getByTestId("unread").textContent).toBe("1"));
    screen.getByText("one").click();
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toEqual({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });
  });

  it("stamps the row and drops the badge BEFORE the server answers", async () => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${BASE}/feed/`, () => HttpResponse.json(feedPage(false, "00"))),
      http.post(`${BASE}/feed/read/`, async () => {
        await held;
        return HttpResponse.json({ marked: 1, unread_count: 0 });
      })
    );
    const runtime = createNotificationsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ReadBar />));
    await waitFor(() => expect(screen.getByTestId("unread").textContent).toBe("1"));
    screen.getByText("one").click();
    // The request is still in flight here: a feed that stayed bold for a round
    // trip after being opened is the thing this hook is optimistic FOR.
    await waitFor(() => expect(screen.getByTestId("unread").textContent).toBe("0"));
    expect(screen.getByTestId("read-at").textContent).not.toBe("null");
    release?.();
  });

  it("puts the row AND the badge back when the write fails", async () => {
    server.use(
      http.get(`${BASE}/feed/`, () => HttpResponse.json(feedPage(false, "00"))),
      http.post(`${BASE}/feed/read/`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.400.too_many_ids",
            error: "Too many ids in one request.",
            params: {},
          },
          { status: 400 }
        )
      )
    );
    const runtime = createNotificationsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ReadBar />));
    await waitFor(() => expect(screen.getByTestId("unread").textContent).toBe("1"));
    screen.getByText("all").click();
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toBe("error.400.too_many_ids")
    );
    // Rolled back together — a badge that stayed at 0 over rows that came back
    // bold is worse than never having moved.
    await waitFor(() => expect(screen.getByTestId("unread").textContent).toBe("1"));
    expect(screen.getByTestId("read-at").textContent).toBe("null");
  });

  it("blocks mark-all WITH A REASON when nothing is unread", async () => {
    server.use(
      http.get(`${BASE}/feed/`, () => HttpResponse.json(feedPage(false, "00", 0)))
    );
    const runtime = createNotificationsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ReadBar />));
    await waitFor(() =>
      expect(screen.getByTestId("gate-reason").textContent).toBe(
        "notifications.feed.mark_all_read.blocked.none"
      )
    );
    expect(screen.getByTestId("gate").textContent).toBe("false");
  });

  it("blocks mark-all while the feed is still loading, and again when it failed", async () => {
    // `unreadCount` is 0 in both, and 0 is also "all caught up" — so a gate
    // built on the number alone would tell somebody they were up to date
    // during an outage. It is built on the LOAD STATE.
    server.use(http.get(`${BASE}/feed/`, () => new Promise(() => undefined)));
    const runtime = createNotificationsRuntime({ baseUrl: BASE });
    const { unmount } = render(wrap(runtime, <ReadBar />));
    await waitFor(() =>
      expect(screen.getByTestId("gate-reason").textContent).toBe(
        "stapel.action.blocked.loading"
      )
    );
    unmount();

    server.use(http.get(`${BASE}/feed/`, () => new HttpResponse(null, { status: 503 })));
    render(wrap(createNotificationsRuntime({ baseUrl: BASE }), <ReadBar />));
    await waitFor(() =>
      expect(screen.getByTestId("gate-reason").textContent).toBe(
        "stapel.action.blocked.load_failed"
      )
    );
  });

  it("a row that is already read sends nothing at all", async () => {
    // The endpoint would answer `marked: 0` and emit no signal, so the request
    // buys nothing — and a list that fired one per read row would send a
    // burst on every scroll.
    let posts = 0;
    const readPage = {
      ...feedPage(false, "00", 0),
      items: [{ ...feedPage(false, "00").items[0], read_at: "2026-03-18T09:00:00Z" }],
    };
    server.use(
      http.get(`${BASE}/feed/`, () => HttpResponse.json(readPage)),
      http.post(`${BASE}/feed/read/`, () => {
        posts += 1;
        return HttpResponse.json({ marked: 0, unread_count: 0 });
      })
    );
    render(wrap(createNotificationsRuntime({ baseUrl: BASE }), <ReadBar />));
    await waitFor(() =>
      expect(screen.getByTestId("read-at").textContent).toBe("2026-03-18T09:00:00Z")
    );
    screen.getByText("one").click();
    await waitFor(() => expect(screen.getByTestId("unread").textContent).toBe("0"));
    expect(posts).toBe(0);
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
