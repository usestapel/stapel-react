import { useCallback, useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  Category,
  CategoryFeature,
  CategoryTreeNode,
  MaxRevision,
} from "../api/types.js";
import { browsableCategories } from "../catalog/browse.js";
import type { CategoryVisibilityOptions } from "../catalog/browse.js";
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
 *
 * ── Every browse hook filters; no cache does ───────────────────────────────
 *
 * The three hooks that produce rows for a surface a PERSON picks from — the
 * catalogue tree, a category's children, the carousel — run
 * `catalog/browse.ts`'s predicate and take {@link CategoryVisibilityOptions}
 * to opt out of it. The cache underneath never does: the catalogue snapshot
 * stores every row the sync sent (a filtered snapshot could not apply the next
 * delta), and the children/carousel reads keep the server's whole answer under
 * their query key and project it per observer through TanStack's `select`. So
 * a browse mount and an admin mount of the same endpoint share ONE cache entry
 * and disagree only about what they show.
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
      ...(options.includeTest !== undefined
        ? { includeTest: options.includeTest }
        : {}),
    }),
    [options.includeDeleted, options.includeInactive, options.includeTest]
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
 * The browse projection as a STABLE `select` — the same function identity
 * across renders while the visibility flags do not change, so a keystroke
 * somewhere else on the page cannot make TanStack recompute (and re-render)
 * every consumer of a category list.
 */
function useBrowseProjection(
  options: CategoryVisibilityOptions | undefined
): (rows: readonly Category[]) => readonly Category[] {
  const includeDeleted = options?.includeDeleted;
  const includeInactive = options?.includeInactive;
  const includeTest = options?.includeTest;
  return useCallback(
    (rows: readonly Category[]) =>
      browsableCategories(rows, {
        ...(includeDeleted !== undefined ? { includeDeleted } : {}),
        ...(includeInactive !== undefined ? { includeInactive } : {}),
        ...(includeTest !== undefined ? { includeTest } : {}),
      }),
    [includeDeleted, includeInactive, includeTest]
  );
}

/** Options every hook that PROJECTS rows for browsing shares. */
export interface CategoryBrowseOptions extends CategoryVisibilityOptions {
  readonly enabled?: boolean;
}

/**
 * One category's direct children, projected for browsing.
 *
 * The synced tree already knows them; this is for the host that does not mount
 * the catalogue — an SSR category page, a lazily expanded branch. The server
 * filters `deleted` here and orders by `tn_priority` descending, but it does
 * NOT filter `active` and knows nothing about test rows, so a public screen
 * still has to — and on a live classified deployment that is the difference
 * between a menu of categories and a menu of end-to-end leftovers.
 *
 * The projection runs in `select`, so the QUERY CACHE still holds the server's
 * complete answer and a sibling admin mount reads the same entry rather than
 * issuing a second request for the same children.
 */
export function useCategoryChildren(
  id: number | null | undefined,
  options?: CategoryBrowseOptions
): UseQueryResult<readonly Category[], StapelApiError> {
  const api = useCategoriesApi();
  const visible = useBrowseProjection(options);
  return useQuery({
    queryKey: categoriesQueryKeys.children(id ?? -1),
    queryFn: ({ signal }) => api.children(id as number, { signal }),
    select: visible,
    enabled: (options?.enabled ?? true) && typeof id === "number",
    retry: false,
  });
}

/**
 * ONE category row by id — the cheapest read in the contract, and the hook a
 * server-driven walk is built out of.
 *
 * 311 bytes and a third of a second on a live classified deployment, against
 * 1.4 MB and twenty seconds for the catalogue that also answers this. Every
 * surface that already HAS an id — a search chip naming its own narrowing, a
 * category landing reached by a link, a cascade reconciling a deep value —
 * asks this instead of mounting the sync.
 *
 * The answer carries `tn_ancestors_pks`, so it is also the whole breadcrumb
 * chain and the whole cascade chain: see {@link useCategoryRows}.
 *
 * NOT browse-projected. A row asked for BY ID was named by the caller, and a
 * hook that answered `undefined` for an inactive category would turn "you
 * linked to a hidden row" into "the request failed". The caller decides;
 * `isBrowsableCategory` is one call away.
 */
