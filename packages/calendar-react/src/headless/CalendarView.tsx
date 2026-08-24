import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { CalendarRangeParams } from "../api/types.js";
import { dedupeCalendarRange } from "../model/occurrences.js";
import type { DedupedRange } from "../model/occurrences.js";
import { useCalendar } from "../model/queries.js";

/**
 * What a SUCCEEDED range read carries, normalized and DEDUPED.
 *
 * The wire marks both arrays optional; inside a load that succeeded an absent
 * key honestly means "nothing of that kind in this range" — which is the empty
 * arm, not a failure.
 *
 * `instances` is the list a grid draws: every drawable instant exactly once,
 * per the module's `occurrences[].materialized_id == events[].id` rule
 * (`model/occurrences.ts` carries the rule and the reasoning). `events` and
 * `occurrences` remain available for a host that wants the raw halves, and
 * `cancelled` is the tombstone arm — shown struck through, never dropped.
 */
export type CalendarRangeData = DedupedRange;

/** Render-prop bag for {@link CalendarView}. */
export interface CalendarViewBag {
  /**
   * The range read. ONE state for BOTH lists, deliberately: events and
   * occurrences come out of the same `GET /calendar` body, so two states could
   * never hold different statuses — a grid would just render two spinners and
   * two alerts for one request. Project the list you are drawing:
   * `matchList(mapLoad(state, (r) => r.instances), { … })`.
   *
   * An empty grid is the NORMAL case for a calendar, which is exactly what
   * makes a failed read invisible when it renders as one. Only the `empty` arm
   * of `matchList` may say "nothing scheduled", and it is reachable only from
   * a read that answered.
   */
  readonly state: LoadState<CalendarRangeData>;
  /** Re-read the calendar for the current range. */
  refetch(): void;
}

/**
 * Headless calendar view — a renderless read of the user's calendar over a
 * range (concrete events + expanded series occurrences), with the module's
 * required dedup already applied. Wires {@link useCalendar} and hands a
 * {@link CalendarViewBag} to `children`; bring your own month/week/day grid,
 * skeleton, and empty UI — or render `@stapel/calendar-react/default`'s
 * `<Calendar/>`, which is this component with the grid attached.
 *
 * ```tsx
 * <CalendarView start={weekStart} end={weekEnd}>
 *   {({ state }) => ( ... )}
 * </CalendarView>
 * ```
 */
export function CalendarView(props: {
  start?: string;
  end?: string;
  children: (bag: CalendarViewBag) => ReactNode;
}): ReactNode {
  const params: CalendarRangeParams = {
    ...(props.start !== undefined ? { start: props.start } : {}),
    ...(props.end !== undefined ? { end: props.end } : {}),
  };
  const query = useCalendar(params);
  const state = mapLoad(loadStateFromQuery(query), (range) =>
    dedupeCalendarRange(range.events ?? [], range.occurrences ?? [])
  );
  return props.children({
    state,
    refetch: () => {
      void query.refetch();
    },
  });
}
