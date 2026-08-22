/**
 * The sync walk: stored snapshot → one request or several → a fresh snapshot.
 *
 * Pure of React, so the same routine serves the hook, an SSR prefetch and a
 * test. The rules it enforces are all in `catalog/sync.ts`; this is the loop
 * that applies them, plus the two guards a loop over a paginated endpoint
 * needs:
 *
 *  - a **page budget**, because `has_next` is server-reported and a bug there
 *    (or a catalogue growing faster than the walk reads it) is an infinite
 *    request loop against someone's production API, not a slow render; and
 *  - **publish-on-completion**, so a walk that dies on page 3 leaves the
 *    previous catalogue intact instead of replacing it with two thirds of one.
 */
import type { CategoriesApi } from "../api/categoriesApi.js";
import type { CategoryListParams } from "../api/types.js";
import {
  EMPTY_SNAPSHOT,
  applyCategoryPage,
  firstPageRequest,
  isEmptySnapshot,
  nextPageRequest,
} from "../catalog/sync.js";
import type { CategorySnapshot } from "../catalog/sync.js";

/**
 * Hard ceiling on pages per sync. At the server's max `page_size` of 1000 this
 * is a million categories — far beyond any real catalogue, and small enough
 * that a runaway loop stops in seconds instead of hammering a backend.
 */
export const MAX_SYNC_PAGES = 1000;

export interface SyncCatalogOptions {
  readonly signal?: AbortSignal;
  /** Rows per request. Server default 100, maximum 1000. */
  readonly pageSize?: number;
  readonly maxPages?: number;
}

export interface SyncCatalogResult {
  readonly snapshot: CategorySnapshot;
  /** `true` when the walk started from nothing (a cold catalogue). */
  readonly wasFullSync: boolean;
  /** How many requests the walk actually made. `0` is impossible — the
   * freshness probe is the caller's job, not this function's. */
  readonly pages: number;
  /** The page budget stopped the walk before `has_next` did. The snapshot is
   * a truncated catalogue and the caller must NOT treat it as complete. */
  readonly truncated: boolean;
}

/**
 * Bring `stored` up to date.
 *
 * A cold start walks the whole catalogue into a fresh accumulator; a warm
 * start folds the delta into the stored rows. Which one happens is decided by
 * `firstPageRequest` and by what the accumulator starts as — there is no flag
 * that a caller could set the wrong way (see `catalog/sync.ts`).
 */
export async function syncCatalog(
  api: CategoriesApi,
  stored: CategorySnapshot,
  options: SyncCatalogOptions = {}
): Promise<SyncCatalogResult> {
  const wasFullSync = isEmptySnapshot(stored);
  const budget = options.maxPages ?? MAX_SYNC_PAGES;

  let request: CategoryListParams | undefined = {
    ...firstPageRequest(stored),
    ...(options.pageSize !== undefined ? { pageSize: options.pageSize } : {}),
  };
  // A full sync must not inherit rows the server is no longer listing, so it
  // accumulates from empty. A delta folds into what is already known.
  let accumulator: CategorySnapshot = wasFullSync
    ? EMPTY_SNAPSHOT
    : { ...stored };
  let pages = 0;
  let truncated = false;

  while (request !== undefined) {
    if (pages >= budget) {
      truncated = true;
      break;
    }
    const current: CategoryListParams = request;
    const page = await api.list(current, {
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    });
    pages += 1;
    accumulator = applyCategoryPage(accumulator, page, {
      // The walk pinned its window with `max_revision`; the cursor may not
      // claim to have read past it.
      ...(current.maxRevision !== undefined
        ? { cursorLimit: current.maxRevision }
        : {}),
    });
    request = nextPageRequest(current, page);
  }

  if (truncated) {
    // The rows gathered so far are still worth showing — a partial catalogue
    // beats a blank menu — but the CURSOR must not advance, or the next sync
    // asks for a delta on top of a catalogue that was never fully read and the
    // gap becomes permanent. Rewinding it here means the worst case is one
    // repeated full walk, not a silently incomplete tree forever.
    return {
      snapshot: { ...accumulator, cursor: stored.cursor },
      wasFullSync,
      pages,
      truncated,
    };
  }

  return { snapshot: accumulator, wasFullSync, pages, truncated };
}
