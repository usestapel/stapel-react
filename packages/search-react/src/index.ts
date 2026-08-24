/**
 * `@stapel/search-react` — the headless React pair for stapel-search
 * (frontend-standard §2). Business + state only, zero visual opinion; the
 * antd skin lives behind the `./default` subpath and the react-router binding
 * behind `./router`, so a host that renders its own visuals carries neither.
 *
 * ── The one-liner ──────────────────────────────────────────────────────────
 *
 * ```tsx
 * const runtime = createSearchRuntime({ baseUrl: "/search/api/v1/" });
 * <SearchProvider runtime={runtime}>
 *   <SearchPage adapter={useRouterSearchParams()} defaultType="listing" />
 * </SearchProvider>
 * ```
 *
 * No session, no workspace id, no auth client: every endpoint this pair calls
 * is `AllowAny`, so a storefront's catalogue renders for a visitor who will
 * never sign in.
 *
 * ── The three properties this pair exists to guarantee ─────────────────────
 *
 * 1. **The URL is the state.** Text, category, facet filters, ranges, geo,
 *    sort, page size and the keyset cursor all live in the query string,
 *    under the BACKEND's own parameter names, and no component keeps a second
 *    copy. Copying the address into another tab reproduces the page; Back
 *    removes the last filter; a reload loses nothing. See `state/urlState.ts`.
 * 2. **The server's honesty survives to the screen.** `facet_meta.approximate`,
 *    `facet_meta.skipped`, `exact_total` and `degraded[]` are parsed and
 *    surfaced, never swallowed. A skipped facet's options carry `count: null`,
 *    not `0` — "we did not count this" and "there are none" are different
 *    sentences.
 * 3. **`promoted` is carried, not optional.** DSA Art. 26 marking rides every
 *    item under every sort; the card slot receives the whole item and the
 *    default card renders the tag. The P2B Art. 5 ranking disclosure ships as
 *    a headless bag and a page.
 *
 * Layers: api → model → state → headless → i18n. Generated surfaces (the
 * typed schema, the error map, the manifest, the nav manifest, llms.txt) are
 * produced by the monorepo `gen:*` drivers from stapel-search's own `docs/`
 * artifacts and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createSearchApi, searchQueryParams } from "./api/searchApi.js";
export type { SearchApi } from "./api/searchApi.js";
export type { Schemas } from "./api/types.js";
export { SEARCH_SORTS } from "./api/types.js";
export type {
  FacetMeta,
  FacetSelection,
  RankingResponse,
  Scorer,
  SearchDegradation,
  SearchDegradationKind,
  SearchGeo,
  SearchGeoBox,
  SearchGeoCenter,
  SearchItem,
  SearchQueryState,
  SearchRange,
  SearchResponse,
  SuggestParams,
  SuggestResponse,
} from "./api/types.js";

// ── state (pure: no React, no router) ────────────────────────────────────────
export {
  FILTER_PREFIX,
  RANGE_PREFIX,
  SEARCH_PARAM,
  activeFilterCount,
  clearFilters,
  ownsParam,
  parseSearchState,
  patchSearchState,
  setFilterValues,
  setRangeValue,
  toggleFilterValue,
  writeSearchState,
} from "./state/urlState.js";
export type {
  ParseSearchStateOptions,
  ParsedSearchState,
  SearchStateIssue,
  SearchStateIssueCode,
  SearchStatePatch,
} from "./state/urlState.js";

export {
  countIsEstimate,
  countKind,
  degradationMessageKey,
  isCountNuanceOnly,
  parseDegradations,
} from "./state/degradations.js";
export type { SearchCountKind } from "./state/degradations.js";

export { buildFacetGroups, facetOptionLabel } from "./state/facets.js";
export type {
  BuildFacetGroupsInput,
  FacetGroup,
  FacetOption,
} from "./state/facets.js";

// ── model (runtime wiring, query keys, context, hooks) ───────────────────────
export { createSearchRuntime } from "./model/runtime.js";
export type {
  SearchRuntime,
  CreateSearchRuntimeOptions,
} from "./model/runtime.js";
export {
  SearchRuntimeContext,
  useSearchRuntime,
  useSearchApi,
  useSearchAnalytics,
} from "./model/context.js";
export { searchQueryKeys } from "./model/queryKeys.js";
export type { SearchQueryKeyParams } from "./model/queryKeys.js";

export { useRankingDisclosure, useSearchQuery } from "./model/queries.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { SearchProvider } from "./headless/SearchProvider.js";
export { SearchStateProvider, useSearchState } from "./headless/SearchStateProvider.js";
export type {
  SearchParamsAdapter,
  SearchStateBag,
  SearchStateProviderProps,
} from "./headless/SearchStateProvider.js";
export { SearchResults } from "./headless/SearchResults.js";
export type { SearchPageInfo, SearchResultsBag } from "./headless/SearchResults.js";
export { FacetPanel, useFacetPanel } from "./headless/FacetPanel.js";
export type { FacetPanelBag } from "./headless/FacetPanel.js";
export { useAppliedSort } from "./headless/useAppliedSort.js";
export { RankingDisclosure } from "./headless/RankingDisclosure.js";
export type { RankingDisclosureBag } from "./headless/RankingDisclosure.js";

// ── nav manifest (the pair's public surface declaration) ─────────────────────
export { navEntries } from "./nav/manifest.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  SEARCH_I18N_KEYS,
  SEARCH_I18N_PLURAL_KEYS,
  searchI18nBundleEn,
  registerSearchI18n,
} from "./i18n/keys.js";
export type { SearchI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  SEARCH_ERRORS,
  SEARCH_ERROR_CODES,
  SEARCH_BACKEND_UNAVAILABLE,
  SEARCH_WINDOW_EXCEEDED,
  searchErrorBundleEn,
  explainSearchError,
} from "./i18n/errorsMap.js";
export type {
  SearchErrorCode,
  SearchErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