export function useCategory(
  id: number | null | undefined,
  options?: { readonly enabled?: boolean; readonly staleTime?: number }
): UseQueryResult<Category, StapelApiError> {
  const api = useCategoriesApi();
  return useQuery({
    queryKey: categoriesQueryKeys.category(id ?? -1),
    queryFn: ({ signal }) => api.retrieve(id as number, { signal }),
    enabled: (options?.enabled ?? true) && typeof id === "number",
    staleTime: options?.staleTime ?? DEFAULT_CATALOG_STALE_TIME,
    retry: false,
  });
}

/** What a fan-out of small reads answers, beside the rows themselves. */
export interface CategoryFanOut<T> {
  /** One entry per id asked for, in that order. `null` = not answered yet, or
   * answered with a refusal — `error` says which. */
  readonly rows: readonly (T | null)[];
  /** At least one read is still in flight. */
  readonly isPending: boolean;
  /** The first refusal, or `null`. One error for the fan-out: a ladder with
   * one broken rung is a broken ladder, and four identical alerts are not
   * four sentences. */
  readonly error: StapelApiError | null;
}

/**
 * Several category rows by id, one small request each, in parallel.
 *
 * The breadcrumb of a deep category is exactly this: `tn_ancestors_pks` gives
 * the ids, and the names come back in one round trip of 300-byte reads that
 * every other surface then finds in the cache. A tree sync answers the same
 * question for four thousand times the bytes.
 *
 * `ids` may be empty, and then nothing is requested — TanStack still needs the
 * hook to be called unconditionally, which is why this is a fan-out hook and
 * not a loop of {@link useCategory} at the call site.
 */
export function useCategoryRows(
  ids: readonly number[],
  options?: { readonly enabled?: boolean; readonly staleTime?: number }
): CategoryFanOut<Category> {
  const api = useCategoriesApi();
  const enabled = options?.enabled ?? true;
  const staleTime = options?.staleTime ?? DEFAULT_CATALOG_STALE_TIME;
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: categoriesQueryKeys.category(id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.retrieve(id, { signal }),
      enabled,
      staleTime,
      retry: false as const,
    })),
    combine: combineFanOut,
  });
}

/**
 * Fold a fan-out's results into one answer, ONCE per change.
 *
 * A module-level function on purpose: TanStack memoizes `combine` on (results,
 * function identity), and a closure written inline at the call site is a new
 * identity every render — which recomputes the fold, hands back a new object,
 * and re-renders every consumer of a ladder that did not change. That is the
 * defect this whole file exists to avoid one layer down.
 */
function combineFanOut<T>(
  results: readonly {
    readonly data?: T | undefined;
    readonly isPending: boolean;
    readonly fetchStatus: "fetching" | "paused" | "idle";
    readonly error: unknown;
  }[]
): CategoryFanOut<T> {
  return {
    rows: results.map((result) => result.data ?? null),
    // A DISABLED read is not a pending one. TanStack reports `isPending` for a
    // query it was never allowed to run, and a ladder whose last rung is
    // deliberately off would otherwise report itself as loading forever.
    isPending: results.some(
      (result) => result.isPending && result.fetchStatus !== "idle"
    ),
    error:
      (results.find((result) => result.error != null)?.error as
        | StapelApiError
        | undefined) ?? null,
  };
}

/**
 * The children of several parents — ONE RUNG PER PARENT, one small request
 * each, in parallel.
 *
 * This is the whole server-driven walk. A cascade four levels deep is four
 * requests of one to four kilobytes; the catalogue that would answer the same
 * four questions from memory costs 1.4 MB before the first of them can be
 * asked, which on a 3583-row catalogue was measured at twenty seconds.
 *
 * A `null` parent means "the top of a rootless ladder", which this module
 * CANNOT answer from the server: there is no roots endpoint, and the list
 * endpoint takes no `tn_parent` filter (see MODULE.md's upstream asks). Such a
 * rung is left unanswered here and the caller supplies it — the one place the
 * catalogue sync is still the only source.
 *
 * The browse projection runs per rung, over the server's complete answer kept
 * in the cache, exactly as {@link useCategoryChildren} does — so an admin
 * mount and a storefront mount of the same rung share one cache entry.
 */
