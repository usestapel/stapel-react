/**
 * THE GAP: stapel-listings cannot list a person their own listings.
 *
 * This is the one place in the pair where a contract is missing rather than
 * awkward, so it gets its own module and its own name.
 *
 * `GET /listings/` answers `qs.published()` and takes no owner parameter
 * (`views.ListingViewSet.get_queryset`): it returns the whole marketplace's
 * shop window and can be narrowed to nobody. The only owner-scoped reads in
 * the module are `my/counters` (three integers) and `my/favorites`. So a
 * seller's own DRAFTS are unreachable by any call this contract offers — and
 * drafts are not indexed either, so routing around it through
 * `@stapel/search-react`'s `owner=` would return the published subset and
 * quietly call it "everything".
 *
 * The storefront spec assumed `GET /listings/` was "for mine" (§4.1). It is
 * not, and this pair records the gap rather than papering over it.
 *
 * Two upstream asks, in preference order:
 *  1. an `?owner=me` filter (or a `my/listings` action) on the list endpoint,
 *     with the same `IDAnchorPagination` envelope the other two use;
 *  2. failing that, a `status` filter on it, so at least the published subset
 *     can be narrowed without a search module.
 *
 * Until then a host injects a {@link MyListingsSource} and the dashboard
 * works completely; without one it shows the real counters and NAMES the
 * absence, because "we cannot ask" and "you have no listings" are different
 * sentences.
 */
import { StapelApiError } from "@stapel/core";
import type { ListingPageParams, PaginatedListingCards } from "../api/types.js";
import type { MyListingsTab } from "./status.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";

/** One page of the caller's own listings, however the host can get them. */
export type MyListingsSource = (args: {
  readonly tab: MyListingsTab;
  readonly page: ListingPageParams;
  readonly signal?: AbortSignal;
}) => Promise<PaginatedListingCards>;

/**
 * The error a dashboard without a source reports.
 *
 * `status: 0` on purpose: this is a fact about the deployment's wiring, not
 * something a server said, and a client-side refusal must never be
 * indistinguishable from one that came over the wire.
 */
export const MY_LISTINGS_SOURCE_MISSING: StapelApiError = new StapelApiError({
  code: LISTINGS_I18N_KEYS.mineSourceMissing,
  message:
    "No MyListingsSource was supplied, and stapel-listings has no " +
    "owner-scoped list endpoint to fall back on.",
  status: 0,
});
