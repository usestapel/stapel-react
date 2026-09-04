/**
 * `@stapel/search-react/default` — the antd default skin.
 *
 * A SEPARATE entry point on purpose: the main entry is headless and carries
 * no antd, so a storefront that renders its own cards over `<SearchResults>`
 * never pays for this bundle (enforced by size-limit and the bundle-purity
 * test).
 *
 * Five override levers, none of which requires forking anything:
 *
 *  1. **`renderCard`** — the card slot. A storefront passes
 *     `<ListingCard>` from `@stapel/listings-react/default`; the generic card
 *     here is the documented default, not the intended end state (spec §3.7).
 *     `renderResults` is the level above it: the whole layout, for a container
 *     whose arrangement is not "cards in a grid".
 *  2. **`categoryFeatures`** — the facet-label slot, and the source of which
 *     slugs get a numeric range row. The server sends `{value: count}` and no
 *     labels; the schema that names them lives in categories, and the
 *     container hands it in (spec §6.2 item 2).
 *  3. **`renderCategoryFilter`** — the catalogue picker. `categories-react`
 *     owns walking the tree; this pair owns the `category` parameter.
 *  4. **`renderGeoFilter`** — the location control. `geo-react` owns the map
 *     and the geocoder; this pair owns `lat`/`lon`/`radius_km`/`bbox`, and
 *     keeps the controls that WIDEN a location a link already carries. Its two
 *     companions divide the same seam the same way: `geoLabel` is what the
 *     current place is CALLED (owning a coordinate is not permission to print
 *     one), and `geoOffer` is a place the search COULD be narrowed to — the
 *     visitor's own position, resolved by whoever is allowed to ask for it,
 *     drawn as an invitation on the location row and applied only when
 *     somebody presses it.
 *  5. **retheming through the §68 token JSON** — every surface wraps itself
 *     in the shared `SkinTheme`, so a host's regenerated `--stapel-*` custom
 *     properties reach this skin with zero code.
 *
 * The pair's own `theme.tsx` and `ErrorAlert.tsx` are GONE as of 0.6.0: both
 * were copies of a decision now stated once in `@stapel/tokens-antd/skin`
 * (`SkinTheme`, `ErrorAlert`). A host that imported `SearchSkinTheme` imports
 * `SkinTheme` from the substrate instead — same props, one implementation, and
 * a runtime `data-theme` flip actually repaints it.
 */

// ── surfaces ────────────────────────────────────────────────────────────────
export {
  SearchPage,
  RAIL_CLASS,
  RAIL_STYLE_HREF,
  railScrollbarCss,
} from "./SearchPage.js";
export type { SearchPageProps, SearchFiltersLayout } from "./SearchPage.js";

export { SearchResultsPane, RESULTS_MAX_WIDTH } from "./SearchResultsPane.js";
export type {
  SearchResultsPaneProps,
  SearchResultsRenderer,
  SearchResultsWrapper,
} from "./SearchResultsPane.js";

export {
  FilterChips,
  CHIP_BAND_ORDER,
  CHIP_ROW_CAP,
  CHIP_ROW_CLASS,
  CHIP_ROW_STYLE_HREF,
  appliedChipTestId,
  buildAppliedChips,
  capChipRow,
  categoryLeaf,
  chipRowCss,
  orderChipFilters,
  rangeChipText,
  rangeLabelSource,
} from "./FilterChips.js";
export type {
  AppliedChip,
  AppliedChipTarget,
  ChipBand,
  ChipSpec,
  FilterChipsAppliedProps,
  FilterChipsCommonProps,
  FilterChipsMode,
  FilterChipsOpenerProps,
  FilterChipsProps,
} from "./FilterChips.js";
export { EmptyExits, RADIUS_WIDEN_FACTOR, parentCategory } from "./EmptyExits.js";
export type { EmptyExitsProps } from "./EmptyExits.js";

export { LocationSummaryLine } from "./LocationSummaryLine.js";
export type { LocationSummaryLineProps } from "./LocationSummaryLine.js";

export {
  FacetGroupControl,
  facetGroupShape,
  facetOptionNodes,
  isDictionaryFacet,
  FACET_DICTIONARY_THRESHOLD,
  FACET_VISIBLE_OPTIONS,
} from "./FacetGroupControl.js";
export type {
  FacetGroupControlProps,
  FacetGroupShape,
  FacetOptionNode,
} from "./FacetGroupControl.js";

// ── the browse surfaces a storefront PLACES (this pair does not lay them
//    out: where a popular-values block or a partition row belongs on a
//    category page is the page's decision) ──────────────────────────────────
export {
  PopularValues,
  popularOptions,
  POPULAR_VALUES_COLUMNS,
  POPULAR_VALUES_LIMIT,
} from "./PopularValues.js";
export type { PopularValuesProps } from "./PopularValues.js";
export { PartitionChips } from "./PartitionChips.js";
export type { PartitionChild, PartitionChipsProps } from "./PartitionChips.js";

export {
  FacetPanelPane,
  FACET_OPEN_GROUPS,
  FACET_SEARCH_THRESHOLD,
  FACET_VISIBLE_GROUPS,
} from "./FacetPanelPane.js";
export type {
  FacetPanelPaneProps,
  CategoryFilterSlotProps,
  GeoFilterSlotProps,
} from "./FacetPanelPane.js";

export { RankingDisclosurePane, RANKING_MAX_WIDTH } from "./RankingDisclosurePane.js";
export type { RankingDisclosurePaneProps } from "./RankingDisclosurePane.js";

// ── controls, exported so a host can compose its own layout ─────────────────
export { SearchBox } from "./SearchBox.js";
export type { SearchBoxProps } from "./SearchBox.js";
export { SortSelect, SORT_SELECT_MIN_WIDTH } from "./SortSelect.js";
export type { SortSelectProps } from "./SortSelect.js";
export { ViewSwitch, SEARCH_BUILTIN_VIEWS, resolveView } from "./ViewSwitch.js";
export type { ViewSwitchProps, SearchView, SearchResultsLayout } from "./ViewSwitch.js";
export { PageSizeSelect, SEARCH_PAGE_SIZES } from "./PageSizeSelect.js";
export type { PageSizeSelectProps } from "./PageSizeSelect.js";
export { LanguageSelect } from "./LanguageSelect.js";
export type { LanguageSelectProps } from "./LanguageSelect.js";

// ── parts, exported so a host can compose or wrap one ───────────────────────
export { SearchResultCard, GENERIC_CARD_FIELDS } from "./SearchResultCard.js";
export type { SearchCardProps, SearchCardRenderer } from "./SearchResultCard.js";
export { DegradationNotice } from "./DegradationNotice.js";
export type {
  DegradationNoticeProps,
  DegradationNoticeVariant,
} from "./DegradationNotice.js";
export { UrlIssueNotice } from "./UrlIssueNotice.js";
export { RangeFilterRow } from "./RangeFilterRow.js";
export type { RangeFilterRowProps } from "./RangeFilterRow.js";

// ── theming ─────────────────────────────────────────────────────────────────
export type { ThemeModeProp } from "./types.js";
