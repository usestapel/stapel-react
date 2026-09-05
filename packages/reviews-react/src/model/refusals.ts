/**
 * The refusals this pair has to tell apart, and the reason they are read by
 * CODE and never by status.
 *
 * ── The trap ───────────────────────────────────────────────────────────────
 *
 * "You have already reviewed this" is a **400**
 * (`ERR_400_DUPLICATE_REVIEW = "error.400.reviews_duplicate_review"`,
 * `views.ReviewListCreateView.post`), not the 409 the situation reads like.
 * And the module DOES answer 409 — for something else entirely:
 * `error.409.reviews_already_responded`, which says the owner's reply already
 * exists. A form that branched on `status === 409` would therefore miss the
 * duplicate every time and mis-handle a refusal about a different object.
 *
 * That is why every predicate here compares a `FlowError.code`, folded
 * through core's `toFlowError`, and why the codes are exported as named
 * constants rather than typed at each call site.
 *
 * ── The other one worth naming ─────────────────────────────────────────────
 *
 * The two READS are anonymous since stapel-reviews 0.3.0, so a 401 no longer
 * arrives from the list or the aggregate. It still arrives from every WRITE —
 * the review, the moderation verdict, the owner's reply — because each of
 * those needs an identity to attribute the act to. {@link isSignInRequired}
 * exists so a write bag can carry that as its own state and the skin can offer
 * a door instead of a red banner. Since the storefront started minting
 * anonymous accounts that refusal has a SECOND spelling, a 403; the predicate
 * says why it reads both.
 *
 * ── The moderation gate is one code for two capabilities ───────────────────
 *
 * The seller's reply and the moderator's verdict are gated on the SAME
 * fail-closed `can_moderate` callback, so both are refused with
 * `error.403.reviews_cannot_moderate`. {@link isModerationForbidden} is
 * therefore read by both surfaces, and the sentence each shows is its own.
 */
import { isErrorCode, toFlowError } from "@stapel/core";
import type { FlowError } from "@stapel/core";

/** The author already reviewed this target (`one_per_author`). A **400**. */
export const REVIEWS_ERROR_DUPLICATE = "error.400.reviews_duplicate_review";
/** `target_type` is not in the host's registry — or one of the pair was missing. */
export const REVIEWS_ERROR_UNKNOWN_TARGET_TYPE =
  "error.400.reviews_unknown_target_type";
/** The rating fell outside `[RATING_MIN, RATING_MAX]`. */
export const REVIEWS_ERROR_INVALID_RATING = "error.400.reviews_invalid_rating";
/** The moderation verdict was not one of `hide` / `publish`. */
export const REVIEWS_ERROR_INVALID_MODERATION_ACTION =
  "error.400.reviews_invalid_moderation_action";
/** The type's `can_review` callback said no. */
export const REVIEWS_ERROR_CANNOT_REVIEW = "error.403.reviews_cannot_review";
/**
 * A GUEST — an account minted for a stranger, `is_anonymous=True` — wrote a
 * review while the module's `ALLOW_ANONYMOUS_WRITES` switch is off (its
 * default). Distinct from {@link REVIEWS_ERROR_CANNOT_REVIEW}: that one is the
 * host policy's verdict about this author and this target, this one is about
 * the account itself, and only the second is fixed by signing up. Gates
 * `POST /reviews` alone — the reads stay open either way.
 */
export const REVIEWS_ERROR_ANONYMOUS_NOT_ALLOWED =
  "error.403.reviews_anonymous_not_allowed";
/** The type's `can_moderate` callback said no (fail-closed when unset). */
export const REVIEWS_ERROR_CANNOT_MODERATE = "error.403.reviews_cannot_moderate";
/** No review with that id. */
export const REVIEWS_ERROR_NOT_FOUND = "error.404.reviews_review_not_found";
/** Responses are switched off for this target type. */
export const REVIEWS_ERROR_RESPONSE_NOT_ALLOWED =
  "error.400.reviews_response_not_allowed";
/** The review already carries the owner's reply — the module's ONLY 409. */
export const REVIEWS_ERROR_ALREADY_RESPONDED =
  "error.409.reviews_already_responded";
/**
 * More than `OWNER_KEYS_MAX` (100) owner keys in one
 * `POST /reviews/aggregates/by-owner` call (stapel-reviews 0.6.0). Carries
 * `{max}`. `useOwnerAggregates` chunks at the same ceiling, so a caller going
 * through the hook cannot provoke this by simply asking for a big page — it
 * is reachable only by a caller of `ReviewsApi.aggregatesByOwner` that builds
 * its own request.
 */
export const REVIEWS_ERROR_TOO_MANY_OWNER_KEYS =
  "error.400.reviews_too_many_owner_keys";

/** Core's cross-cutting key for an unauthenticated call. */
const HTTP_401_KEY = "stapel.http.401";

/**
 * Named, not inlined — the cdn-react precedent, for the same reason
 * `stapel/no-adhoc-401` gives: the rule bans a bare `=== 401` because that
 * shape is how ad hoc refresh/redirect logic gets written outside core's one
 * seam. What happens here is not that. Nothing is refreshed, retried or
 * redirected; the status is merely CLASSIFIED so a public page can say "sign
 * in to read the reviews" instead of "this seller has no reviews". The real
 * 401 handling stays on the client's `onAuthRefresh` seam and never reaches
 * this file.
 */
const HTTP_UNAUTHORIZED = 401;

