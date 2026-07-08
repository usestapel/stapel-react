import type { AvailabilityParams, CalendarRangeParams } from "../api/types.js";

/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "ключи неймспейснуты").
 * Everything under the `"calendar"` root so a host can invalidate the whole
 * module or match a single resource. Persist scope is per-user via core's query
 * runtime (`setPersistUser`). Explicit tuple return types satisfy
 * `--isolatedDeclarations`. One entry per read-operation.
 *
 * Mutations invalidate `all` (the whole module) rather than a narrow key: a
 * created/cancelled event or a fresh RSVP can shift the range calendar, the
 * event lists, and availability at once, so the broad invalidation keeps every
 * cached read honest without the pair guessing which windows overlap.
 */
const ROOT = "calendar" as const;

export const calendarQueryKeys: {
  readonly all: readonly ["calendar"];
  availability(
    params: AvailabilityParams
  ): readonly ["calendar", "availability", AvailabilityParams];
  range(
    params: CalendarRangeParams
  ): readonly ["calendar", "range", CalendarRangeParams];
  events(
    params: CalendarRangeParams
  ): readonly ["calendar", "events", CalendarRangeParams];
  event(eventId: string): readonly ["calendar", "event", string];
} = {
  all: [ROOT],
  availability: (params) => [ROOT, "availability", params],
  // `range` = the aggregate GET /calendar view (events + occurrences), kept
  // distinct from the flat GET /events list under `events`.
  range: (params) => [ROOT, "range", params],
  events: (params) => [ROOT, "events", params],
  event: (eventId) => [ROOT, "event", eventId],
};
