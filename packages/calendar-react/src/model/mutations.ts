import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type { CalendarEvent, EventCreateRequest, Rsvp } from "../api/types.js";
import { useCalendarApi } from "./context.js";
import { calendarQueryKeys } from "./queryKeys.js";

/**
 * Write hooks (frontend-standard §2 — "мутации с инвалидацией"). Every calendar
 * write can shift more than one cached read (a new event lands in the range
 * calendar AND the event list AND availability; an RSVP changes an event's
 * participants), so each mutation invalidates the module root
 * (`calendarQueryKeys.all`) on success rather than guessing which windows
 * overlap. A host that wants optimistic updates layers them on the returned
 * mutation.
 *
 * Options are built as typed `UseMutationOptions` objects (not call-site
 * generics) so `void`/error types stay in reference position, which
 * `no-invalid-void-type` permits.
 */

/** Variables for {@link useRespondToEvent}. */
export interface RespondVariables {
  readonly eventId: string;
  readonly rsvp: Rsvp;
}

/** Create an event (optionally a recurring series) — returns the created event. */
export function useCreateEvent(): UseMutationResult<
  CalendarEvent,
  StapelApiError,
  EventCreateRequest
> {
  const api = useCalendarApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    CalendarEvent,
    StapelApiError,
    EventCreateRequest
  > = {
    mutationFn: (body) => api.createEvent(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
    },
  };
  return useMutation(options);
}

/** Cancel/delete an event by id (owner-only) — returns the updated event. */
export function useDeleteEvent(): UseMutationResult<
  CalendarEvent,
  StapelApiError,
  string
> {
  const api = useCalendarApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<CalendarEvent, StapelApiError, string> = {
    mutationFn: (eventId) => api.deleteEvent(eventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
    },
  };
  return useMutation(options);
}

/** Record the current user's RSVP to an event — returns the updated event. */
export function useRespondToEvent(): UseMutationResult<
  CalendarEvent,
  StapelApiError,
  RespondVariables
> {
  const api = useCalendarApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    CalendarEvent,
    StapelApiError,
    RespondVariables
  > = {
    mutationFn: (vars) => api.respond(vars.eventId, vars.rsvp),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
    },
  };
  return useMutation(options);
}
