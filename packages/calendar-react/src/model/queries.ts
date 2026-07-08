import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  AvailabilityParams,
  AvailabilityResponse,
  CalendarEvent,
  CalendarRangeParams,
  CalendarResponse,
} from "../api/types.js";
import { useCalendarApi } from "./context.js";
import { calendarQueryKeys } from "./queryKeys.js";

/**
 * Read hooks over the calendar API (frontend-standard §2 — read hooks).
 * Staleness follows core's query defaults; override per call site via a page
 * that needs fresher data. Keys are namespaced (see `calendarQueryKeys`). Each
 * hook takes an optional range so a caller can scope a view to a window.
 */

/**
 * The user's calendar over a range — concrete events plus the virtual +
 * materialized occurrences of every series they are on. The primary read for a
 * month/week/day view.
 */
export function useCalendar(
  params?: CalendarRangeParams
): UseQueryResult<CalendarResponse, StapelApiError> {
  const api = useCalendarApi();
  const p = params ?? {};
  return useQuery({
    queryKey: calendarQueryKeys.range(p),
    queryFn: () => api.calendar(p),
  });
}

/**
 * The user's events overlapping a range, as a flat list (no series expansion).
 * For a rendered calendar prefer {@link useCalendar}; this is the list view.
 */
export function useEvents(
  params?: CalendarRangeParams
): UseQueryResult<CalendarEvent[], StapelApiError> {
  const api = useCalendarApi();
  const p = params ?? {};
  return useQuery({
    queryKey: calendarQueryKeys.events(p),
    queryFn: () => api.listEvents(p),
  });
}

/**
 * A single event by id (with its participants + RSVPs). `enabled` is gated on a
 * non-empty id so the hook stays inert until a selection exists.
 */
export function useEvent(
  eventId: string
): UseQueryResult<CalendarEvent, StapelApiError> {
  const api = useCalendarApi();
  return useQuery({
    queryKey: calendarQueryKeys.event(eventId),
    queryFn: () => api.getEvent(eventId),
    enabled: eventId.length > 0,
  });
}

/**
 * Free/busy intervals + open booking slots for the current user over a range —
 * the read behind a "pick a time" scheduler. `slots` is empty when the user has
 * set no availability windows.
 */
export function useAvailability(
  params?: AvailabilityParams
): UseQueryResult<AvailabilityResponse, StapelApiError> {
  const api = useCalendarApi();
  const p = params ?? {};
  return useQuery({
    queryKey: calendarQueryKeys.availability(p),
    queryFn: () => api.availability(p),
  });
}
