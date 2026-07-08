import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createCalendarRuntime } from "../src/model/runtime.js";
import type { CalendarRuntime } from "../src/model/runtime.js";
import { CalendarProvider } from "../src/headless/CalendarProvider.js";
import { CalendarView } from "../src/headless/CalendarView.js";
import { EventComposer } from "../src/headless/EventComposer.js";
import { EventRsvp } from "../src/headless/EventRsvp.js";
import { useCalendar } from "../src/model/queries.js";

/** Base the msw handlers mount on (mirrors stapel-calendar `/calendar/api/`). */
const BASE = "https://calendar.stapel.test/calendar/api";

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
          {({ events }) => <span data-testid="count">{events.length}</span>}
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
