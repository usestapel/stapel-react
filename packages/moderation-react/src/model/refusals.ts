/**
 * The refusals this pair has to tell apart, and why every one of them is read
 * by CODE and never by status.
 *
 * ── stapel-moderation has eleven 400s, four 403s, four 404s and eight 409s ─
 *
 * | status | code                                | what it actually means             |
 * |--------|-------------------------------------|------------------------------------|
 * | 400    | `moderation_own_content`            | you are reporting yourself         |
 * | 400    | `moderation_description_required`   | this reason needs an explanation   |
 * | 400    | `moderation_unknown_reason`         | the client sent nonsense           |
 * | 400    | `moderation_reason_not_applicable`  | the FORM was built from a stale policy |
 * | 403    | `moderation_forbidden`              | you are not a moderator            |
 * | 403    | `moderation_cannot_report`          | this target refuses YOUR report    |
 * | 403    | `moderation_not_appellant`          | not your decision to appeal        |
 * | 403    | `moderation_same_actor`             | you decided it; somebody else must hear the appeal |
 * | 409    | `moderation_case_claimed`           | somebody else is working on it     |
 * | 409    | `moderation_not_claimant`           | it is not YOUR lease to hand back  |
 * | 409    | `moderation_case_resolved`          | already decided                    |
 * | 409    | `moderation_appeal_resolved`        | the APPEAL is already decided      |
 *
 * Two pairs on that table are the whole argument for reading codes. The four
 * 403s are four different sentences: "sign in as a moderator", "this content
 * cannot be reported by you", "this is not your content", "ask a colleague" —
 * a screen branching on `403` would show one of them to all four people. And
 * `moderation_case_claimed` vs `moderation_case_resolved` share a status while
 * meaning "wait, then retry" and "there is nothing left to do".
 *
 * ── The one the backend fixed under us ────────────────────────────────────
 *
 * Re-resolving a decided appeal used to answer `400 invalid_outcome`, which
 * sent the console back to fix an `outcome` that was never wrong. Backend
 * 0.3.0 made it `409 moderation_appeal_resolved` (a key registered in 0.1.0
 * and never reachable until then). {@link isAppealAlreadyDecided} reads the
 * 409 — and NOT the 400, which now means only what it says: an unknown outcome
 * word, i.e. a bug in this client.
 */
import { isErrorCode, toFlowError } from "@stapel/core";
import type { FlowError } from "@stapel/core";

// ── report intake ───────────────────────────────────────────────────────────
/** You cannot report your own content. A **400**, not a 403: nothing about
 * the caller's clearance is wrong, the request simply makes no sense. */
export const MODERATION_ERROR_OWN_CONTENT = "error.400.moderation_own_content";
/** This reason demands an explanation and got none. A **400**. */
export const MODERATION_ERROR_DESCRIPTION_REQUIRED =
  "error.400.moderation_description_required";
/** The reason code is not in the registry at all — a client bug. A **400**. */
export const MODERATION_ERROR_UNKNOWN_REASON =
  "error.400.moderation_unknown_reason";
/**
 * A real reason that this target type does not accept. Also a **400**, and
 * deliberately NOT the same code as the unknown one (backend 0.3.0): an
 * unknown code means the client invented something, a non-applicable one means
 * the form was built from a policy that has since changed. The remedy differs
 * — this one is "reload the policy and pick again", and the sheet does it.
 */
export const MODERATION_ERROR_REASON_NOT_APPLICABLE =
  "error.400.moderation_reason_not_applicable";
/** This deployment does not moderate that kind of target. A **400**. */
export const MODERATION_ERROR_UNKNOWN_TARGET_TYPE =
  "error.400.moderation_unknown_target_type";
/** An anonymous report needs somewhere to send the answer. A **400**. */
export const MODERATION_ERROR_CONTACT_REQUIRED =
  "error.400.moderation_contact_required";
/** The attached snapshot is not accepted here (evidence-based types). **400**. */
export const MODERATION_ERROR_EVIDENCE_INVALID =
  "error.400.moderation_evidence_invalid";
/** The type's `can_report` predicate said no. A **403**. */
export const MODERATION_ERROR_CANNOT_REPORT =
  "error.403.moderation_cannot_report";
/** You have already reported this target. A **409** — and a no-op, not a fault. */
export const MODERATION_ERROR_ALREADY_REPORTED =
  "error.409.moderation_already_reported";
/** The thing you are reporting is gone. A **404**. */
export const MODERATION_ERROR_TARGET_NOT_FOUND =
  "error.404.moderation_target_not_found";

