import type { ReactElement, ReactNode } from "react";
import { loadFailed, loadLoading, loadReady } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { RatingAggregate, ReviewTarget } from "../api/types.js";
import { useReviewsRuntime } from "../model/context.js";
import { useReviewAggregate } from "../model/queries.js";
import { ratingSummary } from "../model/rating.js";
import type { RatingSummary } from "../model/rating.js";

/** What `<ReviewAggregate>` hands its render prop. */
export interface ReviewAggregateBag {
  /**
   * The rating, READ — `rated: false` when nobody has rated the target, so a
   * skin can never print the zero the wire carries in that case.
   */
  readonly state: LoadState<RatingSummary>;
  /** Where the number came from. */
  readonly source: "fetched" | "supplied";
  /** The deployment's rating ceiling, for a star row that draws `max` stars. */
  readonly max: number;
}

export interface ReviewAggregateProps {
  /**
   * What this rating is ABOUT. Always required, even when {@link aggregate}
   * is supplied and nothing is fetched: it is the identity of the thing being
   * rated, it keys the cache, and a rating rendered without one is a number
   * nobody can trace back to a subject.
   */
  readonly target: ReviewTarget;
  /**
   * Numbers somebody else computed. Supplying them makes this component a
   * pure display: no request is made, and `source` reports `"supplied"`.
   */
  readonly aggregate?: RatingAggregate;
  readonly children: (bag: ReviewAggregateBag) => ReactNode;
}

/**
 * The headless rating display — the same bag whether the number came from
 * this module or from the composite. `AllowAny` upstream since 0.3.0, so a
 * guest sees the rating and there is no "sign in" state here.
 *
 * ── Why `aggregate` is a prop, and not a second endpoint ───────────────────
 *
 * stapel-reviews can aggregate exactly ONE `(target_type, target_key)` per
 * call. The storefront's product decision (spec fork F5) is that a review
 * targets the SELLER for a specific listing — `target_type: "listing"`, one
 * per author per listing — and the seller's own rating is therefore a ROLL-UP
 * across every listing they own. No endpoint computes that: the composite
 * does, server-side, as `shop.listing_review_summary`
 * (`stapel_shop/projections.py`), and the roll-up over a seller's keys is the
 * composite's projection to publish, on its own route.
 *
 * So this pair does the half it can honestly do: it renders `{avg, count}` —
 * the projection's own field names, chosen upstream precisely so both modes
 * answer one shape — from wherever the host got them. `source` says which,
 * so a skin that wants to (a demo, an admin view) can show it. A seller
 * header therefore reads
 * `<ReviewAggregate target={{targetType: "seller", targetKey: id}}
 * aggregate={rollup}>`: the target names the subject, the numbers come from
 * the composite, and no request is made against an endpoint that could not
 * have answered it.
 *
 * The gap is real and is recorded in the README rather than papered over with
 * N+1 requests: a page that wants a seller rating today must be served the
 * two numbers by its own backend.
 */
export function ReviewAggregate(props: ReviewAggregateProps): ReactElement {
  const runtime = useReviewsRuntime();
  const supplied = props.aggregate;
  const query = useReviewAggregate(props.target, {
    enabled: supplied === undefined,
  });

  const state: LoadState<RatingSummary> =
    supplied !== undefined
      ? loadReady(ratingSummary(supplied))
      : query.status === "error"
        ? loadFailed(query.error)
        : query.data === undefined
          ? loadLoading()
          : loadReady(ratingSummary(query.data));

  return (
    <>
      {props.children({
        state,
        source: supplied !== undefined ? "supplied" : "fetched",
        max: runtime.ratingBounds.max,
      })}
    </>
  );
}
