import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type {
  CalendarEvent,
  CalendarRangeParams,
  Occurrence,
} from "../api/types.js";
import { useCalendar } from "../model/queries.js";

/** Render-prop bag for {@link CalendarView}. */
export interface CalendarViewBag {
  /** Concrete/standalone events overlapping the range. */
  readonly events: readonly CalendarEvent[];
  /** Expanded (virtual + materialized) occurrences of recurring series. */
  readonly occurrences: readonly Occurrence[];
  /** The range read is loading (no data yet). */
  readonly isLoading: boolean;
  /** The query failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
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
 *   {({ events, occurrences }) => ( ... )}
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
  return props.children({
    events: query.data?.events ?? [],
    occurrences: query.data?.occurrences ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch();
    },
  });
}