// ── console ─────────────────────────────────────────────────────────────────
/** You do not have the clearance for this action. A **403**. */
export const MODERATION_ERROR_FORBIDDEN = "error.403.moderation_forbidden";
/** Core's cross-cutting "not for you" — the console names it the same way. */
export const CORE_ERROR_FORBIDDEN = "error.403.forbidden";
/** Another moderator holds the lease. A **409**, and it means "wait". */
export const MODERATION_ERROR_CASE_CLAIMED = "error.409.moderation_case_claimed";
/** The lease you tried to hand back is somebody else's. A **409** (0.3.0). */
export const MODERATION_ERROR_NOT_CLAIMANT = "error.409.moderation_not_claimant";
/** The case is already decided. A **409**. */
export const MODERATION_ERROR_CASE_RESOLVED = "error.409.moderation_case_resolved";
/** The case cannot move to that state. A **400**. */
export const MODERATION_ERROR_INVALID_TRANSITION =
  "error.400.moderation_invalid_transition";
/** No case with that id. A **404**. */
export const MODERATION_ERROR_CASE_NOT_FOUND = "error.404.moderation_case_not_found";
/** The decision word is not one of the four. A **400** — a client bug. */
export const MODERATION_ERROR_INVALID_DECISION =
  "error.400.moderation_invalid_decision";
/** The sanction kind is not one of the five. A **400** — a client bug. */
export const MODERATION_ERROR_INVALID_SANCTION_KIND =
  "error.400.moderation_invalid_sanction_kind";
/** No sanction with that id. A **404**. */
export const MODERATION_ERROR_SANCTION_NOT_FOUND =
  "error.404.moderation_sanction_not_found";
/** Only an active sanction can be lifted. A **409**. */
export const MODERATION_ERROR_SANCTION_NOT_ACTIVE =
  "error.409.moderation_sanction_not_active";
/** The target's content cannot be read right now. A **503** — "try later". */
export const MODERATION_ERROR_CONTENT_UNAVAILABLE =
  "error.503.moderation_content_unavailable";

// ── appeals ─────────────────────────────────────────────────────────────────
/** Only the subject of a decision may appeal it. A **403**. */
export const MODERATION_ERROR_NOT_APPELLANT = "error.403.moderation_not_appellant";
/** An appeal must be heard by a DIFFERENT moderator. A **403**. */
export const MODERATION_ERROR_SAME_ACTOR = "error.403.moderation_same_actor";
/** You have already appealed this case. A **409**. */
export const MODERATION_ERROR_ALREADY_APPEALED =
  "error.409.moderation_already_appealed";
/** Only a RESOLVED case can be appealed. A **409**. */
export const MODERATION_ERROR_CASE_NOT_RESOLVED =
  "error.409.moderation_case_not_resolved";
/** The appeal has already been decided. A **409** since backend 0.3.0. */
export const MODERATION_ERROR_APPEAL_RESOLVED =
  "error.409.moderation_appeal_resolved";
/** No appeal with that id. A **404**. */
export const MODERATION_ERROR_APPEAL_NOT_FOUND =
  "error.404.moderation_appeal_not_found";

// ── cross-cutting ───────────────────────────────────────────────────────────
/** Core's step-up seam: this action needs a fresh verification. A **403**. */
export const CORE_ERROR_VERIFICATION_REQUIRED =
  "error.403.verification_required";
/** Core's step-up seam: the caller has no verification factor yet. A **403**. */
export const CORE_ERROR_VERIFICATION_ENROLLMENT_REQUIRED =
  "error.403.verification_enrollment_required";
/**
 * Core's two throttle codes. On `POST reports/` (the module's only throttled
 * route, `ReportThrottle`) both mean "you have reported a lot recently".
 * `rate_limit` carries `retry_after_minutes`; `too_many_requests` does not,
 * and a screen that only knew the first would render nothing for the second.
 */
export const CORE_ERROR_RATE_LIMIT = "error.429.rate_limit";
/** @see CORE_ERROR_RATE_LIMIT */
export const CORE_ERROR_TOO_MANY_REQUESTS = "error.429.too_many_requests";

/** Fold any thrown value into this pair's error dialect. */
export function toModerationError(error: unknown): FlowError {
  return toFlowError(error, "moderation.error.unknown");
}

const is = (error: unknown, code: string): boolean =>
  isErrorCode(toModerationError(error), code);

/** You are reporting your own content. */
export function isOwnContent(error: unknown): boolean {
  return is(error, MODERATION_ERROR_OWN_CONTENT);
}

/** This reason needs an explanation — the field, not the request, is wrong. */
export function isDescriptionRequired(error: unknown): boolean {
  return is(error, MODERATION_ERROR_DESCRIPTION_REQUIRED);
}

/**
 * The picked reason does not apply to this target type.
 *
 * Separate from {@link isUnknownReason} on purpose (backend 0.3.0): this one
 * is recoverable WITHOUT the person doing anything wrong — the policy moved
 * under an open sheet — so the sheet refetches it and asks again.
 */
