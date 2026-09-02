/**
 * "Have I already seen this one?" — the engagement axis of a listing row, and
 * the OVERLAY that is the only way a storefront ever gets an answer.
 *
 * A classified's results page is mostly re-reading: the same twenty offers
 * scrolled past for the third evening in a row. Every mature one marks the
 * rows you already opened, and a shopper who cannot see which those are is
 * paying attention to the same card repeatedly. `viewed` is that mark and
 * `view_count` is the seller-facing counterpart on the listing page.
 *
 * ── Why the row alone is not enough, and the overlay is the load-bearing half
 *
 * stapel-listings puts `viewed` / `view_count` on its own card and detail
 * serializers, and on the listing PAGE that is the end of the story. But the
 * two surfaces a buyer actually scrolls — the home feed and the SERP — are
 * not served by this module at all: their cards come out of the SEARCH index,
 * whose stored document can carry neither a flag that differs per reader nor
 * a counter that moves faster than a re-index. So on exactly the screens the
 * feature exists for, `viewed` and `is_favorited` never arrive on the row,
 * every card renders undimmed with an outline heart, and nothing anywhere
 * reports a problem.
 *
 * `GET /listings/engagement/?ids=…` is the answer the backend built for it:
 * ONE call for a whole page, `{id: {view_count, viewed, is_favorited}}`,
 * `AllowAny` so a signed-out grid is not a second code path. This module is
 * the READING side of it — what a row means, how one entry is found in a
 * batch, and how an entry is laid over a row a container fetched from
 * somewhere else. The id normalizer both the request and its cache key are
 * built from lives with the wire types (`engagementIds`), because the cap it
 * enforces is the server's.
 *
 * ── The rule every function here keeps ────────────────────────────────────
 *
 * **Absent, `null` and `NaN` all mean "draw nothing extra".** No dimming, no
 * number, no warning, no log line, and — for a failed overlay — no banner
 * over a grid that is otherwise working. A pair that printed "0 views" for a
 * field the server never sent would be inventing a fact about a seller's
 * listing; a pair that turned a decoration's 500 into an error state would
 * have taken a working results page away from a shopper over a flag. A grid
 * that renders is worth more than a flag.
 */
import type {
  ListingCard,
  ListingEngagement,
  ListingEngagementBatch,
  ListingEngagementFields,
} from "../api/types.js";

/**
 * Has this reader already opened this listing?
 *
 * `true` and only `true`. `null` is "we did not ask on this person's behalf"
 * — the same third state `is_favorited` carries for an anonymous read — and a
 * row nobody asked about is not a row somebody has seen.
 */
export function isListingViewed(
  row: ListingEngagementFields | undefined
): boolean {
  return row?.viewed === true;
}

/**
 * How many times the listing has been opened, or `undefined` where there is
 * no number to show.
 *
 * `Number.isFinite` rather than `typeof === "number"`: a JSON `NaN` cannot
 * arrive, but a count computed by a host from something absent can, and
 * "NaN views" on a seller's page is worse than no line at all. Zero IS a
 * number and is rendered — "0 views" is a true and useful thing to tell a
 * seller, and the case it must not be confused with (the field is missing) is
 * already `undefined` here.
 */
export function listingViewCount(
  row: ListingEngagementFields | undefined
): number | undefined {
  const raw = row?.view_count;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

/**
 * One listing's entry out of a batch answer, or `undefined`.
 *
 * The wire keys are STRINGS and an id with no listing is simply absent, so
 * this is a lookup rather than an index: `batch.items[id]` would be a type
 * error today and a silent `undefined` tomorrow.
 */
export function engagementFor(
  batch: ListingEngagementBatch | undefined,
  id: number
): ListingEngagement | undefined {
  return batch?.items[String(id)];
}

/**
 * Lay an overlay entry over a row, so a card reads ONE object whatever its
 * provenance.
 *
 * The overlay wins where it speaks, and it speaks about all three of its
 * fields at once — it is the answer to a question that was actually asked on
 * this reader's behalf, and the row (a search document, or a card serialized
 * before the fields existed) is at best older and at worst silent. Where
 * there is no overlay entry the row is returned UNCHANGED, by identity: a
 * missing id, an overlay that has not loaded, and an overlay that failed are
 * the same "we know nothing more than the row does", and none of them may
 * fabricate a `false`.
 */
export function withEngagement(
  row: ListingCard,
  overlay: ListingEngagement | undefined
): ListingCard {
  if (overlay === undefined) return row;
  return {
    ...row,
    viewed: overlay.viewed,
    view_count: overlay.view_count,
    is_favorited: overlay.is_favorited,
  };
}