export function useCategoryLevels(
  parentIds: readonly (number | null)[],
  options?: CategoryBrowseOptions
): CategoryFanOut<readonly Category[]> {
  const api = useCategoriesApi();
  const visible = useBrowseProjection(options);
  const enabled = options?.enabled ?? true;
  return useQueries({
    queries: parentIds.map((parentId) => ({
      queryKey: categoriesQueryKeys.children(parentId ?? -1),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.children(parentId as number, { signal }),
      select: visible,
      enabled: enabled && parentId !== null,
      retry: false as const,
    })),
    combine: combineFanOut,
  });
}

/** {@link useCategoryCarousel}'s options — the browse flags plus freshness. */
export interface UseCategoryCarouselOptions extends CategoryBrowseOptions {
  readonly staleTime?: number;
}

/**
 * The carousel strip for a landing page.
 *
 * The endpoint the server filters MOST completely (`active` AND
 * `carousel_enabled`) and already caches, sending
 * `Cache-Control: public, max-age`. `staleTime` mirrors that: the browser's
 * HTTP cache and the query cache should not disagree about how fresh this is.
 *
 * The browse projection still runs. Not because the server's `active` filter
 * is doubted, but because the two other halves of the predicate are not the
 * server's to apply here: a tombstone and a test row are both filtered on the
 * client, and this row of tiles is the most prominent browse surface the
 * storefront has. A surface that skipped the shared predicate would be the one
 * place a filtered row could still reach a person.
 */
export function useCategoryCarousel(
  options?: UseCategoryCarouselOptions
): UseQueryResult<readonly Category[], StapelApiError> {
  const api = useCategoriesApi();
  const visible = useBrowseProjection(options);
  return useQuery({
    queryKey: categoriesQueryKeys.carousel,
    queryFn: ({ signal }) => api.carousel({ signal }),
    select: visible,
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

/** The levels a menu asks for when nobody says otherwise: roots, their
 * children, and one more — the three the mega-menu draws. */
export const DEFAULT_TREE_DEPTH = 3;

/** {@link useCategoryTree}'s options. */
export interface UseCategoryTreeOptions {
  readonly enabled?: boolean;
  readonly staleTime?: number;
}

/**
 * The first `depth` levels of the catalogue, NESTED — one request, one cached
 * answer, and the read the desktop mega-menu is built on.
 *
 * The alternative it replaces is the reason it exists: assembled from `roots`
 * plus a `children` call per node, a three-level menu is one request per
 * branch on the coldest page of a storefront; assembled from the synced
 * catalogue it is the whole table (1.4 MB, twenty seconds measured) before the
 * first name can be drawn. This is four fields per node and the presentation
 * of the level below.
 *
 * NOT browse-projected, and that is not an omission: the endpoint serves
 * ACTIVE rows only and no tombstones at all, so the client predicate would
 * have nothing left to remove. It is also not a catalogue source — the nodes
 * carry no revision, so nothing here can seed or advance the delta snapshot.
 *
 * The server caches on the tree's own revision fingerprint and sends
 * `Cache-Control: public, max-age`; `staleTime` mirrors that, so the query
 * cache and the browser's HTTP cache do not disagree about how fresh a menu
 * is.
 */
export function useCategoryTree(
  depth: number = DEFAULT_TREE_DEPTH,
  options?: UseCategoryTreeOptions
): UseQueryResult<readonly CategoryTreeNode[], StapelApiError> {
  const api = useCategoriesApi();
  return useQuery({
    queryKey: categoriesQueryKeys.tree(depth),
    queryFn: ({ signal }) => api.tree({ depth }, { signal }),
    enabled: options?.enabled ?? true,
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
