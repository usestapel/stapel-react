import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type {
  AvailabilityParams,
  AvailabilityResponse,
  CalendarEvent,
  CalendarRangeParams,
  CalendarResponse,
  EventCreateRequest,
  EventUpdateRequest,
  ParticipantsReplaceRequest,
  Rsvp,
} from "./types.js";

/**
 * CSRF rule for cookie-authenticated browser clients (mirrors the other pairs):
 * the simplest SPA rule is to always send `X-Requested-With: XMLHttpRequest` on
 * mutating requests. Header-token clients ignore it; it is harmless there, so
 * every mutation carries it. stapel-calendar authenticates via the `stapel_jwt`
 * cookie (see the contract's `JWTCookieAuth`), so a browser host must build its
 * runtime with `credentials: "include"` for a cross-origin API.
 */
const CSRF_HEADERS: Record<string, string> = {
  "X-Requested-With": "XMLHttpRequest",
};

function mutating(
  options?: Omit<StapelRequestOptions, "method" | "body">
): Omit<StapelRequestOptions, "method" | "body"> {
  return {
    ...options,
    headers: { ...CSRF_HEADERS, ...options?.headers },
  };
}

/** Build the range query only from the params that were actually provided. */
function rangeQuery(
  params?: CalendarRangeParams
): Record<string, string> {
  const query: Record<string, string> = {};
  if (params?.start !== undefined) query.start = params.start;
  if (params?.end !== undefined) query.end = params.end;
  return query;
}

/**
 * The pair's typed operation surface — one method per stapel-calendar endpoint a
 * JS client may call, bound to the injected {@link StapelClient} (the per-module
 * override seam of frontend-standard §7.2). Paths are relative to the runtime's
 * `baseUrl` (e.g. `/calendar/api/v1/`).
 *
 * These operations are hand-authored here — the ONE legal home of path strings
 * (`stapel/no-string-paths` §2.3 carve-out) — until gen-api v2 emits typed ops
 * from operationIds (task `core-typed-ops`). The `.ics` export is a
 * browser-download URL, not a JSON body, so it lives in `api/extensions.ts`.
 */
export interface CalendarApi {
  readonly client: StapelClient;

  /** Free/busy intervals + open booking slots for the current user over a range. */
  availability(params?: AvailabilityParams): Promise<AvailabilityResponse>;
  /** The user's calendar over a range: concrete events + expanded occurrences. */
  calendar(params?: CalendarRangeParams): Promise<CalendarResponse>;
  /** List the user's events overlapping a range. */
  listEvents(params?: CalendarRangeParams): Promise<CalendarEvent[]>;
  /** Create an event (optionally a recurring series); resolves to the 201 body. */
  createEvent(body: EventCreateRequest): Promise<CalendarEvent>;
  /** Retrieve a single event by id. */
  getEvent(eventId: string): Promise<CalendarEvent>;
  /** Partially update an event (owner-only, PATCH); resolves to the updated event. */
  updateEvent(
    eventId: string,
    body: EventUpdateRequest
  ): Promise<CalendarEvent>;
  /**
   * Replace an event's participant set (owner-only, PUT, replace-set semantics);
   * resolves to the updated event.
   */
  replaceParticipants(
    eventId: string,
    body: ParticipantsReplaceRequest
  ): Promise<CalendarEvent>;
  /** Cancel/delete an event (owner-only); resolves to the updated event. */
  deleteEvent(eventId: string): Promise<CalendarEvent>;
  /** Record the current user's RSVP to an event; resolves to the updated event. */
  respond(eventId: string, rsvp: Rsvp): Promise<CalendarEvent>;
}

export function createCalendarApi(client: StapelClient): CalendarApi {
  const eventPath = (eventId: string): string =>
    `/events/${encodeURIComponent(eventId)}`;

  return {
    client,

    availability: (params) => {
      const query = rangeQuery(params);
      if (params?.slotMinutes !== undefined) {
        query.slot_minutes = String(params.slotMinutes);
      }
      return client.get("/availability", { query });
    },

    calendar: (params) => client.get("/calendar", { query: rangeQuery(params) }),

    listEvents: (params) => client.get("/events", { query: rangeQuery(params) }),

    createEvent: (body) => client.post("/events", body, mutating()),

    getEvent: (eventId) => client.get(eventPath(eventId)),

    updateEvent: (eventId, body) =>
      client.patch(eventPath(eventId), body, mutating()),

    replaceParticipants: (eventId, body) =>
      client.put(`${eventPath(eventId)}/participants`, body, mutating()),

    deleteEvent: (eventId) => client.delete(eventPath(eventId), mutating()),

    respond: (eventId, rsvp) =>
      client.post(`${eventPath(eventId)}/respond`, { rsvp }, mutating()),
  };
}
