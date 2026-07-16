/**
 * Hand-authored API surface the codegen does not (yet) cover — browser-download
 * URL builders, narrow domain type-guards, header conventions. Everything that
 * CAN be derived from schema.json belongs in the generated operations
 * (`api/calendarApi.ts`), not here.
 */
import type { ParticipantRsvp, Rsvp } from "./types.js";

/**
 * Absolute URL for the RFC 5545 `.ics` export of an event
 * (`GET /events/{id}/ics`). This endpoint returns a file, not a JSON body, so
 * the natural client surface is a URL you point an `<a download>` / `window.open`
 * at rather than a fetch you parse — the browser streams the download and sends
 * the `stapel_jwt` cookie itself. `baseUrl` is the runtime's base (e.g.
 * `/calendar/api/v1/` or `https://app.example.com/calendar/api/v1/`).
 *
 * ```tsx
 * <a href={eventIcsUrl(runtime.client.baseUrl, event.id)} download>Add to calendar</a>
 * ```
 */
export function eventIcsUrl(baseUrl: string, eventId: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}/events/${encodeURIComponent(eventId)}/ics`;
}

/** The RSVP states a user may submit (excludes the server-set `"invited"`). */
const SUBMITTABLE_RSVP: readonly Rsvp[] = ["accepted", "tentative", "declined"];

/**
 * Type-guard: is a raw participant RSVP one a USER can submit? Useful for
 * gating an RSVP control (`"invited"` is a server-set initial state, never a
 * user choice). Narrows `ParticipantRsvp` to {@link Rsvp}.
 */
export function isSubmittableRsvp(rsvp: ParticipantRsvp): rsvp is Rsvp {
  return (SUBMITTABLE_RSVP as readonly string[]).includes(rsvp);
}