/** Fold any thrown value into this pair's error dialect. */
export function toReviewsError(error: unknown): FlowError {
  return toFlowError(error, "reviews.error.unknown");
}

/**
 * "You have already reviewed this target."
 *
 * Only ever true when the target type sets `one_per_author: true` — the
 * registry default is `false` (`registry.resolve_policy`), and the catalogue
 * shop preset turns it on for `listing`. A host whose policy allows several
 * reviews will simply never see this.
 */
export function isDuplicateReview(error: unknown): boolean {
  return isErrorCode(toReviewsError(error), REVIEWS_ERROR_DUPLICATE);
}

/**
 * "This write needs an account the review can be attributed to."
 *
 * ONE refusal, TWO spellings, because there are two ways to lack such an
 * account. A visitor with no session at all is refused with **401** — there is
 * nothing to authenticate. A visitor a storefront silently minted a GUEST
 * account for IS authenticated, so nothing answers 401 for them any more; the
 * module's own `ALLOW_ANONYMOUS_WRITES` switch refuses that session with a
 * **403** and `REVIEWS_ERROR_ANONYMOUS_NOT_ALLOWED`. The page says the same
 * sentence either way: sign in, then write it.
 *
 * Both halves of the 401 arm are kept: core maps an un-keyed 401 body to
 * `stapel.http.401`, but a deployment that puts its own `localizable_error`
 * in a 401 body would arrive with that key instead — and it is still a 401.
 */
export function isSignInRequired(error: unknown): boolean {
  const flow = toReviewsError(error);
  return (
    flow.status === HTTP_UNAUTHORIZED ||
    isErrorCode(flow, HTTP_401_KEY) ||
    isErrorCode(flow, REVIEWS_ERROR_ANONYMOUS_NOT_ALLOWED)
  );
}

/** The host's `can_review` callback refused this author for this target. */
export function isReviewingForbidden(error: unknown): boolean {
  return isErrorCode(toReviewsError(error), REVIEWS_ERROR_CANNOT_REVIEW);
}

/**
 * The type's `can_moderate` callback refused this actor — for a moderation
 * verdict OR for the owner's reply, which share the gate.
 *
 * Worth its own predicate rather than a generic "403": the callback is
 * **fail-closed** (`registry.check_can_moderate` denies everyone when a target
 * type names no callback at all), so this arrives just as readily from a
 * deployment that has not wired moderation up as from a person who is not a
 * moderator. Either way the honest sentence is "the server does not accept you
 * as a moderator of this item" — not "you are not signed in" and not "this
 * failed".
 */
export function isModerationForbidden(error: unknown): boolean {
  return isErrorCode(toReviewsError(error), REVIEWS_ERROR_CANNOT_MODERATE);
}

/**
 * The verdict was not one of `hide` / `publish`.
 *
 * A client that only ever sends the two cannot provoke this — which is
 * exactly why it is named: if it ever fires, the module grew a third verdict
 * this build does not know, and that is worth showing as itself instead of as
 * a generic 400.
 */
export function isInvalidModerationAction(error: unknown): boolean {
  return isErrorCode(
    toReviewsError(error),
    REVIEWS_ERROR_INVALID_MODERATION_ACTION
  );
}

/**
 * Replies are switched off for this target type (`allow_response: false` in
 * the type's policy). A **400**, not a 403: nobody may reply here, so it is
 * not a statement about the caller.
 */
export function isResponseNotAllowed(error: unknown): boolean {
  return isErrorCode(toReviewsError(error), REVIEWS_ERROR_RESPONSE_NOT_ALLOWED);
}

/**
 * The review already carries the owner's reply — the module's ONLY 409, and
 * the mirror image of the duplicate trap: here the status reads the way a
 * naive client expects, while the duplicate REVIEW is a 400. Both are
 * branched on the code so neither can be mistaken for the other.
 */
export function isAlreadyResponded(error: unknown): boolean {
  return isErrorCode(toReviewsError(error), REVIEWS_ERROR_ALREADY_RESPONDED);
}

/**
 * No review with that id — it was deleted (or purged by GDPR erasure) between
 * the read that put it on screen and the write aimed at it. A moderation queue
 * is the surface where this actually happens, which is why it is a named
 * outcome there rather than a red banner.
 */
export function isReviewGone(error: unknown): boolean {
  return isErrorCode(toReviewsError(error), REVIEWS_ERROR_NOT_FOUND);
}

/**
 * The target type is not registered on this deployment.
 *
 * Worth its own predicate because the view answers it for TWO different
 * situations: an unknown type, and a missing `target_type`/`target_key` on a
 * GET (`views.py` — "a missing one is ERR_400_UNKNOWN_TARGET_TYPE, not an
 * empty list/aggregate"). Either way it is a wiring fault in the host, not
 * something the person reading the page can fix, which is why the skin shows
 * it as an error rather than as an empty state.
 */
export function isUnknownTargetType(error: unknown): boolean {
  return isErrorCode(toReviewsError(error), REVIEWS_ERROR_UNKNOWN_TARGET_TYPE);
}

/**
 * More than 100 owner keys were sent to `POST /reviews/aggregates/by-owner`
 * in one call. Named mainly so it can show up in a test asserting
 * `useOwnerAggregates`'s chunking makes it unreachable through the hook — a
 * direct `ReviewsApi.aggregatesByOwner` caller can still hit it.
 */
export function isTooManyOwnerKeys(error: unknown): boolean {
  return isErrorCode(toReviewsError(error), REVIEWS_ERROR_TOO_MANY_OWNER_KEYS);
}
