/**
 * The refusals this pair has to tell apart, and the reason every one of them
 * is read by CODE and never by status.
 *
 * ── stapel-gdpr has three 404s, two 409s and two 410s ─────────────────────
 *
 * | status | code                                 | what it actually means            |
 * |--------|--------------------------------------|-----------------------------------|
 * | 404    | `gdpr.no_active_closure`             | your account is NOT being deleted  |
 * | 404    | `gdpr.export_not_found`              | you never asked for an archive     |
 * | 404    | `gdpr.erasure_not_found` / `dsar_…`  | no such row — a real miss          |
 * | 409    | `gdpr.closure_already_pending`       | you already asked; nothing to do   |
 * | 409    | `gdpr.legal_hold`                    | we MAY NOT delete this yet         |
 * | 409    | `gdpr.export_cooldown`               | once per 30 days                   |
 * | 410    | `gdpr.download_consumed`             | the link was already used          |
 * | 410    | `gdpr.download_expired`              | the link ran out of time           |
 *
 * A screen that branched on `status === 404` would tell someone their account
 * is missing when it is merely healthy, and one that branched on `410` would
 * tell them to wait for a link that has already been spent. The two 409s are
 * further apart still: `closure_already_pending` is a no-op the UI should
 * absorb, while `legal_hold` is a legal refusal a person is entitled to have
 * EXPLAINED. So: `isErrorCode` on a folded `FlowError`, everywhere, and the
 * codes are exported as named constants rather than typed at each call site.
 *
 * ── Two of these are not failures at all ──────────────────────────────────
 *
 * {@link isNoActiveClosure} and {@link isExportNotFound} are the answers
 * "nothing is being deleted" and "you have no archive". The model layer folds
 * both into `null` (`useAccountClosure`, `useDataExport`) so no skin has to
 * remember; they are exported because a host writing its own screen needs the
 * same fold, and because a test proves the fold happens.
 */
import { isErrorCode, toFlowError } from "@stapel/core";
import type { FlowError } from "@stapel/core";

// ── account closure ─────────────────────────────────────────────────────────
/** No closure on record. The NORMAL state of an account. A **404**. */
export const GDPR_ERROR_NO_ACTIVE_CLOSURE = "error.404.gdpr.no_active_closure";
/** A closure is already in grace — asking again changes nothing. A **409**. */
export const GDPR_ERROR_CLOSURE_ALREADY_PENDING =
  "error.409.gdpr.closure_already_pending";
/** The data is under a legal hold and may not be deleted. Also a **409**. */
export const GDPR_ERROR_LEGAL_HOLD = "error.409.gdpr.legal_hold";
/**
 * No seam could revoke the account's sessions, so the closure was REFUSED —
 * deliberately a 503 and not a 500: the request was fine, the deployment is
 * misconfigured, and retrying after it is fixed is the right behaviour.
 * Closing an account while its live tokens keep working is not an acceptable
 * degraded mode, which is why the module would rather fail loudly.
 */
export const GDPR_ERROR_CLOSURE_UNAVAILABLE = "error.503.gdpr.closure_unavailable";
/** The account is being erased; every other endpoint refuses it. A **403**. */
export const GDPR_ERROR_ACCOUNT_CLOSED = "error.403.gdpr.account_closed";

// ── data export ─────────────────────────────────────────────────────────────
/** No export was ever requested. Not a failure — a state. A **404**. */
export const GDPR_ERROR_EXPORT_NOT_FOUND = "error.404.gdpr.export_not_found";
/** One export per 30 days. A **409**. */
export const GDPR_ERROR_EXPORT_COOLDOWN = "error.409.gdpr.export_cooldown";
/** The archive is still being built. A **425**, and it means "wait". */
export const GDPR_ERROR_EXPORT_NOT_READY = "error.425.gdpr.export_not_ready";
/** The single-use token was already spent. A **410**. */
export const GDPR_ERROR_DOWNLOAD_CONSUMED = "error.410.gdpr.download_consumed";
/** The link expired. The OTHER **410**. */
export const GDPR_ERROR_DOWNLOAD_EXPIRED = "error.410.gdpr.download_expired";

// ── erasure ─────────────────────────────────────────────────────────────────
/** The subject type is outside `STAPEL_GDPR["SUBJECT_TYPES"]`. A **400**. */
export const GDPR_ERROR_UNKNOWN_SUBJECT_TYPE =
  "error.400.gdpr.unknown_subject_type";
/** The host's `ERASURE_AUTHORIZER` said no. A **403**. */
export const GDPR_ERROR_ERASURE_FORBIDDEN = "error.403.gdpr.erasure_forbidden";
/** No erasure with that id. A **404** that IS a miss. */
export const GDPR_ERROR_ERASURE_NOT_FOUND = "error.404.gdpr.erasure_not_found";

// ── DSAR ────────────────────────────────────────────────────────────────────
/** The request kind is not one of the four. A **400**. */
export const GDPR_ERROR_UNKNOWN_DSAR_KIND = "error.400.gdpr.unknown_dsar_kind";
/** No DSAR with that id. A **404**. */
export const GDPR_ERROR_DSAR_NOT_FOUND = "error.404.gdpr.dsar_not_found";

/**
 * Core's cross-cutting "not for you" key. The DSAR list is `AllowAny` at the
 * view level — it has to be, because the POST beside it must accept an
 * anonymous form — so its staff check is hand-rolled in the handler and comes
 * back as this generic code rather than a `gdpr.*` one.
 */
export const GDPR_ERROR_FORBIDDEN = "error.403.forbidden";

