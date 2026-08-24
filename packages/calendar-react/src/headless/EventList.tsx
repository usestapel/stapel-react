import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { CalendarEvent, CalendarRangeParams } from "../api/types.js";
import { useEvents } from "../model/queries.js";

/** Render-prop bag for {@link EventList}. */
export interface EventListBag {
  /**
   * The flat list of the user's events overlapping the range — NO series
   * expansion (that is `GET /calendar`, and {@link CalendarView}). A series
   * master appears once, as itself.
   *
   * An empty agenda is the normal case for a quiet week, which is exactly why
   * the empty arm must be reachable only from a read that ANSWERED: an outage
   * that rendered as "nothing scheduled" is the defect class this shape
   * exists to prevent.
   */
  readonly state: LoadState<readonly CalendarEvent[]>;
  /** Re-read the list for the current range. */
  refetch(): void;
}

/**
 * Headless event list — the renderless read behind an agenda or a list view
 * (`GET /events`). Hands an {@link EventListBag} to `children`.
 *
 * ```tsx
 * <EventList start={dayStart} end={dayEnd}>
 *   {({ state }) => matchList(state, { … })}
 * </EventList>
 * ```
 */
export function EventList(props: {
  start?: string;
  end?: string;
  children: (bag: EventListBag) => ReactNode;
}): ReactNode {
  const params: CalendarRangeParams = {
    ...(props.start !== undefined ? { start: props.start } : {}),
    ...(props.end !== undefined ? { end: props.end } : {}),
  };
  const query = useEvents(params);
  const state = mapLoad(
    loadStateFromQuery(query),
    (events): readonly CalendarEvent[] => events
  );
  return props.children({
    state,
    refetch: () => {
      void query.refetch();
    },
  });
}
