/**
 * Demo fixtures — real response BODIES, shaped exactly as stapel-reviews
 * sends them, so a demo exercises the same parsing a stand would.
 *
 * Two shapes here are the pair's whole subject, and both are places where the
 * declared contract and the running view disagree:
 *
 * - the list answers core's `AnchorPagination` ENVELOPE (`{items, …}`), not
 *   the bare array `docs/schema.json` declares;
 * - an unrated target answers `{"avg": 0.0, "count": 0}` — a zero that means
 *   "nobody has rated this", never "rated zero".
 */
import type { Review, ReviewAggregateResponse, ReviewPage } from "../src/index.js";

export const DEMO_TARGET = { targetType: "listing", targetKey: "42" } as const;

function review(
  id: string,
  rating: number,
  body: string,
  extra: Partial<Review> = {}
): Review {
  return {
    id,
    target_type: DEMO_TARGET.targetType,
    target_key: DEMO_TARGET.targetKey,
    author_id: `user-${id}`,
    rating,
    body,
    status: "published",
    created_at: `2026-08-1${id}T10:00:00Z`,
    response: null,
    ...extra,
  };
}

/** A page of published rows, one of them carrying the owner's reply. */
export const DEMO_PAGE: ReviewPage = {
  items: [
    review("1", 5, "demo.review.body.good", {
      response: {
        author_id: "seller-1",
        body: "demo.review.response.thanks",
        created_at: "2026-08-11T12:00:00Z",
      },
    }),
    review("2", 4, "demo.review.body.ok"),
    review("3", 2, ""),
  ],
  next_anchor: "2026-08-13T10:00:00Z",
  prev_anchor: null,
  has_next: true,
  has_prev: false,
  count: 3,
};

/** What a moderator asking `include=all` sees: the two invisible states. */
export const DEMO_PAGE_ALL: ReviewPage = {
  ...DEMO_PAGE,
  items: [
    ...DEMO_PAGE.items,
    review("4", 1, "demo.review.body.pending", { status: "pending" }),
    review("5", 1, "demo.review.body.hidden", { status: "hidden" }),
    // A state this build does not know — named on screen, not rendered as an
    // ordinary review and not a crash.
    review("6", 3, "demo.review.body.future", { status: "quarantined" }),
  ],
  has_next: false,
  next_anchor: null,
  count: 6,
};

export const DEMO_AGGREGATE: ReviewAggregateResponse = {
  target_type: DEMO_TARGET.targetType,
  target_key: DEMO_TARGET.targetKey,
  avg: 4.25,
  count: 12,
};

/** The trap: a real answer from the server about a target nobody has rated. */
export const DEMO_AGGREGATE_UNRATED: ReviewAggregateResponse = {
  target_type: DEMO_TARGET.targetType,
  target_key: "99",
  avg: 0.0,
  count: 0,
};

/** The composite's roll-up, in the projection's own two field names. */
export const DEMO_SELLER_ROLLUP = { avg: 4.8, count: 137 } as const;