/** Core's cross-cutting key for a captcha the backend would not accept. */
export const GDPR_ERROR_CAPTCHA_INVALID = "error.400.captcha_invalid";
/** Core's cross-cutting key for a captcha token the anonymous form omitted. */
export const GDPR_ERROR_CAPTCHA_REQUIRED = "error.400.captcha_required";

/** Fold any thrown value into this pair's error dialect. */
export function toGdprError(error: unknown): FlowError {
  return toFlowError(error, "gdpr.error.unknown");
}

const is = (error: unknown, code: string): boolean =>
  isErrorCode(toGdprError(error), code);

/**
 * "Nothing is being deleted."
 *
 * The single most important predicate in this package. `GET
 * /user/account/close/status` answers 404 for the state almost every account
 * is in, and a screen that rendered that as an error would tell a person their
 * account is missing at the exact moment they came to check whether it was
 * about to be.
 */
export function isNoActiveClosure(error: unknown): boolean {
  return is(error, GDPR_ERROR_NO_ACTIVE_CLOSURE);
}

/** "You already asked" — a no-op the UI absorbs by re-reading the state. */
export function isClosureAlreadyPending(error: unknown): boolean {
  return is(error, GDPR_ERROR_CLOSURE_ALREADY_PENDING);
}

/**
 * "We may not delete this yet."
 *
 * A legal hold is the one refusal on this surface that a person cannot fix
 * and must not be left to guess at: it is shown as an explanation with a route
 * to support, never as a generic failure and never as a disabled button with
 * no reason attached.
 */
export function isLegalHold(error: unknown): boolean {
  return is(error, GDPR_ERROR_LEGAL_HOLD);
}

/** The deployment cannot revoke sessions, so closure is refused for now. */
export function isClosureUnavailable(error: unknown): boolean {
  return is(error, GDPR_ERROR_CLOSURE_UNAVAILABLE);
}

/** This account is already being erased — the whole app is read-only to it. */
export function isAccountClosed(error: unknown): boolean {
  return is(error, GDPR_ERROR_ACCOUNT_CLOSED);
}

/** "You have no archive" — the export read's 404-as-a-state. */
export function isExportNotFound(error: unknown): boolean {
  return is(error, GDPR_ERROR_EXPORT_NOT_FOUND);
}

/** One export per 30 days. The button says so instead of retrying. */
export function isExportCooldown(error: unknown): boolean {
  return is(error, GDPR_ERROR_EXPORT_COOLDOWN);
}

/** The archive is not built yet — "wait", not "gone". */
export function isExportNotReady(error: unknown): boolean {
  return is(error, GDPR_ERROR_EXPORT_NOT_READY);
}

/**
 * The download link was already used.
 *
 * Distinct from {@link isDownloadExpired} — SAME status, opposite advice: a
 * consumed token means the archive was served (and deleted) and the person
 * should look in their downloads before asking for another 30-day-gated
 * export; an expired one means it was never taken.
 */
export function isDownloadConsumed(error: unknown): boolean {
  return is(error, GDPR_ERROR_DOWNLOAD_CONSUMED);
}

/** The download link ran out of time. */
export function isDownloadExpired(error: unknown): boolean {
  return is(error, GDPR_ERROR_DOWNLOAD_EXPIRED);
}

/** The subject type is not declared on this deployment — a host wiring gap. */
export function isUnknownSubjectType(error: unknown): boolean {
  return is(error, GDPR_ERROR_UNKNOWN_SUBJECT_TYPE);
}

/**
 * The host's ownership predicate refused this erasure.
 *
 * Worth its own predicate because the DEFAULT `ERASURE_AUTHORIZER` is
 * staff-only: a product that wires `useRequestErasure` into a member's delete
 * button and forgets the seam gets this 403 for every member, which is a
 * deployment fault and not a thing to tell a person about their own recording.
 */
export function isErasureForbidden(error: unknown): boolean {
  return is(error, GDPR_ERROR_ERASURE_FORBIDDEN);
}

/** No erasure with that id. */
export function isErasureNotFound(error: unknown): boolean {
  return is(error, GDPR_ERROR_ERASURE_NOT_FOUND);
}

/** The request kind is not one of the four the regulation names. */
export function isUnknownDsarKind(error: unknown): boolean {
  return is(error, GDPR_ERROR_UNKNOWN_DSAR_KIND);
}

/** No DSAR with that id. */
export function isDsarNotFound(error: unknown): boolean {
  return is(error, GDPR_ERROR_DSAR_NOT_FOUND);
}

/**
 * "This screen is for staff."
 *
 * The staff reads answer a generic `error.403.forbidden`, so the admin
 * surfaces say that in as many words instead of showing an operations table's
 * generic failure to somebody who simply is not an operator. The door is still
 * visible: the nav axis has two values (`public` | `member`) and cannot
 * express "staff", so the explanation has to live on the screen.
 */
export function isStaffOnly(error: unknown): boolean {
  return is(error, GDPR_ERROR_FORBIDDEN);
}

/**
 * The anonymous form's captcha was missing or rejected.
 *
 * Both core keys, because a deployment with no captcha backend configured
 * raises neither and one with a backend raises whichever applies — the form
 * needs the same recovery ("try the challenge again") for both, and neither
 * should reach a visitor as a generic failure on a page whose whole purpose is
 * to be reachable by someone with no account.
 */
export function isCaptchaRefusal(error: unknown): boolean {
  return (
    is(error, GDPR_ERROR_CAPTCHA_REQUIRED) || is(error, GDPR_ERROR_CAPTCHA_INVALID)
  );
}
