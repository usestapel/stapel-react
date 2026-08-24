/**
 * Telling the workspace-mandate refusals apart from a plain "no".
 *
 * ── The drift that made this necessary ────────────────────────────────────
 *
 * stapel-calendar moved `GET/PATCH/DELETE /events/{id}` and the `.ics` export
 * from `IsAuthenticated` onto **`HasWorkspaceMandateIfScoped`**, and
 * `PUT …/participants` + `POST …/respond` onto `IsNotAnonymousUser`. Nothing
 * about the RESPONSE BODIES changed, so the schema diff is empty and the drift
 * gate is silent — but a new refusal class exists: a signed-in person who is
 * not in the event's workspace now gets a 403, and when the mandate service
 * itself is down they get `error.503.mandate_unavailable`.
 *
 * Those two are not the same sentence and must not render as one:
 *
 *  - **403** — we asked, and the answer is no. "This calendar belongs to a
 *    workspace you're not a member of."
 *  - **503** — we could not ask. "We couldn't check your workspace access just
 *    now. Try again in a moment." A retry is the right control; a denial is
 *    not the right words. Rendering "we could not ask" as "you may not" is the
 *    same lie as rendering a failed load as an empty list.
 */
import { errorCode, errorStatus } from "@stapel/core";

/** The mandate service could not answer — a WAIT, never a denial. */
export function isMandateUnavailable(error: unknown): boolean {
  return errorCode(error) === "error.503.mandate_unavailable";
}

/**
 * A refusal that, on this module's endpoints, means the caller has no mandate
 * for the event's workspace.
 *
 * `error.403.forbidden` is the generic code `HasWorkspaceMandateIfScoped`
 * raises; `error.403.calendar_not_event_owner` is the narrower, owner-only
 * refusal and is deliberately NOT folded in here — it has its own sentence
 * and its own remediation.
 */
export function isMandateDenied(error: unknown): boolean {
  return errorStatus(error) === 403 && errorCode(error) === "error.403.forbidden";
}

/** The event is gone (or was never visible to this caller). */
export function isEventNotFound(error: unknown): boolean {
  return errorCode(error) === "error.404.calendar_event_not_found";
}
