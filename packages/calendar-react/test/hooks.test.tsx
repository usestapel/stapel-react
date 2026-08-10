import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mapLoad, matchList } from "@stapel/core";
import type { ReactElement, ReactNode } from "react";
import { createCalendarRuntime } from "../src/model/runtime.js";
import type { CalendarRuntime } from "../src/model/runtime.js";
import { CalendarProvider } from "../src/headless/CalendarProvider.js";
import { CalendarView } from "../src/headless/CalendarView.js";
import { EventComposer } from "../src/headless/EventComposer.js";
import { EventRsvp } from "../src/headless/EventRsvp.js";
import { useCalendar } from "../src/model/queries.js";
import { calendarI18nBundleEn } from "../src/i18n/keys.js";
import {
  useReplaceParticipants,
  useUpdateEvent,
} from "../src/model/mutations.js";

/** Base the msw handlers mount on (mirrors stapel-calendar `/calendar/api/`). */
const BASE = "https://calendar.stapel.test/calendar/api/v1";

const EVENT = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  title: "Design review",
  description: "",
  start: "2026-07-13T10:00:00Z",
  end: "2026-07-13T10:30:00Z",
  owner_id: "u-1",
  scope_key: "ws-1",
  status: "confirmed",
  recurrence_type: "none",
  rrule: "",
  participants: [],
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrap(runtime: CalendarRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <CalendarProvider runtime={runtime}>{children}</CalendarProvider>
    </QueryClientProvider>
  );
}

describe("useCalendar (happy path)", () => {
  it("reads events + occurrences over a range", async () => {
    server.use(
      http.get(`${BASE}/calendar`, () =>
        HttpResponse.json({ events: [EVENT], occurrences: [] })
      )
    );
    const runtime = createCalendarRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useCalendar(), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.events).toHaveLength(1);
    expect(result.current.data?.events?.[0]?.title).toBe("Design review");
  });
});

describe("<CalendarView> (headless)", () => {
  it("passes range params and renders the events bag", async () => {
    let seenUrl = "";
    server.use(
      http.get(`${BASE}/calendar`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({ events: [EVENT], occurrences: [] });
      })
    );
    const runtime = createCalendarRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <CalendarView start="2026-07-13T00:00:00Z" end="2026-07-20T00:00:00Z">
          {({ state }) => (
            <span data-testid="count">
              {matchList(
                mapLoad(state, (range) => range.events),
                {
                  loading: () => "loading",
                  empty: () => "0",
                  failed: () => "failed",
                  ready: (events) => String(events.length),
                }
              )}
            </span>
          )}
        </CalendarView>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("count").textContent).toBe("1")
    );
    expect(seenUrl).toContain("start=");
    expect(seenUrl).toContain("end=");
  });
});

describe("useUpdateEvent (PATCH, happy path)", () => {
  it("PATCHes the event and resolves the updated body", async () => {
    let seenMethod = "";
    let seenBody: unknown;
    server.use(
      http.patch(`${BASE}/events/:id`, async ({ request }) => {
        seenMethod = request.method;
        seenBody = await request.json();
        return HttpResponse.json({ ...EVENT, title: "Renamed review" });
      })
    );
    const runtime = createCalendarRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useUpdateEvent(), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    result.current.mutate({ eventId: EVENT.id, patch: { title: "Renamed review" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenMethod).toBe("PATCH");
    expect(seenBody).toEqual({ title: "Renamed review" });
    expect(result.current.data?.title).toBe("Renamed review");
  });
});

describe("useReplaceParticipants (PUT, replace-set)", () => {
  it("PUTs the complete invitee list and resolves the updated event", async () => {
    let seenMethod = "";
    let seenBody: unknown;
    server.use(
      http.put(`${BASE}/events/:id/participants`, async ({ request }) => {
        seenMethod = request.method;
        seenBody = await request.json();
        return HttpResponse.json({ ...EVENT, participants: [] });
      })
    );
    const runtime = createCalendarRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useReplaceParticipants(), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    result.current.mutate({ eventId: EVENT.id, participantIds: ["u-2", "u-3"] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenMethod).toBe("PUT");
    expect(seenBody).toEqual({ participant_ids: ["u-2", "u-3"] });
  });
});

describe("<EventComposer> (create, happy path)", () => {
  it("creates an event and exposes the echoed result", async () => {
    server.use(
      http.post(`${BASE}/events`, () =>
        HttpResponse.json({ ...EVENT, title: "Coffee chat" }, { status: 201 })
      )
    );
    const runtime = createCalendarRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <EventComposer>
          {({ create, created }) => (
            <div>
              <span data-testid="title">{created?.title ?? "none"}</span>
              <button
                onClick={() =>
                  create({
                    title: "Coffee chat",
                    start: "2026-07-15T09:00:00Z",
                    end: "2026-07-15T09:30:00Z",
                  })
                }
              >
                go
              </button>
            </div>
          )}
        </EventComposer>
      )
    );
    expect(screen.getByTestId("title").textContent).toBe("none");
    screen.getByText("go").click();
    await waitFor(() =>
      expect(screen.getByTestId("title").textContent).toBe("Coffee chat")
    );
  });
});

describe("<EventRsvp> (error path)", () => {
  it("surfaces a StapelApiError (localizable code) on a 404 not-invited", async () => {
    server.use(
      http.post(`${BASE}/events/:id/respond`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.404.calendar_not_invited",
            error: "You are not invited to this event",
            params: {},
          },
          { status: 404 }
        )
      )
    );
    const runtime = createCalendarRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <EventRsvp eventId="ghost">
          {({ respond, error }) => (
            <div>
              <span data-testid="code">{error?.code ?? "none"}</span>
              <button onClick={() => respond("accepted")}>rsvp</button>
            </div>
          )}
        </EventRsvp>
      )
    );
    screen.getByText("rsvp").click();
    await waitFor(() =>
      expect(screen.getByTestId("code").textContent).toBe(
        "error.404.calendar_not_invited"
      )
    );
  });
});

