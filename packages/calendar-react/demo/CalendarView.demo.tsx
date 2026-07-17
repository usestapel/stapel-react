/** Calendar view — headless read of the user's calendar over a range. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { CalendarView } from "../src/index.js";
import type { CalendarEvent } from "../src/index.js";
import { CalendarDemoHarness, DemoCard } from "./_harness.js";

/** A canned calendar page — two concrete events, no series occurrences. */
const CALENDAR_PAGE = {
  events: [
    {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Design review",
      description: "Weekly sync on the new booking flow.",
      start: "2026-07-13T10:00:00Z",
      end: "2026-07-13T10:30:00Z",
      owner_id: "u-1",
      scope_key: "ws-1",
      status: "confirmed",
      recurrence_type: "none",
      rrule: "",
      participants: [],
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      title: "1:1 with Sam",
      description: "",
      start: "2026-07-14T15:00:00Z",
      end: "2026-07-14T15:30:00Z",
      owner_id: "u-1",
      scope_key: "ws-1",
      status: "tentative",
      recurrence_type: "weekly",
      rrule: "FREQ=WEEKLY;BYDAY=TU",
      participants: [],
    },
  ],
  occurrences: [],
};

function EventRow(props: { event: CalendarEvent }): ReactElement {
  return (
    <li
      style={{
        listStyle: "none",
        padding: `${spacing["2"]}px 0`,
        borderTop: `1px solid ${cssVar("border-subtle")}`,
      }}
    >
      <strong style={{ fontSize: fontSize.md.fontSize }}>
        {props.event.title}
      </strong>
      <div style={{ color: cssVar("text-muted") }}>
        {props.event.start}
      </div>
    </li>
  );
}

/** The view body — mounted INSIDE the harness, so `useT`/hooks have providers. */
function CalendarViewBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="CalendarView">
      <CalendarView>
        {({ events, isLoading }) => {
          if (isLoading) {
            return (
              <span style={{ color: cssVar("text-muted") }}>
                {t("calendar.view.loading")}
              </span>
            );
          }
          if (events.length === 0) {
            return (
              <span style={{ color: cssVar("text-muted") }}>
                {t("calendar.view.empty")}
              </span>
            );
          }
          return (
            <ul style={{ margin: 0, padding: 0, borderRadius: radii.sm }}>
              {events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ul>
          );
        }}
      </CalendarView>
    </DemoCard>
  );
}

function CalendarViewDemo(): ReactElement {
  return (
    <CalendarDemoHarness handlers={{ "/calendar": CALENDAR_PAGE }}>
      <CalendarViewBody />
    </CalendarDemoHarness>
  );
}

/**
 * Demonstrates the headless calendar read: the canned handler returns two
 * concrete events (no series occurrences), so the list renders. Swap the
 * handler for a `[500, …]` tuple to exercise the error branch, or add
 * `occurrences` to show expanded recurring instances. Bring your own grid — the
 * component is renderless.
 */
export default defineDemo({
  id: "calendar.view",
  title: "Calendar view",
  description:
    "The headless CalendarView reads the user's events + expanded series occurrences over a range. Bring your own month/week/day grid — the component is renderless.",
  component: CalendarView,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <CalendarViewDemo /> },
  },
});
