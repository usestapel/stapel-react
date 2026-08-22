import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type { Category, CategoryFeature, MaxRevision } from "../api/types.js";
import { buildCategoryTree } from "../catalog/tree.js";
import type { BuildCategoryTreeOptions, CategoryIndex } from "../catalog/tree.js";
import type { CategorySnapshot } from "../catalog/sync.js";
import { useCategoriesApi } from "./context.js";
import { createCatalogStore } from "./catalogStore.js";
import type { CatalogStore } from "./catalogStore.js";
import { syncCatalog } from "./catalogSync.js";
import { catalogKeyOptions, categoriesQueryKeys } from "./queryKeys.js";

/**
 * Read hooks over the categories API (frontend-standard §2). Keys are
 * namespaced (see `categoriesQueryKeys`).
 *
 * NOT SESSION-GATED, and that is the documented exception rather than an
 * omission. Sibling pairs gate every read on `useActiveSessionReady` because
 * their endpoints need a principal; every read here is a SAFE method under
 * `ReadOnlyOrStaff`, which anonymous callers may make. Gating them would make
 * a storefront's catalogue wait for a login bootstrap that a visitor who will
 * never sign in has no stake in.
 */

/** What `useCategoryCatalog` hands back beside the tree. */
export interface CategoryCatalog {
  readonly index: CategoryIndex;
  /** The snapshot the tree was built from — cursor included, so a host can
   * show "catalogue as of revision N" or drive its own refresh policy. */
  readonly snapshot: CategorySnapshot;
  /** The page budget stopped the walk. The tree is a PARTIAL catalogue: a
   * missing branch here is not an empty branch, and a skin that can say so
   * should. */
  readonly truncated: boolean;
  /** The walk started from nothing (cold cache), rather than applying a delta. */
  readonly wasFullSync: boolean;
}

export interface UseCategoryCatalogOptions extends BuildCategoryTreeOptions {
  readonly enabled?: boolean;
  /** Rows per sync request (server default 100, max 1000). */
  readonly pageSize?: number;
  /** Persistence seam. Default: an app-scoped `createRepository` store. Pass
   * `memoryCatalogStore()` to opt out of persistence entirely. */
  readonly store?: CatalogStore;
  /**
   * How long the built catalogue is considered fresh. Default: five minutes.
   *
   * A catalogue changes when somebody edits it in the admin, not while a
   * person browses, and every refetch is a delta request that usually returns
   * zero rows — so the default is generous on purpose. `0` makes every mount
   * re-ask.
   */
  readonly staleTime?: number;
}

const DEFAULT_CATALOG_STALE_TIME = 5 * 60 * 1000;

/**
 * The whole category tree, delta-synced and cached across page loads.
 *
 * This is the hook a storefront mounts once, high up: `/c/:slug` resolves its
 * slug against it, breadcrumbs walk it, the picker in the compose form reads
 * it, and none of them costs a request. Without it every page pulls the
 * catalogue (spec §4.3).
 *
 * ── What one "load" actually does ──────────────────────────────────────────
 *
 *   read the stored snapshot  (app-scoped repository; may be empty)
 *   → GET /categories/?include_deleted=false          (cold)
 *     or GET /categories/?min_revision=<cursor>       (warm)
 *   → follow `has_next` with the window pinned by `max_revision`
 *   → fold rows + `revisions.deleted_ids` into the snapshot
 *   → persist, then build the tree
 *
 * The load discipline is the fleet's: `loading` while the first answer is in
 * flight (including while the repository read is), `failed` on a refusal — a
 * failed sync never degrades to "the catalogue is empty". Because the stored
 * snapshot is read INSIDE the query function, a warm start still reports
 * `loading` on the very first render and then resolves in the same tick; it
 * does not flash an empty tree.
 *
 * `retry: false`: a sync failure is worth reporting immediately, and the
 * caller has `refetch`. Three silent retries only delay the sentence.
 */
