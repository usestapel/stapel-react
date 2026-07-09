/**
 * Wire types for the stapel-calendar HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained.
 *
 * §17-native per-module contract: stapel-calendar is NOT part of the unified
 * monolith schema — it emits its OWN `docs/schema.json` (schema.json / flows.json
 * / errors.json). So, unlike the pairs that alias `@stapel/core`'s shared
 * `components`, this pair generates a package-LOCAL schema module (`pnpm gen:api`
 * with `API_SCHEMA=../stapel-calendar/docs/schema.json` + `API_OUT` pointing here)
 * and aliases the schemas it uses from `./generated/schema.js`. Do NOT write
 * parallel response bodies; where drf-spectacular + openapi-typescript
 * under-describe the runtime, apply a small documented correction below.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

// ── aliases (the stapel-calendar schemas this pair uses) ──────────────────────

/** A calendar event — a series master or a concrete occurrence. */
export type CalendarEvent = Schemas["EventResponse"];
/** POST /events request body — create an event (optionally a recurring series). */
export type EventCreateRequest = Schemas["EventCreateRequest"];
/**
 * PATCH /events/{id} request body — partially update an event (every field
 * optional; only the fields present are changed). Editing any recurrence field
 * of a series master re-specifies the whole rule — send the COMPLETE recurrence
 * spec, exactly as for create (the backend stores only the canonical RRULE).
 */
export type EventUpdateRequest = Schemas["PatchedEventUpdateRequest"];
/**
 * PUT /events/{id}/participants request body — replace-set semantics: the
 * `participant_ids` array is the COMPLETE desired invitee list (the owner is
 * always kept). Absent invitees are removed; new ids are invited.
 */
export type ParticipantsReplaceRequest = Schemas["ParticipantsReplaceRequest"];
/** GET /calendar 200 body — concrete events + expanded series occurrences. */
export type CalendarResponse = Schemas["CalendarResponse"];
/** A single (possibly virtual) instance of a recurring event. */
export type Occurrence = Schemas["OccurrenceResponse"];
/** GET /availability 200 body — free/busy intervals + open booking slots. */
export type AvailabilityResponse = Schemas["AvailabilityResponse"];
/** A `{ start, end }` time interval (busy block or open slot). */
export type Interval = Schemas["IntervalResponse"];
/** An invitee and their RSVP on an event. */
export type Participant = Schemas["ParticipantResponse"];

// ── documented corrections (drf-spectacular under-describes) ──────────────────

/**
 * The RSVP a user may submit. The generated `RSVPRequest.rsvp` is a bare
 * `string`, but the backend (`error.400.calendar_invalid_rsvp`) constrains a
 * SUBMITTED response to exactly these three values. `"invited"` is a server-set
 * initial state, never something a user sends — see {@link ParticipantRsvp}.
 */
export type Rsvp = "accepted" | "tentative" | "declined";

/**
 * A participant's RSVP as READ back on an event: the three submittable states
 * plus the server-set initial `"invited"` (`ParticipantResponse.rsvp`, typed
 * bare `string` by the generator).
 */
export type ParticipantRsvp = "invited" | Rsvp;

/**
 * An event's lifecycle status (`EventResponse.status`, typed bare `string`).
 * Narrowed to the values the backend sets so call sites can branch exhaustively.
 */
export type EventStatus = "confirmed" | "tentative" | "cancelled";

/**
 * The human recurrence preset used to build an event's RRULE
 * (`recurrence_type`, typed bare `string`). `"custom"` pairs with
 * `recurrence_weekdays`; the rest are self-describing presets.
 */
export type RecurrenceType =
  | "none"
  | "daily"
  | "weekdays"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "custom";

/**
 * Range query for the read endpoints (`GET /calendar`, `/events`,
 * `/availability`). drf-spectacular does not describe these query params, but
 * every read is "over a range" (see the endpoint descriptions and
 * `error.400.calendar_invalid_range`): `start`/`end` are tz-aware ISO 8601
 * bounds. All optional — the backend applies its own default window when
 * omitted.
 */
export interface CalendarRangeParams {
  /** Range start (tz-aware ISO 8601); omit for the backend default window. */
  readonly start?: string;
  /** Range end (tz-aware ISO 8601); omit for the backend default window. */
  readonly end?: string;
}

/**
 * Query for `GET /availability`: a {@link CalendarRangeParams} range plus the
 * slot granularity. `slot_minutes` is under-described by the generator but
 * constrained to a positive integer (`error.400.calendar_invalid_slot_minutes`).
 */
export interface AvailabilityParams extends CalendarRangeParams {
  /** Open-slot granularity in minutes (positive integer). */
  readonly slotMinutes?: number;
}