/**
 * The three answers a range read can give, kept apart. An empty grid is the
 * NORMAL case for a calendar, so before the `LoadState` cutover a failed read
 * — which also arrived as `events: []` — was invisible: the user saw "nothing
 * scheduled" for a calendar the server never answered for. The copy asserted
 * here is the pair's own shipped en text, and msw drives the real transport so
 * the failed case comes from an actual 500 (mock the wire, not the module).
 */
const LOADING_COPY = calendarI18nBundleEn["calendar.view.loading"] as string;
const EMPTY_COPY = calendarI18nBundleEn["calendar.view.empty"] as string;
const ERROR_COPY = calendarI18nBundleEn["calendar.view.error"] as string;

function CalendarSkin(): ReactElement {
  return (
    <CalendarView>
      {({ state }) =>
        matchList(
          mapLoad(state, (range) => range.events),
          {
            loading: () => <span>{LOADING_COPY}</span>,
            empty: () => <span>{EMPTY_COPY}</span>,
            failed: () => <span>{ERROR_COPY}</span>,
            ready: (events) => <span data-testid="rows">{events.length}</span>,
          }
        )
      }
    </CalendarView>
  );
}

describe("<CalendarView> load states (loading / empty / failed)", () => {
  // These three assert on ABSENCE as much as presence, so each case needs a
  // DOM of its own (this package's setup registers no auto-cleanup).
  afterEach(cleanup);

  it("shows the loading copy while the range read is in flight", async () => {
    server.use(
      http.get(`${BASE}/calendar`, () =>
        HttpResponse.json({ events: [EVENT], occurrences: [] })
      )
    );
    const runtime = createCalendarRuntime({ baseUrl: BASE });
    render(wrap(runtime, <CalendarSkin />));
    expect(screen.getByText(LOADING_COPY)).toBeDefined();
    expect(screen.queryByText(EMPTY_COPY)).toBeNull();
    await waitFor(() => expect(screen.getByTestId("rows")).toBeDefined());
  });

  it("says the range is empty only when the read actually answered empty", async () => {
    server.use(
      http.get(`${BASE}/calendar`, () =>
        HttpResponse.json({ events: [], occurrences: [] })
      )
    );
    const runtime = createCalendarRuntime({ baseUrl: BASE });
    render(wrap(runtime, <CalendarSkin />));
    await waitFor(() => expect(screen.getByText(EMPTY_COPY)).toBeDefined());
  });

  it("shows the failure — and NEVER the empty copy — when the read fails", async () => {
    server.use(
      http.get(`${BASE}/calendar`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.500.internal",
            error: "Calendar is down",
            params: {},
          },
          { status: 500 }
        )
      )
    );
    const runtime = createCalendarRuntime({ baseUrl: BASE });
    render(wrap(runtime, <CalendarSkin />));
    await waitFor(() => expect(screen.getByText(ERROR_COPY)).toBeDefined());
    expect(screen.queryByText(EMPTY_COPY)).toBeNull();
    expect(screen.queryByTestId("rows")).toBeNull();
  });
});
