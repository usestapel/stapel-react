/**
 * Demo fixtures — real response BODIES, shaped exactly as stapel-reviews
 * sends them, so a demo exercises the same parsing a stand would.
 *
 * Two shapes here are the pair's whole subject, and both are places where a
 * naive reading of the wire goes wrong:
 *
 * - the list answers core's `AnchorPagination` ENVELOPE (`{items, …}`), which
 *   `components/ReviewPage` has declared since stapel-reviews 0.3.0;
 * - an unrated target answers `{"avg": 0.0, "count": 0}` — a zero that means
 *   "nobody has rated this", never "rated zero".
 *
 * The review bodies are PROSE, not i18n keys. They were keys until the demos
 * started rendering the skin, at which point the showcase printed
 * `demo.review.body.good` as the text of a review (visual pass, class
 * C-RAWKEY). A review body is whatever a buyer typed — server data, not
 * library copy — so it belongs here as text, and it is why this file is `.ts`
 * with no JSX in it.
 */
import type {
  Review,
  ReviewAggregateResponse,
  ReviewOwnerResponse,
  ReviewPage,
} from "../src/index.js";

export const DEMO_TARGET = { targetType: "listing", targetKey: "42" } as const;

const REPLY: ReviewOwnerResponse = {
  author_id: "seller-1",
  body: "Thanks for the kind words — glad the drill found a good home.",
  created_at: "2026-08-11T12:00:00Z",
};

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
    review("1", 5, "Exactly as described, met at the metro, no fuss.", {
      response: REPLY,
    }),
    review("2", 4, "Works fine, box was a bit battered."),
    review("3", 2, ""),
  ],
  next_anchor: "2026-08-13T10:00:00Z",
  prev_anchor: null,
  has_next: true,
  has_prev: false,
  count: 3,
};

/** One page, ended — so the load-more control shows its "that is all" reason. */
export const DEMO_PAGE_LAST: ReviewPage = {
  ...DEMO_PAGE,
  has_next: false,
  next_anchor: null,
};

/** What a moderator asking `include=all` sees: the two invisible states. */
export const DEMO_PAGE_ALL: ReviewPage = {
  ...DEMO_PAGE,
  items: [
    ...DEMO_PAGE.items,
    review("4", 1, "Never turned up. Waited an hour.", { status: "pending" }),
    review("5", 1, "Contains a phone number and a rant.", { status: "hidden" }),
    // A state this build does not know — named on screen, not rendered as an
    // ordinary review and not a crash.
    review("6", 3, "Filed under a state this build predates.", {
      status: "quarantined",
    }),
  ],
  has_next: false,
  next_anchor: null,
  count: 6,
};

/** Nobody has reviewed this target — a state a GUEST can reach. */
export const DEMO_PAGE_EMPTY: ReviewPage = {
  items: [],
  next_anchor: null,
  prev_anchor: null,
  has_next: false,
  has_prev: false,
  count: 0,
};

/** A single review with no reply yet — the composer's subject. */
export const DEMO_UNANSWERED: Review = review(
  "7",
  4,
  "Good price, but the listing photos were three years old."
);

/** The same review, already answered. One reply per review, forever. */
export const DEMO_ANSWERED: Review = review(
  "8",
  5,
  "Second time buying from this seller. Same again.",
  { response: REPLY }
);

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

/** One review, one reviewer: the singular arm of the count plural. */
export const DEMO_AGGREGATE_ONE: ReviewAggregateResponse = {
  target_type: DEMO_TARGET.targetType,
  target_key: DEMO_TARGET.targetKey,
  avg: 5,
  count: 1,
};

/** A read that failed for real — not empty, not unauthenticated. */
export const DEMO_OUTAGE = [503, { localizable_error: "stapel.http.503" }] as const;
