/**
 * The pair's public wire types — projected from the GENERATED schema
 * (`api/generated/schema.ts`, emitted by `pnpm gen:api` from stapel-reviews'
 * own `docs/schema.json`), never re-typed by hand.
 *
 * **Two hand-written shapes lived here against the 0.2.2 pin and are gone.**
 * `ReviewPage` and the list's `anchor`/`limit`/`direction` parameters were
 * declared by this file because `ReviewListCreateView` is a bare `APIView`
 * that instantiates its paginator inside `get()`: drf-spectacular's pagination
 * introspection only fires for `GenericAPIView.pagination_class`, so the
 * schema declared `200: ReviewResponse[]` and knew nothing of the three query
 * parameters. **stapel-reviews 0.3.0 declares both** — `components/ReviewPage`
 * and the parameters, `direction` with an enum — so the copies were deleted
 * and everything below comes from codegen. The upstream ask that produced this
 * is recorded in `contract-pins.json`.
 *
 * Two corrections remain, and both are widenings of what the wire can say
 * rather than shapes the schema is missing:
 *
 * 1. **`status` is a bare `string` on the wire** and a three-member lifecycle
 *    in the model (`ReviewStatus`). {@link ReviewStatus} names the three
 *    WITHOUT narrowing a parsed value: a fourth state added upstream must
 *    render as an unknown state, not crash a switch.
 * 2. **`avg` is `0.0` when `count` is `0`.** The type cannot express that, so
 *    {@link RatingAggregate} exists as the shape both this module's own
 *    aggregate endpoint AND the shop composite's `shop.listing_review_summary`
 *    projection answer with — and `model/rating.ts` is the one place allowed
 *    to decide what a zero means.
 */
import type { components, operations } from "./generated/schema.js";

/** Every component schema stapel-reviews declares. */
export type Schemas = components["schemas"];

/** One review of an opaque target, with the owner's reply when there is one. */
export type Review = Schemas["ReviewResponse"];

/** The target owner's single reply to a review. */
export type ReviewOwnerResponse = Schemas["ResponseResponse"];

/** `POST /reviews` request body. */
export type ReviewCreateRequest = Schemas["ReviewCreateRequest"];

/**
 * `GET /reviews/aggregate` 200 body — the module-owned aggregate for ONE
 * target, carrying the target it is about.
 */
export type ReviewAggregate = Schemas["AggregateResponse"];

/**
 * The 200 body of `GET /reviews` — core's `AnchorPagination` envelope,
 * generated since 0.3.0 (see this module's header).
 *
 * `count` is the number of rows in THIS page, not the total; the total number
 * of published reviews is the aggregate's `count`, which is a different number
 * computed a different way.
 */
export type ReviewPage = Schemas["ReviewPage"];

/** The generated query surface of `GET /reviews`. */
type ReviewListQuery = NonNullable<
  operations["reviews_api_v1_reviews_retrieve"]["parameters"]["query"]
>;

/**
 * A review's visibility, as `models.ReviewStatus` spells it.
 *
 * - `published` — visible to everyone and counted in the aggregate.
 * - `pending` — created under PRE-moderation; invisible until a moderator
 *   publishes it, **including to its own author**, who therefore cannot see
 *   the review they just wrote in the published-only list.
 * - `hidden` — moderated out; invisible and excluded from the aggregate.
 *
 * Only reachable in a list response when the caller asked for `include=all`
 * AND the target type's `can_moderate` callback said yes; a non-moderator's
 * `include=all` is silently narrowed to published (`views.py`).
 */
export type ReviewStatus = "pending" | "published" | "hidden";

/**
 * The two halves of the module's opaque address. There is no foreign key
 * anywhere in stapel-reviews: `target_type` is a key the HOST registered in
 * `STAPEL_REVIEWS["TARGET_TYPES"]` (the built-in registry is EMPTY) and
 * `target_key` is a host-owned string the module stores, groups by, and never
 * parses.
 *
 * This package therefore ships no target-type constants — not even
 * `"listing"`. The catalogue shop composite registers that name in its own
 * preset (`stapel_shop/preset.py`), a different deployment registers
 * `"seller"` or `"course"`, and a library that guessed would be wrong for
 * every host but one.
 */
export interface ReviewTarget {
  readonly targetType: string;
  readonly targetKey: string;
}

/** The rating roll-up itself, without the target it belongs to.
 *
 * Deliberately the same two field names the composite's projection uses
 * (`shop.listing_review_summary` → `{avg, count}`, `stapel_shop/models.py`):
 * a seller-level rating is computed by the composite and handed to this
 * pair's display as data, because stapel-reviews can only aggregate ONE
 * `(target_type, target_key)` at a time and has no roll-up endpoint. Same
 * shape in, same rendering out — see {@link ratingSummary}. */
export interface RatingAggregate {
  /** Mean rating over PUBLISHED reviews. `0` when `count` is `0` — which is
   * "nobody has rated this", never "everyone rated it zero". */
  readonly avg: number;
  /** Number of published reviews. */
  readonly count: number;
}

/**
 * Anchor-pagination direction — the enum the schema now carries. The review
 * list is ordered `-created_at`, so:
 *
 * - `next` (default) — reviews OLDER than the anchor (the load-more direction),
 * - `prev` — reviews NEWER than the anchor,
 * - `center` — a window around the anchor.
 */
export type ReviewAnchorDirection = NonNullable<ReviewListQuery["direction"]>;

/**
 * Query for `GET /reviews`: the generated parameters, with only the target
 * pair renamed to this package's camelCase {@link ReviewTarget}. Nothing here
 * is hand-typed any more — `include`, `anchor`, `limit` and `direction` are
 * exactly what the contract declares.
 *
 * `target_type`/`target_key` are required by the view (a missing one is
 * `error.400.reviews_unknown_target_type`, not an empty list). `anchor` is a
 * `created_at` ISO timestamp and exclusive. `include` is typed `string`
 * because the schema declares no enum for it: the view acts on the literal
 * `"all"` and treats anything else as published-only, silently — which is why
 * the hook option that offers it (`UseReviewListOptions.include`) narrows to
 * the one value the server actually reads.
 */
export interface ReviewListParams
  extends ReviewTarget,
    Omit<ReviewListQuery, "target_type" | "target_key"> {}
