import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { CalendarEvent, EventUpdateRequest } from "../api/types.js";
import { useUpdateEvent } from "../model/mutations.js";

/** Render-prop bag for {@link EventEditor}. */
export interface EventEditorBag {
  /** Apply a partial patch (owner-only, PATCH). */
  save(patch: EventUpdateRequest): void;
  /**
   * Cancel the event — `status: "cancelled"`.
   *
   * This is NOT delete, and a skin must not spell it as one. On a materialized
   * occurrence a cancel is a TOMBSTONE: the instant stops appearing in
   * expansions and in free/busy, and it cannot resurrect. The row survives so
   * the invitees can see that the meeting was called off, which is the whole
   * difference between "cancelled" and "gone".
   */
  cancel(): void;
  /** A save or cancel call is in flight. */
  readonly isSaving: boolean;
  /** The updated event echoed by the server, else null. */
  readonly saved: CalendarEvent | null;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
  reset(): void;
}

/**
 * Headless event editor — the renderless half of "change this event"
 * (`PATCH /events/{id}`), including the CANCEL arm.
 *
 * Editing any recurrence field of a series master re-specifies the whole rule:
 * the backend stores only the canonical RRULE, so it cannot merge constituent
 * inputs. Send the COMPLETE recurrence spec, exactly as for create —
 * `model/recurrence.ts`'s `recurrenceEndPatch` builds one.
 *
 * ```tsx
 * <EventEditor eventId={event.id}>
 *   {({ save, cancel, isSaving }) => ( ... )}
 * </EventEditor>
 * ```
 */
export function EventEditor(props: {
  eventId: string;
  children: (bag: EventEditorBag) => ReactNode;
}): ReactNode {
  const { eventId } = props;
  const mutation = useUpdateEvent();
  return props.children({
    save: (patch) => {
      mutation.mutate({ eventId, patch });
    },
    cancel: () => {
      mutation.mutate({ eventId, patch: { status: "cancelled" } });
    },
    isSaving: mutation.isPending,
    saved: mutation.data ?? null,
    isError: mutation.isError,
    error: mutation.error ?? null,
    reset: () => {
      mutation.reset();
    },
  });
}
