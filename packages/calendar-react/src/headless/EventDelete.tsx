import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { CalendarEvent } from "../api/types.js";
import { useDeleteEvent } from "../model/mutations.js";

/** Render-prop bag for {@link EventDelete}. */
export interface EventDeleteBag {
  /** Delete the event (owner-only). Ask first — see the component's docs. */
  remove(): void;
  /** The call is in flight. */
  readonly isDeleting: boolean;
  /** The server's echo of the row after the call, else null. */
  readonly deleted: CalendarEvent | null;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
  reset(): void;
}

/**
 * Headless delete (`DELETE /events/{id}`) — renderless, and deliberately
 * separate from {@link EventEditor}'s `cancel`.
 *
 * ── Delete and cancel are different verbs, and the difference matters ─────
 *
 * On a MATERIALIZED OCCURRENCE the backend's DELETE does not remove the row:
 * it tombstones it (`status=CANCELLED` + `recurrence_id`), precisely so the
 * virtual occurrence at that instant does not resurrect and make the slot busy
 * again. Its own MODULE.md lists "hard-delete a materialized occurrence row"
 * as an anti-pattern for exactly that reason.
 *
 * So a skin must never present this as the same action as
 * {@link EventEditor}'s `cancel`, and must never let it be reached without a
 * confirmation. `@stapel/calendar-react/default`'s `<DeleteEventAction/>`
 * routes it through `SkinConfirm` (a bottom sheet on a phone) with copy that
 * names the consequence.
 */
export function EventDelete(props: {
  eventId: string;
  children: (bag: EventDeleteBag) => ReactNode;
}): ReactNode {
  const { eventId } = props;
  const mutation = useDeleteEvent();
  return props.children({
    remove: () => {
      mutation.mutate(eventId);
    },
    isDeleting: mutation.isPending,
    deleted: mutation.data ?? null,
    isError: mutation.isError,
    error: mutation.error ?? null,
    reset: () => {
      mutation.reset();
    },
  });
}
