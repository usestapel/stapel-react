import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type {
  CalendarEvent,
  CalendarRangeParams,
  Occurrence,
} from "../api/types.js";
import { useCalendar } from "../model/queries.js";

/**
 * What a SUCCEEDED range read carries, normalized. The wire marks both arrays
 * optional; inside a load that succeeded an absent key honestly means "nothing
 * of that kind in this range" — which is the empty arm, not a failure.
 */
export interface CalendarRangeData {
  /** Concrete/standalone events overlapping the range. */
  readonly events: readonly CalendarEvent[];
  /** Expanded (virtual + materialized) occurrences of recurring series. */
  readonly occurrences: readonly Occurrence[];
}

/** Render-prop bag for {@link CalendarView}. */
export interface CalendarViewBag {
  /**
   * The range read. ONE state for BOTH lists, deliberately: events and
   * occurrences come out of the same `GET /calendar` body, so two states could
   * never hold different statuses — a grid would just render two spinners and
   * two alerts for one request. Project the list you are drawing:
   * `matchList(mapLoad(state, (r) => r.events), { … })`.
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
 * range (concrete events + expanded series occurrences). Wires
 * {@link useCalendar} and hands a {@link CalendarViewBag} to `children`; bring
 * your own month/week/day grid, skeleton, and empty UI. Zero visual opinion
 * (frontend-standard §2).
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
  const state = mapLoad(
    loadStateFromQuery(query),
    (range): CalendarRangeData => ({
      events: range.events ?? [],
      occurrences: range.occurrences ?? [],
    })
  );
  return props.children({
    state,
    refetch: () => {
      void query.refetch();
    },
  });
}
