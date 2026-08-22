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
 * All four stapel-reviews views are `IsAuthenticated`, so a signed-out
 * visitor gets 401 on the review LIST and on the AGGREGATE. Read as a
 * generic failure that becomes "no reviews yet" under any code that defaults
 * an empty array — a well-reviewed seller shown as unreviewed to exactly the
 * people who have not signed up yet. {@link isSignInRequired} exists so the
 * list bag can carry that as its own state and the skin can say the true
 * thing.
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
/** The type's `can_review` callback said no. */
export const REVIEWS_ERROR_CANNOT_REVIEW = "error.403.reviews_cannot_review";
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
 * "This read needs a signed-in account." True for the 401 every endpoint of
 * this module answers to an anonymous caller.
 *
 * Both halves are checked: core maps an un-keyed 401 body to
 * `stapel.http.401`, but a deployment that puts its own `localizable_error`
 * in a 401 body would arrive with that key instead — and it is still a 401.
 */
export function isSignInRequired(error: unknown): boolean {
  const flow = toReviewsError(error);
  return flow.status === HTTP_UNAUTHORIZED || isErrorCode(flow, HTTP_401_KEY);
}

/** The host's `can_review` callback refused this author for this target. */
export function isReviewingForbidden(error: unknown): boolean {
  return isErrorCode(toReviewsError(error), REVIEWS_ERROR_CANNOT_REVIEW);
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
