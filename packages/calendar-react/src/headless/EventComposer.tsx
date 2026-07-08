import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { CalendarEvent, EventCreateRequest } from "../api/types.js";
import { useCreateEvent } from "../model/mutations.js";

/** Render-prop bag for {@link EventComposer}. */
export interface EventComposerBag {
  /** Create an event (optionally a recurring series). */
  create(body: EventCreateRequest): void;
  /** A create call is in flight. */
  readonly isCreating: boolean;
  /** The created event echoed by the server, else null. */
  readonly created: CalendarEvent | null;
  /** The create call failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Clear the mutation state (e.g. to compose another event). */
  reset(): void;
}

/**
 * Headless event composer — renderless wrapper over the create-event mutation.
 * Hands an {@link EventComposerBag} to `children`; bring your own form (title,
 * start/end pickers, recurrence, invitees). Zero visual opinion
 * (frontend-standard §2). On success the pair invalidates the calendar reads,
 * so an open `<CalendarView>` refreshes without extra wiring.
 *
 * ```tsx
 * <EventComposer>
 *   {({ create, isCreating }) => ( ... )}
 * </EventComposer>
 * ```
 */
export function EventComposer(props: {
  children: (bag: EventComposerBag) => ReactNode;
}): ReactNode {
  const mutation = useCreateEvent();
  return props.children({
    create: (body) => {
      mutation.mutate(body);
    },
    isCreating: mutation.isPending,
    created: mutation.data ?? null,
    isError: mutation.isError,
    error: mutation.error ?? null,
    reset: () => {
      mutation.reset();
    },
  });
}
