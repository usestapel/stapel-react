/**
 * `@stapel/reviews-react` — the headless React pair for stapel-reviews
 * (frontend-standard §2). Business + state only, zero visual opinion; the antd
 * skin lives behind the `./default` subpath, so a host that renders its own
 * review block carries none of it.
 *
 * ── The one-liner ──────────────────────────────────────────────────────────
 *
 * ```tsx
 * const runtime = createReviewsRuntime({ baseUrl: "/reviews/api/v1" });
 * const target = { targetType: "listing", targetKey: listingId };
 * <ReviewsProvider runtime={runtime}>
 *   <ReviewAggregate target={target}>{(bag) => <YourStars bag={bag} />}</ReviewAggregate>
 *   <ReviewList target={target}>{(bag) => <YourRows bag={bag} />}</ReviewList>
 *   <ReviewForm target={target}>{(bag) => <YourForm bag={bag} />}</ReviewForm>
 * </ReviewsProvider>
 * ```
 *
 * `"listing"` in that snippet is the HOST's registry key, not this library's:
 * stapel-reviews ships an EMPTY `TARGET_TYPES` registry and this package
 * exports no target-type constants (see `api/types.ts`, `ReviewTarget`).
 *
 * ── The four properties this pair exists to guarantee ──────────────────────
 *
 * 1. **A zero average is not a zero rating.** `avg` is `0.0` when `count` is
 *    `0`, by the module's own contract. `ratingSummary()` answers
 *    `rated: false` there and gives a skin nothing to draw a star row from, so
 *    "nobody has rated this yet" can never be rendered as the worst possible
 *    score. Same class as `data ?? []`.
 * 2. **The refusal is read by CODE, never by status.** "You have already
 *    reviewed this" is `error.400.reviews_duplicate_review` — a 400 — while
 *    the module's only 409 says the owner's reply already exists. Branching on
 *    the number would miss the first and mishandle the second
 *    (`model/refusals.ts`).
 * 3. **A 401 is not an empty list.** Every stapel-reviews endpoint is
 *    `IsAuthenticated`, including both reads, so a signed-out visitor to a
 *    public listing page gets 401 — and the empty state would tell them a
 *    well-reviewed seller has never been reviewed. `signInRequired` is a
 *    named state on both read bags.
 * 4. **A review that is not published says so.** `status` is carried to the
 *    screen (`pending` / `hidden`, plus an explicit `unknown` arm for a state
 *    a future backend adds), and the submit outcome reports the created row's
 *    status, so a pre-moderating deployment tells the author their review is
 *    waiting instead of leaving them to look for it.
 *
 * 5. **Every capability the module has is reachable.** `POST {id}/moderate`
 *    and `POST {id}/response` used to be declared out of scope here, and the
 *    consequence was that stapel-reviews' moderation queue and the seller's
 *    single reply existed on no screen in the fleet. Both are wired now,
 *    behind an explicit `canModerate` / `canRespond` capability the host
 *    declares and the server decides (the `can_moderate` callback is
 *    fail-closed, so a mis-offered control costs a 403, not a leak) — and a
 *    control the host has not armed renders switched off WITH its reason, not
 *    removed.
 *
 * ── What this pair does NOT do ─────────────────────────────────────────────
 *
 * No seller-wide rating fetch. The product model (spec fork F5) reviews the
 * SELLER for a specific listing, so a seller's rating is a roll-up across
 * their listings — which stapel-reviews cannot compute (one
 * `(target_type, target_key)` per call) and the shop composite can
 * (`shop.listing_review_summary`). `<ReviewAggregate aggregate={…}>` renders
 * those two numbers from wherever the host got them; it does not invent an
 * N+1 loop to fake the roll-up.
 *
 * No nav manifest: this pair has no route of its own. It renders INSIDE the
 * listing detail page and the public seller profile, both of which belong to
 * other pairs (the cdn-react precedent — a menu entry leading nowhere is
 * worse than no entry).
 *
 * Layers: api → model → headless → i18n. Generated surfaces (the typed schema,
 * the error map, the manifest, llms.txt) are produced by the monorepo `gen:*`
 * drivers from stapel-reviews' own `docs/` artifacts and stand under drift
 * gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createReviewsApi } from "./api/reviewsApi.js";
export type { ReviewsApi } from "./api/reviewsApi.js";
export type {
  RatingAggregate,
  Review,
  ReviewAggregate as ReviewAggregateResponse,
  ReviewAnchorDirection,
  ReviewCreateRequest,
  ReviewListParams,
  ReviewModerateRequest,
  ReviewModerationAction,
  ReviewOwnerResponse,
  ReviewPage,
  ReviewRespondRequest,
  ReviewStatus,
  ReviewTarget,
  Schemas,
} from "./api/types.js";

// ── model ────────────────────────────────────────────────────────────────────
export { createReviewsRuntime, DEFAULT_RATING_BOUNDS } from "./model/runtime.js";
export type {
  CreateReviewsRuntimeOptions,
  ReviewRatingBounds,
  ReviewsRuntime,
} from "./model/runtime.js";
export {
  ReviewsRuntimeContext,
  useReviewsAnalytics,
  useReviewsApi,
  useReviewsRuntime,
} from "./model/context.js";
export { reviewsQueryKeys } from "./model/queryKeys.js";
export { REVIEWS_PAGE, useReviewAggregate, useReviewList } from "./model/queries.js";
export type { UseReviewListOptions } from "./model/queries.js";
export {
  useModerateReview,
  useRespondToReview,
  useSubmitReview,
} from "./model/mutations.js";
export type {
  ModerateReviewVariables,
  RespondToReviewVariables,
  SubmitReviewVariables,
} from "./model/mutations.js";
export { formatReviewDate, useReviewDateFormat } from "./model/dates.js";
export { ratingSummary, starBreakdown } from "./model/rating.js";
export type { RatingSummary, StarBreakdown } from "./model/rating.js";
export {
  findOwnReview,
  isModeratedOut,
  reviewsFromPages,
  reviewVisibility,
} from "./model/list.js";
export {
  isAlreadyResponded,
  isDuplicateReview,
  isInvalidModerationAction,
  isModerationForbidden,
  isResponseNotAllowed,
  isReviewGone,
  isReviewingForbidden,
  isSignInRequired,
  isUnknownTargetType,
  REVIEWS_ERROR_ALREADY_RESPONDED,
  REVIEWS_ERROR_CANNOT_MODERATE,
  REVIEWS_ERROR_CANNOT_REVIEW,
  REVIEWS_ERROR_DUPLICATE,
  REVIEWS_ERROR_INVALID_MODERATION_ACTION,
  REVIEWS_ERROR_INVALID_RATING,
  REVIEWS_ERROR_NOT_FOUND,
  REVIEWS_ERROR_RESPONSE_NOT_ALLOWED,
  REVIEWS_ERROR_UNKNOWN_TARGET_TYPE,
  toReviewsError,
} from "./model/refusals.js";

// ── headless ─────────────────────────────────────────────────────────────────
export { ReviewsProvider } from "./headless/ReviewsProvider.js";
export { ReviewList } from "./headless/ReviewList.js";
export type {
  ReviewListBag,
  ReviewListProps,
  ReviewListScope,
} from "./headless/ReviewList.js";
export { ReviewModeration } from "./headless/ReviewModeration.js";
export type {
  ReviewModerationBag,
  ReviewModerationProps,
} from "./headless/ReviewModeration.js";
export { ReviewResponseForm } from "./headless/ReviewResponseForm.js";
export type {
  ReviewResponseBag,
  ReviewResponseFormProps,
} from "./headless/ReviewResponseForm.js";
export { ReviewAggregate } from "./headless/ReviewAggregate.js";
export type {
  ReviewAggregateBag,
  ReviewAggregateProps,
} from "./headless/ReviewAggregate.js";
export { ReviewForm } from "./headless/ReviewForm.js";
export type { ReviewFormBag, ReviewFormProps } from "./headless/ReviewForm.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  REVIEWS_I18N_KEYS,
  REVIEWS_I18N_PLURALS,
  registerReviewsI18n,
  reviewsI18nBundleEn,
} from "./i18n/keys.js";
export {
  explainReviewsError,
  REVIEWS_ERROR_CODES,
  REVIEWS_ERRORS,
  reviewsErrorBundleEn,
} from "./i18n/errorsMap.js";
export type {
  Remediation,
  ReviewsErrorCode,
  ReviewsErrorSpec,
} from "./i18n/errorsMap.js";
