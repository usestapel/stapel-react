/**
 * The pair's public wire types — projected from the GENERATED schema
 * (`api/generated/schema.ts`, emitted by `pnpm gen:api` from stapel-reviews'
 * own `docs/schema.json`), never re-typed by hand.
 *
 * Four corrections are applied here rather than silently, because each one is
 * a place where the declared contract and the running view disagree and a
 * screen built on the declaration alone would break:
 *
 * 1. **`GET /reviews` does not answer an array.** The schema says
 *    `200: ReviewResponse[]`, and the view returns
 *    `paginator.get_paginated_response(data)` — core's `AnchorPagination`
 *    envelope (`{items, next_anchor, prev_anchor, has_next, has_prev,
 *    count}`). drf-spectacular never learns about the paginator because
 *    `ReviewListCreateView` is a plain `APIView` that instantiates
 *    `ReviewAnchorPagination` inside `get()` instead of declaring a
 *    `pagination_class`. {@link ReviewPage} is the shape that actually
 *    arrives; an upstream ask is recorded in the contract pin.
 * 2. **Its `anchor` / `limit` / `direction` query parameters are undeclared
 *    for the same reason.** v0.2.2 declared `target_type`, `target_key` and
 *    `include`, which is what unblocked this pair; the paginator's own three
 *    are still invisible to the schema. {@link ReviewListParams} names them.
 *    The anchor is a `created_at` ISO timestamp (`anchor_field = "created_at"`,
 *    `ordering = "-created_at"`), not an id and not a `seq`.
 * 3. **`status` is a bare `string` on the wire** and a three-member lifecycle
 *    in the model (`ReviewStatus`). {@link ReviewStatus} names the three
 *    WITHOUT narrowing a parsed value: a fourth state added upstream must
 *    render as an unknown state, not crash a switch.
 * 4. **`avg` is `0.0` when `count` is `0`.** The type cannot express that, so
 *    {@link RatingAggregate} exists as the shape both this module's own
 *    aggregate endpoint AND the shop composite's `shop.listing_review_summary`
 *    projection answer with — and `model/rating.ts` is the one place allowed
 *    to decide what a zero means.
 */
import type { components } from "./generated/schema.js";

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
 * Anchor-pagination direction (core `AnchorPagination`). The review list is
 * ordered `-created_at`, so:
 *
 * - `next` (default) — reviews OLDER than the anchor (the load-more direction),
 * - `prev` — reviews NEWER than the anchor,
 * - `center` — a window around the anchor.
 */
export type ReviewAnchorDirection = "next" | "prev" | "center";

/**
 * Query for `GET /reviews`. `targetType`/`targetKey` are required by the view
 * (a missing one is `error.400.reviews_unknown_target_type`, not an empty
 * list); the rest are the paginator's, and none of the three appear in the
 * generated schema — see this module's header.
 */
export interface ReviewListParams extends ReviewTarget {
  /**
   * Ask for pending/hidden rows too. Honoured only for a moderator/owner of
   * the target; anyone else is narrowed to published SILENTLY, so a UI must
   * never promise "showing hidden reviews" on the strength of having asked.
   */
  readonly include?: "all";
  /** A `created_at` ISO timestamp — exclusive, from a page's `next_anchor`. */
  readonly anchor?: string;
  readonly direction?: ReviewAnchorDirection;
  readonly limit?: number;
}

/**
 * The 200 body of `GET /reviews` — core's `AnchorPagination` envelope, which
 * the schema does not declare (see this module's header). `count` is the
 * number of rows in THIS page, not the total; the total number of published
 * reviews is the aggregate's `count`, which is a different number computed a
 * different way.
 */
export interface ReviewPage {
  readonly items: readonly Review[];
  readonly next_anchor: string | null;
  readonly prev_anchor: string | null;
  readonly has_next: boolean;
  readonly has_prev: boolean;
  readonly count: number;
}