export function useCategoryCatalog(
  options: UseCategoryCatalogOptions = {}
): UseQueryResult<CategoryCatalog, StapelApiError> {
  const api = useCategoriesApi();
  const treeOptions = useMemo<BuildCategoryTreeOptions>(
    () => ({
      ...(options.includeDeleted !== undefined
        ? { includeDeleted: options.includeDeleted }
        : {}),
      ...(options.includeInactive !== undefined
        ? { includeInactive: options.includeInactive }
        : {}),
    }),
    [options.includeDeleted, options.includeInactive]
  );
  const keyOptions = useMemo(
    () => catalogKeyOptions(treeOptions),
    [treeOptions]
  );
  const providedStore = options.store;
  const store = useMemo(
    () => providedStore ?? createCatalogStore(),
    [providedStore]
  );
  const pageSize = options.pageSize;

  return useQuery({
    queryKey: categoriesQueryKeys.catalog(keyOptions),
    queryFn: async ({ signal }): Promise<CategoryCatalog> => {
      const stored = await store.load();
      const result = await syncCatalog(api, stored, {
        signal,
        ...(pageSize !== undefined ? { pageSize } : {}),
      });
      // A truncated walk keeps the previous cursor (`syncCatalog`), so
      // persisting it cannot record progress that was not made.
      await store.save(result.snapshot);
      return {
        index: buildCategoryTree(result.snapshot.rows, treeOptions),
        snapshot: result.snapshot,
        truncated: result.truncated,
        wasFullSync: result.wasFullSync,
      };
    },
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? DEFAULT_CATALOG_STALE_TIME,
    retry: false,
  });
}

/**
 * One category's direct children, straight from the server.
 *
 * The synced tree already knows them; this is for the host that does not mount
 * the catalogue — an SSR category page, a lazily expanded branch. The server
 * filters `deleted` here and orders by `tn_priority` descending, but it does
 * NOT filter `active`, so a public screen still has to.
 */
export function useCategoryChildren(
  id: number | null | undefined,
  options?: { readonly enabled?: boolean }
): UseQueryResult<readonly Category[], StapelApiError> {
  const api = useCategoriesApi();
  return useQuery({
    queryKey: categoriesQueryKeys.children(id ?? -1),
    queryFn: ({ signal }) => api.children(id as number, { signal }),
    enabled: (options?.enabled ?? true) && typeof id === "number",
    retry: false,
  });
}

/**
 * The carousel strip for a landing page.
 *
 * The one endpoint the server already filters completely (`active` AND
 * `carousel_enabled`) and already caches, sending
 * `Cache-Control: public, max-age`. `staleTime` mirrors that: the browser's
 * HTTP cache and the query cache should not disagree about how fresh this is.
 */
export function useCategoryCarousel(options?: {
  readonly enabled?: boolean;
  readonly staleTime?: number;
}): UseQueryResult<readonly Category[], StapelApiError> {
  const api = useCategoriesApi();
  return useQuery({
    queryKey: categoriesQueryKeys.carousel,
    queryFn: ({ signal }) => api.carousel({ signal }),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? DEFAULT_CATALOG_STALE_TIME,
    retry: false,
  });
}

/**
 * A category's resolved feature schema — own plus inherited, deduplicated by
 * slug, in the category's own order.
 *
 * This is the payload `@stapel/attributes-react` draws (the compose form) and
 * labels facets from (the search pair's `categoryFeatures` slot). It changes
 * only when the catalogue is edited, hence the same generous `staleTime`.
 */
export function useCategoryFeatures(
  id: number | null | undefined,
  options?: { readonly enabled?: boolean; readonly staleTime?: number }
): UseQueryResult<readonly CategoryFeature[], StapelApiError> {
  const api = useCategoriesApi();
  return useQuery({
    queryKey: categoriesQueryKeys.features(id ?? -1),
    queryFn: ({ signal }) => api.features(id as number, { signal }),
    enabled: (options?.enabled ?? true) && typeof id === "number",
    staleTime: options?.staleTime ?? DEFAULT_CATALOG_STALE_TIME,
    retry: false,
  });
}

/**
 * The catalogue's current maximum revision — the cheap freshness probe.
 *
 * A host that wants to poll for catalogue changes without transferring rows
 * compares this to `catalog.snapshot.cursor` and invalidates the catalogue key
 * when it moves. Not wired into `useCategoryCatalog` on purpose: how often to
 * ask is a deployment's decision, and a library that picked one would be
 * polling somebody's API on their behalf.
 */
export function useCategoriesRevision(options?: {
  readonly enabled?: boolean;
  readonly refetchInterval?: number;
}): UseQueryResult<MaxRevision, StapelApiError> {
  const api = useCategoriesApi();
  return useQuery({
    queryKey: categoriesQueryKeys.revision,
    queryFn: ({ signal }) => api.revision({ signal }),
    enabled: options?.enabled ?? true,
    ...(options?.refetchInterval !== undefined
      ? { refetchInterval: options.refetchInterval }
      : {}),
    retry: false,
  });
}
