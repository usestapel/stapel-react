/**
 * What a rating MEANS, kept in one pure module so a card, a panel and a
 * seller header cannot each decide differently.
 *
 * The whole file exists for one line of the contract: `avg` is `0.0` when
 * `count` is `0` (`services.aggregate`, and `AggregateResponse`'s own
 * description says so). Rendered naively that is a zero-star rating — the
 * worst possible score — printed over a target nobody has rated yet. It is the
 * same class of defect as `data ?? []`: a value that was never measured
 * displayed as if it had been measured and found to be nothing.
 *
 * So {@link ratingSummary} answers `rated: false` for that case and the star
 * row has nothing to draw. There is no way to get an `avg` out of this module
 * without also getting the flag that says whether it means anything.
 */
import type { RatingAggregate } from "../api/types.js";

/** An aggregate, read. */
export type RatingSummary =
  | {
      /** Nobody has published a review of this target. */
      readonly rated: false;
      readonly count: 0;
      /** Deliberately absent: there is no average of an empty set. */
      readonly avg?: undefined;
      readonly rounded?: undefined;
    }
  | {
      readonly rated: true;
      readonly count: number;
      /** Mean over published reviews, as the server computed it (3 decimals). */
      readonly avg: number;
      /** The same mean at display precision — one decimal, half-up. */
      readonly rounded: number;
    };

/**
 * Round half-up to one decimal for display. `Math.round` is already half-up
 * for positives and ratings are positive, but the float dance is written out
 * so 4.25 → 4.3 rather than 4.2 (binary representation makes
 * `Math.round(4.25 * 10)` unreliable across engines otherwise).
 */
function oneDecimal(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/**
 * Read an aggregate — from this module's own `GET /reviews/aggregate`, or from
 * the composite's `shop.listing_review_summary` projection, which answers the
 * same two field names on purpose (`stapel_shop/projections.py`: "the owner's
 * names ARE the contract shape here").
 *
 * A `count` of 0 is "not rated", whatever `avg` says. A negative or
 * non-finite `count` is treated the same way rather than trusted: this is the
 * one place a bad number can enter the display layer.
 */
export function ratingSummary(
  aggregate: RatingAggregate | null | undefined
): RatingSummary {
  const count = aggregate?.count;
  if (
    aggregate === null ||
    aggregate === undefined ||
    typeof count !== "number" ||
    !Number.isFinite(count) ||
    count <= 0
  ) {
    return { rated: false, count: 0 };
  }
  const avg = Number.isFinite(aggregate.avg) ? aggregate.avg : 0;
  return { rated: true, count, avg, rounded: oneDecimal(avg) };
}

/**
 * How many whole, half and empty stars a `rounded` average draws, for a skin
 * that renders stars rather than a number.
 *
 * `max` is the deployment's `RATING_MAX` (the runtime's `ratingBounds.max`),
 * not a hardcoded five — a 1..10 deployment draws ten.
 */
export interface StarBreakdown {
  readonly full: number;
  readonly half: 0 | 1;
  readonly empty: number;
}

export function starBreakdown(rounded: number, max: number): StarBreakdown {
  const clamped = Math.min(Math.max(rounded, 0), max);
  const full = Math.floor(clamped);
  const remainder = clamped - full;
  // A remainder of a quarter or more is a half star; anything less rounds
  // away. The alternative — a partial-width star — is a skin's business, and
  // this breakdown stays a count so a non-antd skin can use it too.
  const half: 0 | 1 = remainder >= 0.25 && remainder < 0.75 ? 1 : 0;
  const rounded_up = remainder >= 0.75 ? 1 : 0;
  return {
    full: full + rounded_up,
    half,
    empty: max - full - rounded_up - half,
  };
}
