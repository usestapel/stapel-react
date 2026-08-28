/**
 * Response bodies exactly as stapel-reviews sends them — the envelope the
 * schema does not declare, the zero that is not a rating, and the refusal
 * envelopes core folds into `StapelApiError`.
 */
import type { Review, ReviewPage } from "../src/index.js";

export const TARGET = { targetType: "listing", targetKey: "42" } as const;

export function review(overrides: Partial<Review> = {}): Review {
  return {
    id: "r1",
    target_type: TARGET.targetType,
    target_key: TARGET.targetKey,
    author_id: "author-1",
    rating: 5,
    body: "Great",
    status: "published",
    created_at: "2026-08-20T10:00:00Z",
    response: null,
    ...overrides,
  };
}

/**
 * Core's AnchorPagination envelope — `components/ReviewPage` since
 * stapel-reviews 0.3.0, so this fixture is checked against a GENERATED type
 * rather than against a copy this package maintained.
 */
export function page(
  items: readonly Review[],
  overrides: Partial<ReviewPage> = {}
): ReviewPage {
  return {
    items: [...items],
    next_anchor: null,
    prev_anchor: null,
    has_next: false,
    has_prev: false,
    count: items.length,
    ...overrides,
  };
}

export const FIRST_PAGE = page([review({ id: "r1" }), review({ id: "r2", rating: 4 })], {
  has_next: true,
  next_anchor: "2026-08-19T10:00:00Z",
});

export const SECOND_PAGE = page([review({ id: "r3", rating: 3 })]);

/** A target nobody has rated: a real 200, and a zero that means nothing. */
export const UNRATED = {
  target_type: TARGET.targetType,
  target_key: TARGET.targetKey,
  avg: 0.0,
  count: 0,
};

export const RATED = {
  target_type: TARGET.targetType,
  target_key: TARGET.targetKey,
  avg: 4.25,
  count: 12,
};

/** The duplicate refusal, at the status the module actually uses. */
export const DUPLICATE_400 = {
  status: 400,
  body: { localizable_error: "error.400.reviews_duplicate_review" },
};

/** The module's ONLY 409 — and it is about the owner's reply, not a duplicate. */
export const ALREADY_RESPONDED_409 = {
  status: 409,
  body: { localizable_error: "error.409.reviews_already_responded" },
};

export const UNAUTHENTICATED_401 = {
  status: 401,
  body: { localizable_error: "stapel.http.401" },
};

/**
 * The GUEST wall: a minted anonymous account IS authenticated, so nothing
 * answers 401 for it — `ALLOW_ANONYMOUS_WRITES` refuses the review write with
 * this 403 instead. The other spelling of "sign in first".
 */
export const ANONYMOUS_NOT_ALLOWED_403 = {
  status: 403,
  body: { localizable_error: "error.403.reviews_anonymous_not_allowed" },
};

/**
 * The fail-closed moderation gate saying no — to a VERDICT or to the owner's
 * REPLY, which share the callback and therefore share this code.
 */
export const FORBIDDEN_403 = {
  status: 403,
  body: { localizable_error: "error.403.reviews_cannot_moderate" },
};

/** The reply already exists — and there is no endpoint that replaces it. */
export const RESPONSE_NOT_ALLOWED_400 = {
  status: 400,
  body: { localizable_error: "error.400.reviews_response_not_allowed" },
};

/** The review was deleted between the read that listed it and the write. */
export const REVIEW_GONE_404 = {
  status: 404,
  body: { localizable_error: "error.404.reviews_review_not_found" },
};
