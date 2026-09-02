/**
 * "Have I already seen this one?" — the engagement axis of a listing row.
 *
 * A classified's results page is mostly re-reading: the same twenty offers
 * scrolled past for the third evening in a row. Every mature one marks the
 * rows you already opened, and a shopper who cannot see which those are is
 * paying attention to the same card repeatedly. `is_viewed` is that mark and
 * `view_count` is the seller-facing counterpart on the listing page.
 *
 * ── This module exists because the contract is LANDING, not live ───────────
 *
 * Neither field is in any response the fleet answers today, and neither is in
 * the generated schema (which is emitted, not written — see
 * {@link ListingEngagementFields} for where the optional declaration lives and
 * why it is not in `api/generated/schema.ts`). Three surfaces want the answer,
 * so three surfaces would each grow their own `row.is_viewed === true` and
 * their own opinion about `null` — and the day the field arrives with a
 * different nullability, three places would have to be found. One reader is
 * one place.
 *
 * The rule every function here keeps: **absent, `null` and `NaN` all mean
 * "draw nothing extra"**. No dimming, no number, no warning, no log line. A
 * pair that printed "0 views" for a field the server never sent would be
 * inventing a fact about the seller's listing; a pair that logged the absence
 * would fill a storefront's console with a message about a release that has
 * not shipped.
 *
 * ── What upstream has actually built, and what this module does NOT do ────
 *
 * stapel-listings' own schema already carries the two fields on the row —
 * under the names {@link ListingEngagementFields} declares — and ALSO a batch
 * overlay, `GET /listings/engagement/`, returning `{listing id: {viewed,
 * view_count, is_favorited}}`. The overlay exists because a storefront's grid
 * is served by the SEARCH index, whose stored card can carry neither a flag
 * that differs per reader nor a counter that moves faster than a re-indexed
 * document; a grid drawn from search asks the overlay once for the page.
 *
 * This pair reads the ROW, which is what its own card and detail responses
 * carry, and does not call the overlay. Wiring it is a real piece of work
 * with a home of its own — one request per page, keyed by the ids a
 * container assembled, merged over rows this package never fetched — and it
 * belongs to whichever surface owns the grid, not to a reader function. It is
 * written down here so the next person finds the endpoint instead of
 * concluding the data does not exist.
 */
import type { ListingEngagementFields } from "../api/types.js";

/**
 * Has this reader already opened this listing?
 *
 * `true` and only `true`. `null` is "we did not ask on this person's behalf"
 * — the same third state `is_favorited` carries for an anonymous read — and a
 * row nobody asked about is not a row somebody has seen.
 *
 * Both spellings of the flag are read: the contract note says `is_viewed` and
 * the emitted schema says `viewed`, neither has shipped, and betting on one
 * would render nothing at all for the other with no error anywhere. See
 * {@link ListingEngagementFields}.
 */
export function isListingViewed(
  row: ListingEngagementFields | undefined
): boolean {
  return row?.is_viewed === true || row?.viewed === true;
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
