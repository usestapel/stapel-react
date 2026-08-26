/**
 * The PRODUCT: the wired calendar screen, drawn from `src/default`.
 *
 * Every variant is seeded at a state the static render actually reaches, so the
 * showcase photographs four different screens rather than the same idle frame
 * under four names. The `truncated` / degraded cases live in the availability
 * demo; this one covers the range read's four arms and the phone degradation.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { Calendar, CalendarAgenda, CalendarMonthGrid } from "../src/default/index.js";
import { calendarQueryKeys, dedupeCalendarRange, viewRange } from "../src/index.js";
import type { CalendarViewMode } from "../src/index.js";
import { CalendarDemoHarness, demoApiError } from "./_harness.js";
import type { DemoSeed } from "./_harness.js";

const ANCHOR = "2026-07-13T09:00:00Z";

/**
 * A canned range. It contains the exact shape the wire contract warns about:
 * `e-materialized` is BOTH a row in `events[]` and the `materialized_id` of an
 * entry in `occurrences[]`. A client without the dedup draws it twice; the
 * shot is the proof that this one does not.
 */
const RANGE = {
  events: [
    {
      id: "e-standalone",
      title: "Design review",
      description: "Weekly sync on the new booking flow.",
      start: "2026-07-13T10:00:00Z",
      end: "2026-07-13T11:00:00Z",
      owner_id: "u-1",
      scope_key: "ws-1",
      status: "confirmed",
      recurrence_type: "none",
      rrule: "",
      participants: [],
    },
    {
      id: "e-materialized",
      title: "Stand-up",
      description: "",
      start: "2026-07-14T09:00:00Z",
      end: "2026-07-14T09:15:00Z",
      owner_id: "u-1",
      scope_key: "ws-1",
      status: "confirmed",
      recurrence_type: "none",
      rrule: "",
      recurrence_parent_id: "series-1",
      participants: [],
    },
    {
      id: "e-cancelled",
      title: "Roadmap workshop",
      description: "",
      start: "2026-07-16T13:00:00Z",
      end: "2026-07-16T14:00:00Z",
      owner_id: "u-1",
      scope_key: "ws-1",
      status: "cancelled",
      recurrence_type: "none",
      rrule: "",
      participants: [],
    },
  ],
  occurrences: [
    {
      event_id: "series-1",
      start: "2026-07-14T09:00:00Z",
      end: "2026-07-14T09:15:00Z",
      is_materialized: true,
      materialized_id: "e-materialized",
    },
    {
      event_id: "series-1",
      start: "2026-07-15T09:00:00Z",
      end: "2026-07-15T09:15:00Z",
      is_materialized: false,
    },
  ],
};

const EMPTY_RANGE = { events: [], occurrences: [] };

/**
 * The range read this screen opens on, already answered.
 *
 * The window is the view's own (`viewRange`), so the seed lands on the exact
 * key the screen asks for — a canned `fetch` would only paint after a round
 * trip the shot runner never waits for.
 */
function seedRange(view: CalendarViewMode, body: unknown): DemoSeed {
  return [{ key: calendarQueryKeys.range(viewRange(view, ANCHOR)), data: body }];
}

function Screen(props: {
  readonly seed: DemoSeed;
  readonly view?: "month" | "week" | "day";
}): ReactElement {
  return (
    <CalendarDemoHarness seed={props.seed}>
      <Calendar
        defaultAnchor={ANCHOR}
        defaultView={props.view ?? "month"}
        viewerId="u-1"
        baseUrl="https://calendar.demo.stapel.dev/calendar/api/v1/"
      />
    </CalendarDemoHarness>
  );
}

/** The grid and the agenda on their own, over the same deduped instants — the
 * two halves `<Calendar>` switches between, drawn without a request. */
const INSTANCES = dedupeCalendarRange(RANGE.events, RANGE.occurrences).instances;

function Parts(props: { readonly part: "grid" | "agenda" }): ReactElement {
  return (
    <CalendarDemoHarness>
      {props.part === "grid" ? (
        <CalendarMonthGrid
          days={[
            "2026-07-13T00:00:00Z",
            "2026-07-14T00:00:00Z",
            "2026-07-15T00:00:00Z",
            "2026-07-16T00:00:00Z",
            "2026-07-17T00:00:00Z",
            "2026-07-18T00:00:00Z",
            "2026-07-19T00:00:00Z",
          ]}
          anchor={ANCHOR}
          instances={INSTANCES}
        />
      ) : (
        <CalendarAgenda instances={INSTANCES} />
      )}
    </CalendarDemoHarness>
  );
}

export default defineDemo({
  id: "calendar.screen",
  title: "Calendar",
  description:
    "The wired month/week/day screen. The canned range deliberately contains a materialized occurrence in BOTH events[] and occurrences[] — the duplicate the module's contract warns about — plus a cancelled row, so the shot proves the dedup and the tombstone arm rather than asserting them. Below the grid's minimum element width it becomes the agenda; the geometry is the box's, never the viewport's.",
  component: Calendar,
  covers: [
    "CalendarMonthGrid",
    "CalendarAgenda",
    "CalendarProvider",
    "CalendarView",
    "EventList",
  ],
  tokens: ["surface-raised", "border-subtle", "brand"],
  variants: {
    month: {
      description: "Desktop month grid: a standalone event, a materialized occurrence drawn once, a virtual instance, a cancelled row struck through.",
      viewport: "desktop",
      step: "ready.month",
      render: () => <Screen seed={seedRange("month", RANGE)} />,
    },
    "agenda-phone": {
      description: "A phone: the same deduped instants as a day-grouped agenda. No sideways scroll, no six-week grid squeezed into 390px.",
      viewport: "phone",
      step: "ready.agenda",
      render: () => <Screen seed={seedRange("day", RANGE)} view="day" />,
    },
    empty: {
      description: "A quiet month — reachable only from a read that ANSWERED, with the way to fill it beside the sentence.",
      viewport: "phone",
      step: "empty",
      render: () => <Screen seed={seedRange("month", EMPTY_RANGE)} />,
    },
    "grid-only": {
      description: "The grid alone: one week of cells over the deduped instants — the materialized occurrence appears once.",
      viewport: "phone",
      step: "parts.grid",
      render: () => <Parts part="grid" />,
    },
    "agenda-only": {
      description: "The agenda alone, over the same instants — the row shape a phone gets.",
      viewport: "phone",
      step: "parts.agenda",
      render: () => <Parts part="agenda" />,
    },
    failed: {
      description: "The range read failed. An outage renders as an outage with a retry, never as an empty calendar.",
      viewport: "desktop",
      step: "failed",
      render: () => (
        <Screen
          seed={[
            {
              key: calendarQueryKeys.range(viewRange("month", ANCHOR)),
              error: demoApiError(
                503,
                "error.503.mandate_unavailable",
                "mandate service unavailable"
              ),
            },
          ]}
        />
      ),
    },
  },
});
