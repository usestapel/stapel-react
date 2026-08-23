/**
 * THE GAP, AND THE ROUTE THAT CLOSED IT.
 *
 * This file used to open "stapel-listings cannot list a person their own
 * listings", and that was the only place in the pair where a contract was
 * missing rather than awkward. `GET /listings/` answers `qs.published()` and
 * takes no owner parameter (`views.ListingViewSet.get_queryset`): it returns
 * the whole marketplace's shop window and can be narrowed to nobody. The only
 * owner-scoped reads were `my/counters` (three integers) and `my/favorites`,
 * so a seller's own DRAFTS were unreachable by any call the contract offered
 * — and drafts are not indexed either, so routing around it through
 * `@stapel/search-react`'s `owner=` would have returned the published subset
 * and quietly called it "everything". The dashboard shipped with a
 * host-injected source and NAMED the absence on screen, because "we cannot
 * ask" and "you have no listings" are different sentences.
 *
 * **stapel-listings 0.7.0 answers it**: `GET /listings/my/listings/`, the
 * caller's own rows in every status, `?status=` for a tab's set, the same
 * `IDAnchorPagination` envelope the other two owner reads use. So
 * {@link defaultMyListingsSource} is what the dashboard runs on now, and
 * there is no failure state left to name — the missing-source error and its
 * i18n key are gone rather than kept as a comment about a thing that no
 * longer happens.
 *
 * {@link MyListingsSource} stays, as a seam and not as a workaround: a
 * deployment that keeps its sellers' rows somewhere else (a read model, a
 * legacy table, a host that has already fetched the page) hands one in and
 * the dashboard renders it unchanged. What it must return is one page of the
 * owner card — including the `moderation_status` and the `*_draft` twins,
 * which is why the type is {@link PaginatedMyListingCards} and not the public
 * card envelope.
 */
import type { ListingsApi } from "../api/listingsApi.js";
import type { MyListingsParams, PaginatedMyListingCards } from "../api/types.js";
import type { MyListingsTab } from "./status.js";
import { MY_LISTINGS_TAB_STATUSES } from "./status.js";

/** One page of the caller's own listings, however the host gets them. */
export type MyListingsSource = (args: {
  readonly tab: MyListingsTab;
  readonly page: MyListingsParams;
  readonly signal?: AbortSignal;
}) => Promise<PaginatedMyListingCards>;

/**
 * The source the dashboard uses unless a host replaces it: the contract's own
 * route, narrowed to the tab's statuses.
 *
 * The tab → statuses table is `MY_LISTINGS_TAB_STATUSES`, which is a copy of
 * the SERVER's grouping in `views.my_counters`. That is the whole point: the
 * rows this fetches and the count on the tab beside them are the same set,
 * asserted upstream (`tests/test_my_listings.py`) and here.
 */
export function defaultMyListingsSource(api: ListingsApi): MyListingsSource {
  return ({ tab, page, signal }) =>
    api.myListings(
      { ...page, status: MY_LISTINGS_TAB_STATUSES[tab] },
      signal !== undefined ? { signal } : {}
    );
}