export function isReasonNotApplicable(error: unknown): boolean {
  return is(error, MODERATION_ERROR_REASON_NOT_APPLICABLE);
}

/** The reason code is not in the registry. A bug in whatever built the form. */
export function isUnknownReason(error: unknown): boolean {
  return is(error, MODERATION_ERROR_UNKNOWN_REASON);
}

/** This deployment does not moderate that kind of target — a wiring gap. */
export function isUnknownTargetType(error: unknown): boolean {
  return is(error, MODERATION_ERROR_UNKNOWN_TARGET_TYPE);
}

/** The type's own `can_report` predicate refused this reporter. */
export function isCannotReport(error: unknown): boolean {
  return is(error, MODERATION_ERROR_CANNOT_REPORT);
}

/** You already reported this. Not a failure — a state the button states. */
export function isAlreadyReported(error: unknown): boolean {
  return is(error, MODERATION_ERROR_ALREADY_REPORTED);
}

/** The reported thing is gone. */
export function isTargetNotFound(error: unknown): boolean {
  return is(error, MODERATION_ERROR_TARGET_NOT_FOUND);
}

/** The attached evidence is not accepted for this target type. */
export function isEvidenceInvalid(error: unknown): boolean {
  return is(error, MODERATION_ERROR_EVIDENCE_INVALID);
}

/**
 * "This screen is for moderators."
 *
 * Two codes, because two different guards answer: the module's own mandate
 * check raises `moderation_forbidden`, and core's generic permission layer
 * raises `forbidden`. The console shows the SAME named refusal for both — the
 * nav axis has `public | member` and cannot say "staff", so the screen has to.
 */
export function isStaffOnly(error: unknown): boolean {
  return (
    is(error, MODERATION_ERROR_FORBIDDEN) || is(error, CORE_ERROR_FORBIDDEN)
  );
}

/**
 * A step-up challenge, not a refusal.
 *
 * The HIGH-clearance writes (issue/lift a sanction) answer this when the
 * session is not freshly verified. `@stapel/auth-react` owns the re-auth UI
 * and core's client owns the retry; this pair only recognises the shape so a
 * console can say "confirm it is you" instead of "forbidden".
 */
export function isStepUp(error: unknown): boolean {
  return (
    is(error, CORE_ERROR_VERIFICATION_REQUIRED) ||
    is(error, CORE_ERROR_VERIFICATION_ENROLLMENT_REQUIRED)
  );
}

/** Somebody else holds the lease. Show who, and offer a refresh. */
export function isClaimedByAnother(error: unknown): boolean {
  return is(error, MODERATION_ERROR_CASE_CLAIMED);
}

/** The lease is not yours to release (backend 0.3.0). */
export function isNotClaimant(error: unknown): boolean {
  return is(error, MODERATION_ERROR_NOT_CLAIMANT);
}

/** The case is already decided — there is nothing left to submit. */
export function isCaseResolved(error: unknown): boolean {
  return is(error, MODERATION_ERROR_CASE_RESOLVED);
}

/** The case cannot move to that state from where it is. */
export function isInvalidTransition(error: unknown): boolean {
  return is(error, MODERATION_ERROR_INVALID_TRANSITION);
}

/** Only the subject of a decision may appeal it. */
export function isNotAppellant(error: unknown): boolean {
  return is(error, MODERATION_ERROR_NOT_APPELLANT);
}

/** You already appealed this case. */
export function isAlreadyAppealed(error: unknown): boolean {
  return is(error, MODERATION_ERROR_ALREADY_APPEALED);
}

/** Only a resolved case can be appealed. */
export function isCaseNotResolved(error: unknown): boolean {
  return is(error, MODERATION_ERROR_CASE_NOT_RESOLVED);
}

/**
 * The appeal has already been decided.
 *
 * A 409 since backend 0.3.0. Before that it arrived as `400 invalid_outcome`,
 * which told the console its `outcome` field was wrong when the field was
 * fine — the appeal had simply been heard already.
 */
export function isAppealAlreadyDecided(error: unknown): boolean {
  return is(error, MODERATION_ERROR_APPEAL_RESOLVED);
}

/** An appeal must be heard by a moderator who did not decide the case. */
export function isSameActor(error: unknown): boolean {
  return is(error, MODERATION_ERROR_SAME_ACTOR);
}

/** Only an active sanction can be lifted. */
export function isSanctionNotActive(error: unknown): boolean {
  return is(error, MODERATION_ERROR_SANCTION_NOT_ACTIVE);
}

/** "You have reported a lot recently." The intake throttle, not a refusal. */
export function isThrottled(error: unknown): boolean {
  return (
    is(error, CORE_ERROR_RATE_LIMIT) || is(error, CORE_ERROR_TOO_MANY_REQUESTS)
  );
}
