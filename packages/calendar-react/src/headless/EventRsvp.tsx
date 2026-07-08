import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { CalendarEvent, Rsvp } from "../api/types.js";
import { useRespondToEvent } from "../model/mutations.js";

/** Render-prop bag for {@link EventRsvp}. */
export interface EventRsvpBag {
  /** Submit the current user's RSVP (`accepted` / `tentative` / `declined`). */
  respond(rsvp: Rsvp): void;
  /** An RSVP call is in flight. */
  readonly isResponding: boolean;
  /** The updated event echoed by the server after a successful RSVP, else null. */
  readonly event: CalendarEvent | null;
  /** The RSVP call failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Clear the mutation state. */
  reset(): void;
}

/**
 * Headless RSVP control — renderless wrapper over the respond mutation for a
 * single event. Hands an {@link EventRsvpBag} to `children`; bring your own
 * accept/tentative/decline UI. Zero visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <EventRsvp eventId={event.id}>
 *   {({ respond, isResponding }) => ( ... )}
 * </EventRsvp>
 * ```
 */
export function EventRsvp(props: {
  eventId: string;
  children: (bag: EventRsvpBag) => ReactNode;
}): ReactNode {
  const { eventId } = props;
  const mutation = useRespondToEvent();
  return props.children({
    respond: (rsvp) => {
      mutation.mutate({ eventId, rsvp });
    },
    isResponding: mutation.isPending,
    event: mutation.data ?? null,
    isError: mutation.isError,
    error: mutation.error ?? null,
    reset: () => {
      mutation.reset();
    },
  });
}
