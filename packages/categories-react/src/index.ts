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
export type { CategoriesApi, CategoriesApiOptions } from "./api/categoriesApi.js";
export { EFFECTIVE_FROM_HEADER, fetchCategoryFeatures } from "./api/featuresRaw.js";
export type { CategoriesRawTransport } from "./api/featuresRaw.js";
export type {
  Category,
  CategoryChildrenAs,
  CategoryFeature,
  CategoryFeatureConfig,
  CategoryFeaturesEffectiveFrom,
  CategoryFeaturesResult,
  CategoryFeatureType,
  CategoryListParams,
  CategoryPage as CategoryListPage,
  CategoryPresentation,
  CategoryRevisions,
  CategoryTreeNode,
  CategoryTreeParams,
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
export {
  ADMIN_VISIBILITY,
  browsableCategories,
  isBrowsableCategory,
  isTestCategory,
} from "./catalog/browse.js";
export type { CategoryVisibilityOptions } from "./catalog/browse.js";
export {
  MAX_TILE_DEPTH,
  categoryIconSrc,
  categoryOffersTileGrid,
  nodeOffersTileGrid,
} from "./catalog/tiles.js";
export { browseStage, childControl, hasChildren } from "./catalog/stage.js";
export type { BrowseStage, BrowseStageInput, ChildControl } from "./catalog/stage.js";
export {
  browseChildren,
  isTransparentNode,
  isTransparentWrapper,
  isWrapperAncestor,
} from "./catalog/wrapper.js";
export type { ChildrenOf } from "./catalog/wrapper.js";
export {
  buildCategoryCascade,
  cascadeChainIds,
  cascadeParentIds,
  cascadeReachedLeaf,
  cascadeSelection,
  cascadeTrail,
  categoryAncestorChain,
} from "./catalog/cascade.js";
export type {
  CategoryCascadeLevel,
  CategoryCascadeSource,
} from "./catalog/cascade.js";
export {
  CATEGORY_SEARCH_LIMIT,
  foldForSearch,
  rankCategoryMatches,
} from "./catalog/search.js";
export type {
  CategoryMatchKind,
  CategorySearchHit,
  RankCategoryMatchesOptions,
} from "./catalog/search.js";
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
  featureCommentLabel,
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
  UNPERSISTED_WARNING,
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
  DEFAULT_TREE_DEPTH,
  useCategoriesRevision,
  useCategory,
  useCategoryCarousel,
  useCategoryCatalog,
  useCategoryChildren,
  useCategoryFeatures,
  useCategoryLevels,
  useCategoryRows,
  useCategoryTree,
} from "./model/queries.js";
export type {
  CategoryBrowseOptions,
  CategoryCatalog,
  CategoryFanOut,
  UseCategoryCarouselOptions,
  UseCategoryCatalogOptions,
  UseCategoryTreeOptions,
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
export { CategoryCarousel, categoryTileEntry } from "./headless/CategoryCarousel.js";
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
export { useCategorySearch } from "./headless/useCategorySearch.js";
export type { UseCategorySearchOptions } from "./headless/useCategorySearch.js";
export { CategoryCascade, useCategoryCascade } from "./headless/CategoryCascade.js";
export type {
  CategoryCascadeBag,
  CategoryCascadeBlockedReason,
  CategoryCascadeCommit,
  CategoryCascadeOption,
  CategoryCascadeProps,
  CategoryCascadeStep,
  UseCategoryCascadeOptions,
} from "./headless/CategoryCascade.js";
export { CategoryFeatures, visibleFeatures } from "./headless/CategoryFeatures.js";
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
  CATEGORIES_I18N_PLURAL_KEYS,
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
