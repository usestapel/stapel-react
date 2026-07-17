import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
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
 *
 * The top-level "the user's …" hooks below (`useCalendar`/`useEvents`/
 * `useAvailability`) gate on {@link useActiveSessionReady} (owner-diagnosed
 * live incident, 2026-07-17): none has a natural `enabled` condition of its
 * own, which is exactly the hook shape that raced a still-bootstrapping
 * session and read a live one as "expired" — zero manual `enabled` wiring
 * needed at the call site by design.
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
  const sessionReady = useActiveSessionReady();
  const p = params ?? {};
  return useQuery({
    queryKey: calendarQueryKeys.range(p),
    queryFn: () => api.calendar(p),
    enabled: sessionReady,
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
  const sessionReady = useActiveSessionReady();
  const p = params ?? {};
  return useQuery({
    queryKey: calendarQueryKeys.events(p),
    queryFn: () => api.listEvents(p),
    enabled: sessionReady,
  });
}

/**
 * A single event by id (with its participants + RSVPs). `enabled` is gated on
 * a non-empty id (so the hook stays inert until a selection exists) AND
 * session readiness — an id can be known synchronously (e.g. a URL param)
 * before the session has finished bootstrapping.
 */
export function useEvent(
  eventId: string
): UseQueryResult<CalendarEvent, StapelApiError> {
  const api = useCalendarApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: calendarQueryKeys.event(eventId),
    queryFn: () => api.getEvent(eventId),
    enabled: sessionReady && eventId.length > 0,
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
  const sessionReady = useActiveSessionReady();
  const p = params ?? {};
  return useQuery({
    queryKey: calendarQueryKeys.availability(p),
    queryFn: () => api.availability(p),
    enabled: sessionReady,
  });
}
