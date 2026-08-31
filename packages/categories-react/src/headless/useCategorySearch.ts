/**
 * `useCategorySearch` — a typed query reaches a CATEGORY, headless.
 *
 * The owner's complaint was not "there is no picker". The navigation model
 * deliberately has none: level 1 and level 2 are tiles, everything deeper is a
 * characteristic chosen in a cascading selector (`catalog/tiles.ts`). What was
 * missing is that the search field could not land a person in a category at
 * all — the one word they know about what they want was good for results and
 * for nothing else.
 *
 * ── The two properties that make this cheap enough to run per keystroke ────
 *
 * 1. **It issues no request.** It reads the delta-synced catalogue that is
 *    already in memory (`useCategoryCatalog`, one query key, a five-minute
 *    stale time), so typing eight characters costs eight passes over an
 *    in-memory array and zero network calls. A hook that queried per keystroke
 *    would need debouncing, cancellation and a spinner; this needs none of
 *    them because there is nothing in flight.
 * 2. **It reuses the BROWSE PROJECTION.** The tree it walks has already
 *    dropped inactive, deleted and test rows (`catalog/browse.ts`), so a query
 *    cannot surface a category the tiles refuse to show. Search that reached
 *    rows browsing hides would be a second, contradictory catalogue.
 *
 * The ranking, the folding and the cap are pure and live in `catalog/search.ts`
 * — testable without React, and reusable by a host that has its own hook.
 */
import { useMemo } from "react";
import { flattenCategoryNodes } from "../catalog/tree.js";
import { rankCategoryMatches } from "../catalog/search.js";
import type { CategorySearchHit } from "../catalog/search.js";
import { useCategoryCatalog } from "../model/queries.js";
import type { UseCategoryCatalogOptions } from "../model/queries.js";

export interface UseCategorySearchOptions extends UseCategoryCatalogOptions {
  /**
   * Resolve a translation key to a caption, so the match runs against what the
   * person can READ. Category names arrive as translation keys
   * (`catalog/labels.ts`); without this, "phones" matches nothing on a
   * catalogue whose rows say `category.phones`, and the honest fallback is to
   * match the key.
   */
  readonly translate?: (key: string) => string;
  /** Path prefix for a hit's link. Default `/c`. */
  readonly basePath?: string;
  /** Cap on the number of hits. Default `CATEGORY_SEARCH_LIMIT`. */
  readonly limit?: number;
}

/**
 * Categories matching `query`, ranked and capped.
 *
 * Returns an ARRAY, not a `LoadState`, and that is deliberate: this is a
 * secondary hint above somebody else's results, and "the catalogue is still
 * syncing" has the same correct rendering as "nothing matched" — nothing.
 * A skin that wanted to say more would be adding a second load story to a
 * screen that already has one.
 *
 * ```tsx
 * const hits = useCategorySearch(q, { translate: useT() });
 * <CategorySearchHits query={q} hits={hits} linkComponent={Link} />
 * ```
 */
export function useCategorySearch(
  query: string,
  options: UseCategorySearchOptions = {}
): readonly CategorySearchHit[] {
  const { translate, basePath, limit, ...catalogOptions } = options;
  const catalog = useCategoryCatalog(catalogOptions);
  // Reading `data` directly rather than through `loadStateFromQuery`: there is
  // no empty/failed distinction to preserve here, because both render as no
  // hints at all (see the note above). `undefined` is "not loaded yet", and it
  // is not defaulted to a collection that would then claim "no matches".
  const index = catalog.data === undefined ? null : catalog.data.index;

  return useMemo(() => {
    if (index === null) return [];
    return rankCategoryMatches(flattenCategoryNodes(index.roots), query, {
      ...(translate !== undefined ? { translate } : {}),
      ...(basePath !== undefined ? { basePath } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });
  }, [index, query, translate, basePath, limit]);
}
