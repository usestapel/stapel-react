/**
 * Namespaced TanStack Query keys (frontend-standard §2 — namespaced keys).
 * Everything under the `"listings"` root so a host can invalidate the whole
 * module or match a single read. Explicit tuple return types satisfy
 * `--isolatedDeclarations`.
 *
 * THE KEY IS THE REQUEST for the paginated reads: a page is keyed on the very
 * parameter object the client is handed, normalized so that "no cursor" and
 * "an explicitly undefined cursor" cannot cache twice. Two states that
 * produce the same request therefore share a cache entry, and one that
 * produces a different request cannot silently reuse a page — the stale-page
 * bug (new filter, cached rows) is unwritable rather than merely avoided.
 */
import { engagementIds } from "../api/types.js";
import type { ListingPageParams } from "../api/types.js";

/** The normalized page cursor a list read is keyed on. */
export interface ListingPageKey {
  readonly anchor: string | null;
  readonly direction: string | null;
  readonly limit: number | null;
}

/** Normalize a page's parameters into its key. Exported because a test that
 * asserts "these two states hit one cache entry" must build the key the same
 * way the hook does. */
export function pageKey(params?: ListingPageParams): ListingPageKey {
  return {
    anchor: params?.anchor ?? null,
    direction: params?.direction ?? null,
    limit: params?.limit ?? null,
  };
}

const ROOT = "listings" as const;

export const listingsQueryKeys: {
  readonly all: readonly ["listings"];
  /** The published card list. */
  list(page: ListingPageKey): readonly ["listings", "list", ListingPageKey];
  /** One listing in full. */
  detail(id: number): readonly ["listings", "detail", number];
  /** The AllowAny status probe — a SEPARATE entry from the detail on purpose:
   * it answers for a soft-deleted listing the detail 404s on, so caching them
   * together would let a 404 evict the one read that can explain it. */
  status(id: number): readonly ["listings", "status", number];
  /** The dashboard's three counts. */
  myCounters(): readonly ["listings", "my", "counters"];
  /** The caller's favourites, one keyset page. */
  myFavorites(
    page: ListingPageKey
  ): readonly ["listings", "my", "favorites", ListingPageKey];
  /** The owner's own rows, per tab (`GET my/listings/?status=…`). */
  mine(
    tab: string,
    page: ListingPageKey
  ): readonly ["listings", "my", "listings", string, ListingPageKey];
  /** The owner's rows no tab folds in — a takedown. A sibling of `mine` and
   * not one of its tabs, because it answers a different question and must not
   * be evicted when a tab pages. */
  mineUntabbed(): readonly ["listings", "my", "listings", "untabbed"];
  /** Every owner-row page, for an invalidation after a write. */
  allMine(): readonly ["listings", "my", "listings"];
  /** `GET /{pk}/validate-draft/` — the dry run of a publish. */
  validateDraft(id: number): readonly ["listings", "validate-draft", number];
  /** Every favourites PAGE, for an invalidation after a toggle — the cursor
   * is not known at the write, so the prefix is what a write can target. */
  allFavorites(): readonly ["listings", "my", "favorites"];
  /** Every published-card PAGE, same reason. */
  allLists(): readonly ["listings", "list"];
  /**
   * The per-viewer overlay for one page of ids.
   *
   * Keyed on the NORMALIZED list (`engagementIds`: sorted, de-duplicated,
   * capped) and joined into one string, which is the same value the request
   * sends. The doctrine at the top of this file applied to a batch read: two
   * renders asking for the same ids in a different order are asking the
   * identical question — the answer is a map keyed by id and carries no order
   * of its own — so they must share one cache entry and cost one request.
   * Keyed on the raw array they would cost two, per re-render, per grid.
   */
  engagement(ids: readonly number[]): readonly ["listings", "engagement", string];
} = {
  all: [ROOT],
  list: (page) => [ROOT, "list", page],
  detail: (id) => [ROOT, "detail", id],
  status: (id) => [ROOT, "status", id],
  myCounters: () => [ROOT, "my", "counters"],
  myFavorites: (page) => [ROOT, "my", "favorites", page],
  mine: (tab, page) => [ROOT, "my", "listings", tab, page],
  mineUntabbed: () => [ROOT, "my", "listings", "untabbed"],
  allMine: () => [ROOT, "my", "listings"],
  validateDraft: (id) => [ROOT, "validate-draft", id],
  allFavorites: () => [ROOT, "my", "favorites"],
  allLists: () => [ROOT, "list"],
  engagement: (ids) => [ROOT, "engagement", engagementIds(ids).join(",")],
};
