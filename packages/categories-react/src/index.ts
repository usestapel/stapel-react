/**
 * `@stapel/categories-react` — the headless React pair for stapel-categories
 * (frontend-standard §2). Business + state only, zero visual opinion; the antd
 * skin lives behind the `./default` subpath, so a host that renders its own
 * catalogue chrome never carries it.
 *
 * ── The one-liner ──────────────────────────────────────────────────────────
 *
 * ```tsx
 * const runtime = createCategoriesRuntime({ baseUrl: "/categories/api/v1/" });
 * <CategoriesProvider runtime={runtime}>
 *   <CatalogPage />          // or <CategoryPage slug={slug} renderListings={…} />
 * </CategoriesProvider>
 * ```
 *
 * No session, no workspace id, no auth client: every endpoint this pair calls
 * is a SAFE method under `ReadOnlyOrStaff`, so a catalogue renders for a
 * visitor who will never sign in.
 *
 * ── The four properties this pair exists to guarantee ──────────────────────
 *
 * 1. **The client builds the tree, because the server has none.**
 *    `GET /categories/` returns FLAT rows ordered by `revision`, with treenode
 *    ancestry as COMMA-JOINED pk strings (`"1,7,12"`, `""` for a root).
 *    `catalog/tree.ts` parses and assembles; `catalog/pks.ts` is the parser,
 *    and it exists because the spec described those columns as arrays.
 * 2. **The catalogue is synced by delta, not refetched.** A stored snapshot
 *    (`createRepository`, `scope: "app"`) plus `?min_revision=` is the module's
 *    own documented protocol; without it every storefront page pulls the whole
 *    catalogue. Two things the documentation does not say are implemented
 *    anyway and explained where they live: `revisions.deleted_ids` is the
 *    complete tombstone channel (the `deleted: true` rows are paginated and a
 *    short walk misses them), and a multi-page walk must pin `max_revision` or
 *    a concurrent write shifts its page boundaries.
 * 3. **A slug is resolved by the client, because the server cannot.**
 *    `lookup_field` is never overridden and the list endpoint has no slug
 *    filter, so `/c/:slug` resolves against the synced tree. That is a second,
 *    independent reason the tree is cached.
 * 4. **Names are translation KEYS, and this pair says so.** No serializer runs
 *    the module's `DISPLAY_TRANSLATOR` seam, so `name` arrives as
 *    `category.electronics` even on a deployment with a real translator
 *    configured, and `translatable` / `translate` say per row whether a string
 *    is a key at all. `catalog/labels.ts` carries the whole answer, and the
 *    pair ships no catalogue of category names — those belong to the host.
 *
 * Layers: api → catalog (pure) → model → headless → i18n. Generated surfaces
 * (the typed schema, the error map, the manifest, the nav manifest, llms.txt)
 * are produced by the monorepo `gen:*` drivers from stapel-categories' own
 * `docs/` artifacts and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { categoryListParams, createCategoriesApi } from "./api/categoriesApi.js";
export type { CategoriesApi } from "./api/categoriesApi.js";
export type {
  Category,
  CategoryFeature,
  CategoryListParams,
  CategoryPage as CategoryListPage,
  CategoryRevisions,
  FeatureConfig,
  MaxRevision,
  Schemas,
} from "./api/types.js";

// ── catalog (pure: no React, no fetch, no storage) ───────────────────────────
export { parseTreenodePks } from "./catalog/pks.js";
export {
  buildCategoryTree,
  categoryAncestorIds,
  categoryBreadcrumbs,
  categoryChildIds,
  flattenCategoryNodes,
  resolveCategorySlug,
} from "./catalog/tree.js";
export type {
  BuildCategoryTreeOptions,
  CategoryIndex,
  CategoryNode,
} from "./catalog/tree.js";

export {
  EMPTY_SNAPSHOT,
  applyCategoryPage,
  firstPageRequest,
  isEmptySnapshot,
  nextPageRequest,
  parseSnapshot,
} from "./catalog/sync.js";
export type { CategorySnapshot } from "./catalog/sync.js";

export {
  categoryLabel,
  featureLabel,
  featureOptionsAreKeys,
  renderCategoryLabel,
} from "./catalog/labels.js";
export type { CategoryLabel, CategoryLabelKind } from "./catalog/labels.js";

// ── model (runtime wiring, persistence, sync driver, hooks) ──────────────────
export { createCategoriesRuntime } from "./model/runtime.js";
export type {
  CategoriesRuntime,
  CreateCategoriesRuntimeOptions,
} from "./model/runtime.js";
export {
  CategoriesRuntimeContext,
  useCategoriesAnalytics,
  useCategoriesApi,
  useCategoriesRuntime,
} from "./model/context.js";
export {
  CATALOG_KEY,
  CATALOG_NAMESPACE,
  createCatalogStore,
  memoryCatalogStore,
} from "./model/catalogStore.js";
export type {
  CatalogStore,
  CreateCatalogStoreOptions,
} from "./model/catalogStore.js";
export { MAX_SYNC_PAGES, syncCatalog } from "./model/catalogSync.js";
export type { SyncCatalogOptions, SyncCatalogResult } from "./model/catalogSync.js";
export { catalogKeyOptions, categoriesQueryKeys } from "./model/queryKeys.js";
export type { CatalogKeyOptions } from "./model/queryKeys.js";
export {
  useCategoriesRevision,
  useCategoryCarousel,
  useCategoryCatalog,
  useCategoryChildren,
  useCategoryFeatures,
} from "./model/queries.js";
export type {
  CategoryCatalog,
  UseCategoryCatalogOptions,
} from "./model/queries.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { CategoriesProvider } from "./headless/CategoriesProvider.js";
export { CategoryTree } from "./headless/CategoryTree.js";
export type { CategoryTreeBag, CategoryTreeProps } from "./headless/CategoryTree.js";
export { CategoryBreadcrumbs } from "./headless/CategoryBreadcrumbs.js";
export type {
  CategoryBreadcrumbsBag,
  CategoryBreadcrumbsProps,
  CategoryCrumb,
} from "./headless/CategoryBreadcrumbs.js";
export { CategoryCarousel } from "./headless/CategoryCarousel.js";
export type {
  CarouselEntry,
  CategoryCarouselBag,
  CategoryCarouselProps,
} from "./headless/CategoryCarousel.js";
export { CategoryPicker } from "./headless/CategoryPicker.js";
export type {
  CategoryOption,
  CategoryPickerBag,
  CategoryPickerBlockedReason,
  CategoryPickerProps,
} from "./headless/CategoryPicker.js";
export { CategoryFeatures } from "./headless/CategoryFeatures.js";
export type {
  CategoryFeatureEntry,
  CategoryFeaturesBag,
  CategoryFeaturesProps,
} from "./headless/CategoryFeatures.js";

// ── nav manifest (the pair's public surface declaration) ─────────────────────
export { navEntries } from "./nav/manifest.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  CATEGORIES_I18N_KEYS,
  categoriesI18nBundleEn,
  registerCategoriesI18n,
} from "./i18n/keys.js";
export type { CategoriesI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  CATEGORIES_ERRORS,
  CATEGORIES_ERROR_CODES,
  CATEGORIES_FEATURE_EDITOR_CONFLICT,
  categoriesErrorBundleEn,
  explainCategoriesError,
} from "./i18n/errorsMap.js";
export type {
  CategoriesErrorCode,
  CategoriesErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
