/**
 * The refusals this pair has to tell apart, and the reason every one of them
 * is read by CODE and never by status.
 *
 * | status | code                            | what it actually means             |
 * |--------|---------------------------------|------------------------------------|
 * | 400    | `alerts_status_not_settable`    | the store asserts that status, not you |
 * | 401    | `unauthorized`                  | no session reached the tracker     |
 * | 403    | `forbidden`                     | signed in, but not staff           |
 * | 404    | `alerts_issue_not_found`        | no issue with that id              |
 *
 * ── The 403 is the whole authorization story, and it is not a fault ───────
 *
 * Every tracker route is `IsStaffUser`. The nav axis has two values
 * (`public` | `member`) and cannot say "staff", so the SCREEN says it: the
 * door stays visible and the pane names the refusal
 * ({@link isAlertsStaffOnly}) rather than drawing an empty triage table at
 * somebody signed in with the wrong account. A hidden door teaches nobody
 * anything; an empty table teaches the wrong thing — "nothing is broken".
 *
 * ── The 401 and the 403 are different sentences ───────────────────────────
 *
 * A 401 is "sign in"; a 403 is "you are signed in as the wrong person". The
 * raw conditional reads (`api/alertsApi.ts`) do not run core's bearer-refresh
 * retry, so a 401 on a read is also the shape an expired token takes here —
 * which is exactly the case where "sign in again" is the right copy and
 * "you do not have permission" is a lie.
 *
 * ── The 400 is the store refusing to be told what it observed ─────────────
 *
 * `regressed` is not a settable status (`serializers.SETTABLE_STATUSES`).
 * Nothing in this pair offers it — {@link SETTABLE_ISSUE_STATUSES} is the list
 * every control is built from — so {@link isStatusNotSettable} exists for the
 * host that wired its own control, and for the day the backend narrows the set
 * further. A refusal nobody can provoke from our own UI is still a refusal the
 * UI must be able to render.
 */
import { isErrorCode, toFlowError } from "@stapel/core";
import type { FlowError } from "@stapel/core";

/** A status the store sets from evidence. Carries `{status}`. A **400**. */
export const ALERTS_ERROR_STATUS_NOT_SETTABLE =
  "error.400.alerts_status_not_settable";
/** No session reached the tracker at all. A **401**. */
export const ALERTS_ERROR_UNAUTHORIZED = "error.401.unauthorized";
/** Signed in, and not staff. The tracker wall. A **403**. */
export const ALERTS_ERROR_FORBIDDEN = "error.403.forbidden";
/** No issue with that id — it may have been swept, or the link is old. **404**. */
export const ALERTS_ERROR_ISSUE_NOT_FOUND = "error.404.alerts_issue_not_found";

/** Fold any thrown value into this pair's error dialect. */
export function toAlertsError(error: unknown): FlowError {
  return toFlowError(error, "alerts.error.unknown");
}

const is = (error: unknown, code: string): boolean =>
  isErrorCode(toAlertsError(error), code);

/** Nobody is signed in (or the session expired between two reads). */
export function isAlertsUnauthorized(error: unknown): boolean {
  return is(error, ALERTS_ERROR_UNAUTHORIZED);
}

/**
 * Signed in, but not staff — the tracker wall.
 *
 * The one refusal every screen in this pair must be able to draw, because it
 * is the answer the whole surface gives to most of a host's accounts.
 */
export function isAlertsStaffOnly(error: unknown): boolean {
  return is(error, ALERTS_ERROR_FORBIDDEN);
}

/** No issue with that id (swept, or a stale `alerts:<id>` in a commit). */
export function isIssueNotFound(error: unknown): boolean {
  return is(error, ALERTS_ERROR_ISSUE_NOT_FOUND);
}

/** The store, declining to be told what it is supposed to have observed. */
export function isStatusNotSettable(error: unknown): boolean {
  return is(error, ALERTS_ERROR_STATUS_NOT_SETTABLE);
}
