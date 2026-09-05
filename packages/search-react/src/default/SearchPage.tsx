/**
 * `<SearchPage>` — the composed screen the nav manifest points at: the query
 * box, the filters, the sort and the results.
 *
 * It composes the panes and owns NO state of its own. The URL is the state,
 * and it arrives through the `adapter` prop — which is where a host hands in
 * `useRouterSearchParams()` from `@stapel/search-react/router`, or its own
 * binding. The page does not reach for a router, so the same component renders
 * under react-router, under a Next.js app router, and in a test with a plain
 * `URLSearchParams`.
 *
 * The seams a storefront fills: `renderCard` (a `<ListingCard>`),
 * `categoryFeatures` (from categories-react, for facet labels and range rows),
 * `renderCategoryFilter` / `renderGeoFilter` (controls other pairs own),
 * `footer` (the container's own chrome), `filtersHeader`, `resultsHeader` and
 * `resultsHeading`. None of them is optional behaviour in disguise — every one
 * has a working default or a visible placeholder.
 *
 * ── The screen could not start a search ───────────────────────────────────
 *
 * Until this release the page rendered filters, sort and results and NO query
 * box: `q` reached the state only from the address bar, and `setText` had zero
 * callers in the repository. A scaffolded app therefore had a search route and
 * no way to search (audit S-1). `<SearchBox>` is now the first thing on the
 * page — and it is exported, so a container that puts the real box in its
 * header can pass `searchBox={false}` and keep exactly one.
 *
 * ── On a phone the filters are a sheet ────────────────────────────────────
 *
 * The filter column was `xs={24}`: on a 390px screen the entire panel stacked
 * ABOVE the results, so a person scrolled past every facet to reach the first
 * card (§83(b), audit S-6). Below the tablet breakpoint the panel now lives
 * behind a "Filters (N)" button and opens as a bottom sheet through the shared
 * `SkinDialog`, with the count of what is applied on the button itself.
 *
 * ── Where the search opens, and what it calls the place ───────────────────
 *
 * `geoOffer` is a place this search COULD be narrowed to — the visitor's own
 * position, as the host resolved it — and `geoLabel` says what the place a
 * search is ALREADY narrowed to is CALLED. Both are the host's to resolve:
 * this page has a `lat` and a `lon` in its query string and no way on earth to
 * turn them into "Berlin Mitte", which is exactly why it must not print them.
 * A search package that grew a geocoder to say a nicer sentence would have
 * taken on the whole of `geo-react` to avoid one bad line.
 *
 * The offer is never applied on the page's own initiative: it is drawn as a
 * button on the location row, and pressing it is the person's word. See
 * {@link SearchStateProviderProps.geoOffer} for the defect that shape closes.
 *
 * ── The filter column is laid out only when there is something in it ──────
 *
 * `Col md={7}` was unconditional, and on a deployment whose search plan
 * declares no facets that spent a quarter of every results page — `/s`, every
 * category page, every seller page — on an empty-state illustration saying
 * "no filters for this search". Saying it once is honest; reserving a column
 * for it on every screen is not a message, it is a hole. The page asks the
 * facet bag what it has (`useFacetPanel`) and gives the results the whole
 * width when the answer is nothing AND no other filter control has anything
 * to show. Note which way the test runs: the column stays for `loading` and
 * for `failed`, because a panel that has not answered yet is not a panel with
 * nothing in it, and a layout that reflowed underneath a person mid-load would
 * be worse than the hole.
 */
import { useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Flex } from "antd";
import { SkinDialog, SkinTheme, useDialogSurface } from "@stapel/tokens-antd/skin";
import { useT, useTPlural } from "@stapel/core";
import { cssVar, spacing } from "@stapel/tokens";
import type { FeatureDef } from "@stapel/attributes-react";
import { SearchStateProvider, useSearchState } from "../headless/SearchStateProvider.js";
import type { SearchParamsAdapter } from "../headless/SearchStateProvider.js";
import { useFacetPanel } from "../headless/FacetPanel.js";
import type { FacetLabelResolver } from "../headless/useFacetLabels.js";
import { useAppliedCount } from "../headless/useAppliedCount.js";
import type { ParseSearchStateOptions } from "../state/urlState.js";
import type { SearchGeo } from "../api/types.js";
import { buildRangeGroups } from "../state/ranges.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { FacetPanelPane } from "./FacetPanelPane.js";
import type {
  CategoryFilterSlotProps,
  GeoFilterSlotProps,
} from "./FacetPanelPane.js";
import { FilterChips } from "./FilterChips.js";
import { LocationSummaryLine } from "./LocationSummaryLine.js";
import { PageSizeSelect } from "./PageSizeSelect.js";
import { SearchBox } from "./SearchBox.js";
import type {
  OtherCategoryHrefResolver,
  OtherCategoryNamer,
} from "./OtherCategoriesLine.js";
import { SearchResultsPane } from "./SearchResultsPane.js";
import type { SearchResultsWrapper } from "./SearchResultsPane.js";
import { SortSelect } from "./SortSelect.js";
import { SEARCH_BUILTIN_VIEWS, ViewSwitch, resolveView } from "./ViewSwitch.js";
import type { SearchView } from "./ViewSwitch.js";
import type { DegradationNoticeVariant } from "./DegradationNotice.js";
import type { SearchCardRenderer } from "./SearchResultCard.js";
import { UrlIssueNotice } from "./UrlIssueNotice.js";
import type { ThemeModeProp } from "./types.js";

/** Where the filters live: beside the results, or behind a button in a sheet. */
export type SearchFiltersLayout = "column" | "sheet";

/**
 * The desktop filter rail's width.
 *
 * A rail, not a half-page. `Col md={7}` gave the panel a SHARE of the page, so
 * on a wide screen the filters grew with it — the visual pass measured 570 of
 * 1280px (45%) spent on the controls that narrow a list, next to the list they
 * narrow. Filters are a fixed instrument: a checkbox column needs the width of
 * its longest label and nothing more, and every pixel past that comes out of
 * the results. 280px is that width at the default type step, and it is the
 * same panel the phone sheet draws — one component, two frames.
 */
export const FILTERS_RAIL_WIDTH = 280;

/**
 * The rail: fixed width, never squeezed, never grown — and STICKY.
 *
 * A catalogue page is thirty cards long and the filters are at the top of it,
 * so by the fourth row of results the controls that narrow the list are a
 * screenful above the list they narrow: the only way to change a filter after
 * scrolling was to scroll back. The rail now stays put while the results move
 * under it, and scrolls INTERNALLY when its own content is taller than the
 * window (`overflowY: auto` + a viewport-height cap), which is the one place a
 * viewport measure is right — the sticky box's height IS the window's.
 *
 * `alignSelf: flex-start` is load-bearing: a flex child stretches to the row's
 * height by default, and a stretched box has nothing to stick to.
 */
/** The class the rail's own scrollbar rules are hung on. */
export const RAIL_CLASS = "stapel-search-rail";

/** The `href` the hoisted rail sheet is deduplicated by. */
export const RAIL_STYLE_HREF = "stapel-search-rail";

/**
 * The rail scrolls, and its scrollbar must not sit ON the filters.
 *
 * `scrollbar-width: thin` and `scrollbar-gutter: stable` (below, in `RAIL`)
 * are the standard half of this and they are not enough: on every WebKit
 * platform with overlay scrollbars — a Mac by default, every iOS browser —
 * the bar is drawn OVER the content and the gutter reserves nothing, so the
 * walker saw the bar lying across the right edge of the checkbox labels.
 *
 * So the rail also declares a CLASSIC scrollbar through the WebKit
 * pseudo-elements: a bar with a real width, which pushes the panel's content
 * in by exactly that much instead of floating above it, drawn in the token
 * palette so it is the panel's own hairline in both themes rather than a
 * hard-coded grey that glows in the dark one. `--stapel-*` custom properties
 * resolve per theme at paint time, which is why this is a sheet and not a
 * pair of computed inline values: an inline colour would freeze whichever
 * theme was mounted first.
 *
 * Emitted as one hoisted `<style>` (React 19 dedupes by `href`), because a
 * pseudo-element is unreachable from an inline style — the same reason
 * `<LocationSummaryLine>` hoists one.
 */
export function railScrollbarCss(): string {
  const rail = `.${RAIL_CLASS}`;
  return [
    // A real width: an overlay bar occupies no space and therefore overlaps.
    `${rail}::-webkit-scrollbar{inline-size:8px;block-size:8px}`,
    `${rail}::-webkit-scrollbar-track{background:transparent}`,
    `${rail}::-webkit-scrollbar-thumb{background:${cssVar("border")};` +
      `border-radius:${cssVar("radius-full")}}`,
    `${rail}::-webkit-scrollbar-thumb:hover{background:${cssVar("text-subtle")}}`,
    // Firefox/Chromium's standard properties, stated here too so the rule
    // travels with the class when the panel is used outside `<SearchPage>`.
    `${rail}{scrollbar-width:thin;scrollbar-gutter:stable;` +
      `scrollbar-color:${cssVar("border")} transparent}`,
  ].join("\n");
}

const RAIL: CSSProperties = {
  flex: `0 0 ${String(FILTERS_RAIL_WIDTH)}px`,
  // Both bounds, not just the upper one. `flex-shrink: 0` already holds the
  // column at its basis in this row, but the panel is handed to hosts and to
  // the sheet as well, and a filter column that can be squeezed is how the
  // word "Filters" ended up laid out down its left edge (defect C14). The
  // width is a property of the instrument, so it is stated as one.
  minWidth: FILTERS_RAIL_WIDTH,
  maxWidth: FILTERS_RAIL_WIDTH,
  position: "sticky",
  top: 0,
  alignSelf: "flex-start",
  maxHeight: "100dvh",
  overflowY: "auto",
  overscrollBehavior: "contain",
  // The inner scroll must be VISIBLE. On overlay-scrollbar platforms (every
  // Mac by default, most phones) an `overflow-y: auto` column shows no
  // scrollbar until a pointer happens to scroll INSIDE it — so a rail taller
  // than the window is indistinguishable from a rail that ends at the fold,
  // and the walker measured 5717px of panel whose tail nothing signposted.
  // A thin, always-there scrollbar is the sign there is more; the stable
  // gutter keeps the panel's right edge from jumping when it appears.
  scrollbarWidth: "thin",
  scrollbarGutter: "stable",
  // Room for the focus ring of the last control against the scroll edge.
  paddingBlockEnd: spacing[2],
};

/** The results take what is left. `minWidth: 0` so a long word inside a card
 * cannot push the grid wider than its column. */
const RESULTS_COLUMN: CSSProperties = { flex: "1 1 auto", minWidth: 0 };

export interface SearchPageProps extends ThemeModeProp, ParseSearchStateOptions {
  /** The URL binding. `useRouterSearchParams()` from `./router` is the
   * react-router one. */
  readonly adapter: SearchParamsAdapter;
  readonly renderCard?: SearchCardRenderer;
  readonly categoryFeatures?: readonly FeatureDef[];
  readonly locale?: string;
  /**
   * Name the facet values neither the answer nor the category schema names —
   * see {@link FacetLabelResolver}.
   *
   * Set once here and it reaches BOTH filter surfaces, the desktop panel and
   * the phone chip row, the same way `geoLabel` does. It is the seam a
   * `ref_select` facet needs: its config carries a pointer to a vocabulary and
   * no option table, the vocabulary is a service this pair does not talk to,
   * and a server older than stapel-search 0.4.0 sends no `facet_labels` to
   * cover for it — so without this the chips print `apple` and `128-gb`.
   */
  readonly resolveFacetLabels?: FacetLabelResolver;
  /** Render the query box at the top. `false` for a container whose HEADER
   * already mounts `<SearchBox>` — one box per screen, not two. */
  readonly searchBox?: boolean;
  /** BCP-47 tags this deployment indexes, for the language filter. */
  readonly languages?: readonly string[];
  /**
   * The catalogue picker slot — see {@link FacetPanelPaneProps}.
   *
   * It reaches TWO surfaces: the filter panel's category row, and — on the
   * phone — the LEADING chip of the filter row, which opens the same control
   * in the same kind of sheet as every other chip. The owner's navigation
   * model chooses levels 1-2 from tiles and everything deeper as a
   * characteristic, and on a result list that is what a chip is.
   */
  readonly renderCategoryFilter?: (slot: CategoryFilterSlotProps) => ReactNode;
  /**
   * Draw the "Category" pane in the filter panel at all. Default `true`.
   *
   * `false` removes it entirely — see
   * {@link FacetPanelPaneProps.categoryFilter}. The page passes it on and
   * stops counting the category as a reason to keep the filter column open,
   * so a leaf whose only other filter is a price does not get a column
   * containing one pane the surface asked not to draw.
   */
  readonly categoryFilter?: boolean;
  /**
   * What the current category is CALLED — the chip's own text. The pair holds
   * a path of slugs and no way to turn one into a catalogue name; absent, the
   * chip states the path's last segment. See
   * {@link FilterChipsOpenerProps.categoryLabel}.
   */
  readonly categoryLabel?: ReactNode;
  /** The location control slot (`geo-react`). */
  readonly renderGeoFilter?: (slot: GeoFilterSlotProps) => ReactNode;
  /**
   * What the current location is CALLED, in words — set once here and it
   * reaches both filter surfaces, the desktop panel and the phone chip row.
   * See {@link FacetPanelPaneProps.geoLabel}: this page never prints a
   * coordinate, with or without it.
   */
  readonly geoLabel?: ReactNode;
  /**
   * The partition control, drawn at the top of the filter panel — see
   * {@link FacetPanelPaneProps.partition}.
   */
  readonly partition?: ReactNode;
  /** Facet slugs pinned above every other group — see
   * {@link FacetPanelPaneProps.pinnedFacets}. */
  readonly pinnedFacets?: readonly string[];
  /**
   * How a DICTIONARY group is drawn — see
   * {@link FacetPanelPaneProps.dictionaryMode}.
   *
   * Defaulted PER LAYOUT rather than left to the panel's own default, because
   * the two frames want opposite shapes and only this component knows which
   * one it is drawing: the desktop rail gets `"field"` (a select-style "Any"
   * that opens the searchable list — a 418-value vocabulary held open in a
   * 280px column is the whole column), the phone sheet gets `"sheet"` — the
   * same trigger row, opening a nested picker with a search box, a
   * recommended band and the rest.
   *
   * The phone default was `"inline"`, which drew the axis as a wall of
   * checkboxes with a "Find a value" box over it while the COMPOSER's picker
   * for the very same vocabulary was a trigger and a sheet. One dictionary,
   * two gestures, depending on which half of the product you were in. Set it
   * to override both; `"inline"` is still there for a surface that is
   * already devoted to one group.
   */
  readonly dictionaryMode?: "field" | "inline" | "sheet";
  /**
   * How many groups the rail draws before the rest fold behind "All filters"
   * — see {@link FacetPanelPaneProps.visibleGroups}.
   *
   * Defaulted PER LAYOUT, the same reasoning as `dictionaryMode`: 16 in the
   * desktop COLUMN, where the rail sits on screen the whole time and the tail
   * is a genuine scroll away; 8 in the phone SHEET, which is already a modal
   * a person paid a tap to open — folding its tail behind a second control
   * saves less than folding a column's does. Set it to override either.
   */
  readonly visibleGroups?: number | null;
  /** Print the engine's list of uncounted facet slugs in the filter panel.
   * Default `false` — see {@link FacetPanelPaneProps.skippedNotice}. */
  readonly skippedNotice?: boolean;
  /**
   * A location this search could be narrowed to, OFFERED to the visitor — see
   * {@link SearchStateProviderProps.geoOffer} for why it is an offer and not a
   * default, and for the defect that distinction closes.
   *
   * The host resolves the position; this page does not know what a map or a
   * geocoder is and must not learn. A browser prompt (`usePermission`
   * + `geolocation`) or the server's IP guess both arrive here as the same two
   * numbers. Nothing is applied until the person presses the offer, and
   * `geoOfferLabel` is what the button calls the place.
   */
  readonly geoOffer?: SearchGeo | undefined;
  /** Container chrome under the results — e.g. the ranking-disclosure link. */
  readonly footer?: ReactNode;
  /**
   * Rendered at the TOP of the filter column, above everything else.
   *
   * The slot exists for a filter this pair cannot ship and has no named seam
   * for. Whatever a host renders here reads and writes the same URL state as
   * the facets beside it (`useSearchState()`), so it is a filter in every
   * sense that matters and not a decoration bolted on top.
   */
  readonly filtersHeader?: ReactNode;
  /**
   * The row ABOVE the chips and the results — where `<LocationSummaryLine>`
   * goes on the phone SERP.
   *
   * A NEW slot rather than a reuse, and the existing four were each checked
   * first: `filtersHeader` is inside the filter panel (it is a filter, and on
   * a phone it is behind the sheet, which is precisely where a location
   * summary must NOT be); `breadcrumb` renders in the right place but names a
   * walk up the CATEGORY tree, and a host wanting a trail AND a location row
   * would have to choose; `resultsHeading` and the pane's `toolbar` are inside
   * the results pane, below the chips. Nothing sat between "the search box"
   * and "the filters", and that gap is exactly the ref's location row.
   *
   * It is rendered in the page's vertical stack, so it spans the full width in
   * BOTH layouts — above the chip row on a phone, above the two columns on a
   * desktop. That is deliberate: whatever states where a search is looking
   * describes the whole page, not the results column of it.
   */
  readonly resultsHeader?: ReactNode;
  /**
   * The top of the RESULTS COLUMN, above the toolbar and the heading row.
   *
   * The fifth slot, and the four before it were each checked first:
   * `resultsHeader` spans the whole page (both columns on a desktop), which is
   * right for a location row and wrong for anything that belongs over the list
   * — a category's own description, a promoted band, a "12 new since
   * yesterday" line all describe the RESULTS and would otherwise sit over the
   * filter rail as well; `breadcrumb` is a walk up the category tree and
   * renders above the heading; `resultsHeading` is the caption itself; the
   * pane's `toolbar` is the row of controls this slot sits above.
   *
   * Rendered inside the column in BOTH layouts, so on a phone it is above the
   * sort row and on a desktop it is above the sort row of the results column
   * only.
   */
  readonly resultsLead?: ReactNode;
  /**
   * Draw the APPLIED filter row in the results header — one chip per applied
   * value and per applied range, each of which removes it
   * (`<FilterChips mode="applied">`).
   *
   * `"desktop"` is the shape this exists for: where the rail is on screen a
   * choice otherwise leaves no trace above the results and dropping one of
   * two constraints means hunting its button back down the column, while on
   * the phone the opener row below already states every applied filter on its
   * own chips. `true` draws it in both layouts; omitted, nothing changes.
   *
   * It renders itself away when nothing is applied, so a host never has to
   * ask.
   */
  readonly appliedChips?: boolean | "desktop";
  /**
   * Draw "Search in other categories: Cars 12 · Buses 3 · …" above the
   * results — one line, from the SAME response the cards came from.
   *
   * It replaces the shape a storefront had built by hand: a full-width block
   * of one row per category, fetched from `/suggest` after the page had
   * settled and pushing everything below it when it landed. Here the rows are
   * `facet_meta.categories`, which the answer already carried, so with results
   * on screen the line costs no request and cannot arrive late. Only an EMPTY
   * result set asks `/suggest`, into a slot whose height is reserved from the
   * first frame.
   *
   * Opt-in, and `categoryName` is what makes it useful: the pair holds id
   * paths and no catalogue — see {@link OtherCategoriesLineProps.categoryName}.
   */
  readonly otherCategories?: boolean;
  /** What a category id path is CALLED, for the line above. The same question
   * `categoryLabel` answers for the chip, asked once per row. */
  readonly categoryName?: OtherCategoryNamer;
  /** A real address for a category id path, for the line above — see
   * {@link OtherCategoriesLineProps.categoryHref}. */
  readonly categoryHref?: OtherCategoryHrefResolver;
  /** What this surface calls its result list. See
   * {@link SearchResultsPaneProps.heading}. */
  readonly resultsHeading?: ReactNode;
  /** How the results surface says what the engine could not do (default
   * `"banner"`). Handed straight to `<SearchResultsPane>`. */
  readonly degradationNotice?: DegradationNoticeVariant;
  /**
   * Force the filter surface instead of reading the viewport. For tests and
   * for a host that renders the page inside a phone-width container that is
   * not the viewport — not an escape hatch for "I prefer a column on phones".
   */
  readonly filtersLayout?: SearchFiltersLayout;
  /**
   * The host's own exits from an empty result — sibling sections with their
   * counts. A SLOT for the same reason `breadcrumb` is one: walking the tree
   * belongs to `categories-react`. Everything the pair can derive on its own
   * (up a level, widen the radius, search everywhere, drop one filter) is
   * offered whether this is filled or not — see {@link EmptyExits}.
   */
  readonly renderEmptyExits?: () => ReactNode;
  /**
   * Open the phone filter sheet on mount.
   *
   * For a container that deep-links INTO the filters ("Refine this search"
   * from a category page), and for the story that photographs the sheet —
   * a state reached only by a tap is a state nothing outside a browser has
   * ever seen. The person still closes it; this is the initial value, not a
   * controlled one.
   */
  readonly defaultFiltersOpen?: boolean;
  /** Offer a page-size control beside the sort. Default `true`. */
  readonly pageSize?: boolean;
  /**
   * The trail above the heading — "Home / Cars / Sedans".
   *
   * A SLOT, because a breadcrumb is a walk up the CATEGORY tree and the tree
   * belongs to `categories-react`; a search package knows the `category`
   * parameter's value and nothing about its ancestors. Rendered above the
   * results heading, inside the results column, so it sits over the list it
   * describes rather than over the whole two-column page.
   */
  readonly breadcrumb?: ReactNode;
  /**
   * Wrap the results the page drew — a provider, an observer, an analytics
   * boundary — without taking over the arrangement. Handed straight to
   * `<SearchResultsPane wrapResults>`; see {@link SearchResultsWrapper} for
   * why a host cannot do this with `views`/`renderResults` alone.
   */
  readonly wrapResults?: SearchResultsWrapper;
  /**
   * The arrangements the view switch offers. Default: the pair's own list and
   * grid. A deployment adds its own — `{ id: "map", labelKey, icon, render }`
   * — and the switch treats it like the two that ship; see {@link SearchView}.
   *
   * A single view draws no switch at all.
   */
  readonly views?: readonly SearchView[];
  /** Which arrangement the page opens in. Default: the first of `views`. */
  readonly defaultView?: string;
  /** Told when the arrangement changes, for a host that remembers it. The
   * view is NOT url state — see `<ViewSwitch>` for why. */
  readonly onViewChange?: (id: string) => void;
  /**
   * The action at the trailing end of the results toolbar — conventionally
   * "notify me about new ones".
   *
   * A SLOT, and it cannot be anything else: saving a search and mailing its
   * new hits is a subscription with an owner, a schedule and a consent record,
   * none of which this pair has. What the pair CAN state is where such a
   * control belongs and that the page keeps room for it.
   */
  readonly resultsAction?: ReactNode;
  /**
   * Heading level for the results caption. Default `1` — on a results SCREEN
   * the list's name is the page's heading. A container that already prints its
   * own `<h1>` above this page passes a lower level.
   */
  readonly resultsHeadingLevel?: 1 | 2 | 3 | 4 | 5;
}

interface SearchPageBodyProps {
  readonly renderCard?: SearchCardRenderer;
  readonly categoryFilter?: boolean;
  readonly resultsLead?: ReactNode;
  readonly dictionaryMode?: "field" | "inline" | "sheet";
  readonly visibleGroups?: number | null;
  readonly categoryFeatures?: readonly FeatureDef[];
  readonly renderEmptyExits?: () => ReactNode;
  readonly locale?: string;
  readonly resolveFacetLabels?: FacetLabelResolver;
  readonly searchBox?: boolean;
  readonly languages?: readonly string[];
  readonly renderCategoryFilter?: (slot: CategoryFilterSlotProps) => ReactNode;
  readonly categoryLabel?: ReactNode;
  readonly renderGeoFilter?: (slot: GeoFilterSlotProps) => ReactNode;
  readonly geoLabel?: ReactNode;
  readonly skippedNotice?: boolean;
  readonly footer?: ReactNode;
  readonly filtersHeader?: ReactNode;
  readonly resultsHeader?: ReactNode;
  readonly appliedChips?: boolean | "desktop";
  readonly otherCategories?: boolean;
  readonly categoryName?: OtherCategoryNamer;
  readonly categoryHref?: OtherCategoryHrefResolver;
  readonly resultsHeading?: ReactNode;
  readonly degradationNotice?: DegradationNoticeVariant;
  readonly filtersLayout?: SearchFiltersLayout;
  readonly defaultFiltersOpen?: boolean;
  readonly pageSize?: boolean;
  readonly breadcrumb?: ReactNode;
  readonly wrapResults?: SearchResultsWrapper;
  readonly views?: readonly SearchView[];
  readonly defaultView?: string;
  readonly onViewChange?: (id: string) => void;
  readonly resultsAction?: ReactNode;
  readonly resultsHeadingLevel?: 1 | 2 | 3 | 4 | 5;
}

/**
 * The two columns, inside the state provider — which is where they have to be,
 * because the layout decision reads the same search the panes read.
 */
function SearchPageBody(props: SearchPageBodyProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { categoryFeatures, locale, resolveFacetLabels, filtersHeader } = props;
  const { state, geoOffer } = useSearchState();
  const facets = useFacetPanel({
    ...(categoryFeatures !== undefined ? { categoryFeatures } : {}),
    ...(locale !== undefined ? { locale } : {}),
    ...(resolveFacetLabels !== undefined ? { resolveFacetLabels } : {}),
  });
  const applied = useAppliedCount();
  const surface = useDialogSurface();
  const layout: SearchFiltersLayout =
    props.filtersLayout ?? (surface === "sheet" ? "sheet" : "column");
  const [sheetOpen, setSheetOpen] = useState(props.defaultFiltersOpen === true);

  // How the results are ARRANGED. Component state, not URL state: it changes
  // how the same answer is drawn, never what the answer is, so it must not
  // rewrite the meaning of a link somebody shared (`<ViewSwitch>` §the view is
  // not URL state).
  const views = props.views ?? SEARCH_BUILTIN_VIEWS;
  const [viewId, setViewId] = useState<string | undefined>(props.defaultView);
  const view = resolveView(views, viewId) ?? { id: "", labelKey: "" };
  const changeView = (next: string): void => {
    setViewId(next);
    props.onViewChange?.(next);
  };

  /**
   * "Show 25 results", not "Show results".
   *
   * The sheet's own button is the only place a person learns what the filters
   * they just ticked did — the results are behind it. When the engine cannot
   * say how many there are (`countKind: "unknown"`) the button says so by
   * saying nothing: a fabricated number on the one control that commits the
   * change is worse than a generic verb.
   */
  const applyLabel =
    applied.count === null || applied.kind === "unknown"
      ? t(SEARCH_I18N_KEYS.filtersApply)
      : tPlural(
          applied.kind === "at_least"
            ? SEARCH_I18N_KEYS.filtersShowCountAtLeast
            : SEARCH_I18N_KEYS.filtersShowCount,
          { count: applied.count }
        );

  // "Nothing to filter by" is a LOADED answer of zero facet groups AND no
  // other control with anything to say — see the header. Every clause is a
  // control that would otherwise be hidden behind an empty panel: a numeric
  // range the schema declares, a category or a language the URL carries, a
  // host slot that is filled.
  const ranges = buildRangeGroups({
    state,
    ...(categoryFeatures !== undefined ? { categoryFeatures } : {}),
    // The answer's measured axes count as rows here too: a leaf whose numeric
    // axes are all vocabulary-backed has filters, and the schema alone would
    // have called that column empty.
    ...(facets.ranges !== undefined ? { ranges: facets.ranges } : {}),
  });
  const filtersEmpty =
    facets.state.status === "ready" &&
    facets.state.data.length === 0 &&
    // `withheld` (groups the server counted and held back for covering too
    // little of the result set) used to keep the column open so the panel
    // could name how many. It no longer prints that sentence at all (D175,
    // amended) — a reference catalogue says nothing in this case either — so
    // zero groups plus zero of everything else below really is nothing to
    // show.
    facets.activeFilters === 0 &&
    ranges.length === 0 &&
    // A category pane the surface turned off is not a control on this rail,
    // however narrowed the search is: the way back out of a leaf is then the
    // breadcrumb or the tiles above, not a filter (`categoryFilter`).
    (props.categoryFilter === false ||
      (state.category === undefined &&
        props.renderCategoryFilter === undefined)) &&
    state.lang === undefined &&
    (props.languages ?? []).length === 0;
  const showFilters = filtersHeader !== undefined || !filtersEmpty;

  const panel = (
    <Flex vertical gap={spacing[4]}>
      {filtersHeader}
      {/* The facet panel is skipped entirely when the only thing it would draw
          is its own empty state and the column is open for the host's control
          alone — one empty-state illustration under a working filter is still
          a hole, just a smaller one. */}
      {/* In the sheet the dialog's own title already says "Filters"; the panel
          repeating it printed the word twice, one line apart. */}
      {/* Per layout: the sheet gets no second "Filters" title (the dialog owns
          one) and no footer bar — its own "Show N results" footer is already
          the count AND the exit. The rail gets the sticky footer bar: desktop
          filters apply instantly, and without it the only feedback was a
          result count scrolled out of sight above the fold. */}
      {filtersEmpty ? null : (
        <FacetPanelPane
          {...(layout === "sheet"
            ? { heading: null }
            : // STATIC, not sticky: the rail scrolls with the page, and a bar
              // pinned to the port's floor sat on top of the last groups.
              { footerBar: "static" as const })}
          dictionaryMode={props.dictionaryMode ?? (layout === "sheet" ? "sheet" : "field")}
          // `??` would treat an explicit `null` ("never fold") the same as
          // "not set": `visibleGroups` uses `null` as a real value, unlike
          // `dictionaryMode` above, so only `undefined` falls through.
          visibleGroups={
            props.visibleGroups !== undefined
              ? props.visibleGroups
              : layout === "sheet"
                ? 8
                : 16
          }
          {...(categoryFeatures !== undefined ? { categoryFeatures } : {})}
          {...(props.renderEmptyExits !== undefined
            ? { renderEmptyExits: props.renderEmptyExits }
            : {})}
          {...(locale !== undefined ? { locale } : {})}
          {...(resolveFacetLabels !== undefined ? { resolveFacetLabels } : {})}
          {...(props.languages !== undefined ? { languages: props.languages } : {})}
          {...(props.renderCategoryFilter !== undefined
            ? { renderCategoryFilter: props.renderCategoryFilter }
            : {})}
          {...(props.categoryFilter !== undefined
            ? { categoryFilter: props.categoryFilter }
            : {})}
          {...(props.skippedNotice !== undefined
            ? { skippedNotice: props.skippedNotice }
            : {})}
        />
      )}
    </Flex>
  );

  /*
   * The toolbar over the results: how they are ARRANGED, how they are ORDERED,
   * how many per page — and the surface's own action at the trailing end.
   *
   * TWO shapes, because at 390px the desktop shape is not a smaller version of
   * itself, it is four stacked rows. The phone form is the reference's own
   * sort row: the ordering at one end, the surface's action at the other, one
   * line, nothing else. `pageSize` is already the surface's call; the view
   * switch draws nothing for a single view and stays in the row for the
   * surfaces that offer two.
   */
  const phoneToolbar = layout === "sheet";
  const toolbar = phoneToolbar ? (
    <Flex
      align="center"
      justify="space-between"
      gap={spacing[2]}
      style={{ width: "100%" }}
    >
      <Flex align="center" gap={spacing[2]} style={{ minWidth: 0 }}>
        <ViewSwitch views={views} value={view.id} onChange={changeView} />
        <SortSelect compact />
      </Flex>
      {props.resultsAction}
    </Flex>
  ) : (
    <Flex align="center" wrap gap={spacing[3]}>
      <ViewSwitch views={views} value={view.id} onChange={changeView} />
      <SortSelect />
      {props.pageSize !== false && <PageSizeSelect />}
      {props.resultsAction}
    </Flex>
  );

  const results = (
    <SearchResultsPane
      toolbar={toolbar}
      {...(props.resultsLead !== undefined ? { lead: props.resultsLead } : {})}
      {...(phoneToolbar ? { header: "compact" as const } : {})}
      headingLevel={props.resultsHeadingLevel ?? 1}
      {...(view.render !== undefined ? { renderResults: view.render } : {})}
      {...(props.wrapResults !== undefined ? { wrapResults: props.wrapResults } : {})}
      {...(view.layout !== undefined ? { layout: view.layout } : {})}
      {...(props.renderCard !== undefined ? { renderCard: props.renderCard } : {})}
      {...(props.footer !== undefined ? { footer: props.footer } : {})}
      {...(props.otherCategories !== undefined
        ? { otherCategories: props.otherCategories }
        : {})}
      {...(props.categoryName !== undefined
        ? { categoryName: props.categoryName }
        : {})}
      {...(props.categoryHref !== undefined
        ? { categoryHref: props.categoryHref }
        : {})}
      {...(props.resultsHeading !== undefined
        ? { heading: props.resultsHeading }
        : {})}
      {...(props.degradationNotice !== undefined
        ? { degradationNotice: props.degradationNotice }
        : {})}
      {...(categoryFeatures !== undefined ? { categoryFeatures } : {})}
      {...(props.renderEmptyExits !== undefined
        ? { renderEmptyExits: props.renderEmptyExits }
        : {})}
    />
  );

  return (
    <Flex
      vertical
      gap={spacing[4]}
      data-testid="search-page"
      data-filters={showFilters ? "on" : "off"}
      data-filters-layout={layout}
    >
      {props.searchBox !== false && <SearchBox />}
      {props.breadcrumb !== undefined && (
        <div data-testid="search-breadcrumb">{props.breadcrumb}</div>
      )}
      <UrlIssueNotice />

      {/* THE LOCATION CONTROL — a place, its radius, and the way to change
          either. Mounted by the PAGE, not by each host, which is how a
          category results page came to have no way to say where it was
          looking while `/s` had one: the row was a slot every surface had to
          remember to fill, and one of them did not.

          Drawn when this deployment can resolve a place at all, or when the
          address already carries one (a shared link must always be widenable
          by whoever opens it). It is not a filter and it is not in the filter
          count — see `activeFilterCount`.

          Three reasons to draw it, and an offer is one of them: a deployment
          that can place its visitor but ships no place picker still needs
          somewhere for them to accept — otherwise the offer is a value with
          no control, which is the same silence this pack is about. */}
      {(props.renderGeoFilter !== undefined ||
        state.geo !== undefined ||
        geoOffer !== undefined) && (
        <LocationSummaryLine
          {...(props.renderGeoFilter !== undefined
            ? { renderGeoFilter: props.renderGeoFilter }
            : {})}
          {...(props.geoLabel !== undefined ? { geoLabel: props.geoLabel } : {})}
          // No door where the room is already open: the desktop column layout
          // has the whole panel on screen beside this row.
          filtersDoor={layout === "sheet"}
          onOpenAll={() => {
            setSheetOpen(true);
          }}
        />
      )}

      {/* Above the chips in the sheet layout and above the columns in the
          other one — see {@link SearchPageProps.resultsHeader}. `?? null` is
          the written decision, not an oversight: a page with nothing to say
          about location says nothing rather than reserving a blank row. */}
      {props.resultsHeader !== undefined && (
        <div data-testid="search-results-header">{props.resultsHeader}</div>
      )}

      {/* What the search is NARROWED to, above the results, each constraint
          beside the control that drops it. Drawn in the same band as the
          results header because that is where a host would otherwise hand-mount
          it — and it draws nothing at all when nothing is applied. */}
      {(props.appliedChips === true ||
        (props.appliedChips === "desktop" && layout !== "sheet")) && (
        <FilterChips
          mode="applied"
          {...(categoryFeatures !== undefined ? { categoryFeatures } : {})}
          {...(locale !== undefined ? { locale } : {})}
          {...(resolveFacetLabels !== undefined ? { resolveFacetLabels } : {})}
        />
      )}

      {showFilters && layout === "sheet" ? (
        <>
          {/* The phone's filter row. It REPLACES the full-width "Filters (3)"
              button that used to stand here: that button said how many
              constraints were applied and not one word about WHICH, and put
              every filter behind one tap onto a sheet you then had to scroll.
              The chips state the filters on the page — and the leading chip is
              still the whole panel, for the person who wants all of it. */}
          <FilterChips
            onOpenAll={() => {
              setSheetOpen(true);
            }}
            {...(categoryFeatures !== undefined ? { categoryFeatures } : {})}
            {...(locale !== undefined ? { locale } : {})}
            {...(resolveFacetLabels !== undefined ? { resolveFacetLabels } : {})}
            /* The catalogue picker becomes the row's leading chip. The panel
               behind the circle keeps its own copy of the control; both write
               the same `category` parameter, so they cannot disagree. */
            {...(props.renderCategoryFilter !== undefined &&
            props.categoryFilter !== false
              ? { renderCategoryFilter: props.renderCategoryFilter }
              : {})}
            {...(props.categoryLabel !== undefined
              ? { categoryLabel: props.categoryLabel }
              : {})}
          />
          <SkinDialog
            open={sheetOpen}
            onClose={() => {
              setSheetOpen(false);
            }}
            title={t(SEARCH_I18N_KEYS.facetsTitle)}
            dismissLabel={t(SEARCH_I18N_KEYS.filtersDismiss)}
            data-testid="search-filters-sheet"
            footer={
              <Button
                block
                type="primary"
                data-testid="search-filters-apply"
                data-analytics="none"
                data-analytics-reason="the filters are already applied; this closes the sheet"
                onClick={() => {
                  setSheetOpen(false);
                }}
              >
                {applyLabel}
              </Button>
            }
          >
            {panel}
          </SkinDialog>
          {results}
        </>
      ) : showFilters ? (
        <Flex align="flex-start" gap={spacing[5]} data-testid="search-page-columns">
          <div className={RAIL_CLASS} style={RAIL}>
            {/* The rail's scrollbar, in the gutter and in the token palette —
                see `railScrollbarCss`. Hoisted, deduped by `href`. */}
            <style href={RAIL_STYLE_HREF} precedence="default">
              {railScrollbarCss()}
            </style>
            {panel}
          </div>
          {/* ONE heading and ONE sort control. The page used to caption
              the toolbar "Results" and then mount a pane whose own heading
              says "Results" again — the live /s page printed both, one
              above the other. The pane owns the heading row; the page puts
              the sort control INTO it, and `resultsHeading` puts this
              surface's own word there rather than above it. */}
          <div style={RESULTS_COLUMN}>{results}</div>
        </Flex>
      ) : (
        results
      )}
    </Flex>
  );
}

export function SearchPage(props: SearchPageProps): ReactElement {
  const {
    adapter,
    renderCard,
    categoryFeatures,
    locale,
    resolveFacetLabels,
    searchBox,
    languages,
    renderCategoryFilter,
    categoryLabel,
    renderGeoFilter,
    geoLabel,
    skippedNotice,
    geoOffer,
    footer,
    filtersHeader,
    resultsHeader,
    resultsLead,
    categoryFilter,
    appliedChips,
    otherCategories,
    categoryName,
    categoryHref,
    resultsHeading,
    degradationNotice,
    filtersLayout,
    defaultFiltersOpen,
    pageSize,
    breadcrumb,
    wrapResults,
    views,
    defaultView,
    onViewChange,
    resultsAction,
    resultsHeadingLevel,
    dictionaryMode,
    visibleGroups,
    mode,
    ...parseOptions
  } = props;

  return (
    <SkinTheme surface="base" {...(mode !== undefined ? { mode } : {})}>
      <SearchStateProvider adapter={adapter} geoOffer={geoOffer} {...parseOptions}>
        <SearchPageBody
          {...(renderCard !== undefined ? { renderCard } : {})}
          {...(dictionaryMode !== undefined ? { dictionaryMode } : {})}
          {...(visibleGroups !== undefined ? { visibleGroups } : {})}
          {...(categoryFeatures !== undefined ? { categoryFeatures } : {})}
          {...(locale !== undefined ? { locale } : {})}
          {...(resolveFacetLabels !== undefined ? { resolveFacetLabels } : {})}
          {...(searchBox !== undefined ? { searchBox } : {})}
          {...(languages !== undefined ? { languages } : {})}
          {...(renderCategoryFilter !== undefined ? { renderCategoryFilter } : {})}
          {...(categoryLabel !== undefined ? { categoryLabel } : {})}
          {...(renderGeoFilter !== undefined ? { renderGeoFilter } : {})}
          {...(geoLabel !== undefined ? { geoLabel } : {})}
          {...(skippedNotice !== undefined ? { skippedNotice } : {})}
          {...(footer !== undefined ? { footer } : {})}
          {...(filtersHeader !== undefined ? { filtersHeader } : {})}
          {...(resultsHeader !== undefined ? { resultsHeader } : {})}
          {...(resultsLead !== undefined ? { resultsLead } : {})}
          {...(categoryFilter !== undefined ? { categoryFilter } : {})}
          {...(appliedChips !== undefined ? { appliedChips } : {})}
          {...(otherCategories !== undefined ? { otherCategories } : {})}
          {...(categoryName !== undefined ? { categoryName } : {})}
          {...(categoryHref !== undefined ? { categoryHref } : {})}
          {...(resultsHeading !== undefined ? { resultsHeading } : {})}
          {...(degradationNotice !== undefined ? { degradationNotice } : {})}
          {...(filtersLayout !== undefined ? { filtersLayout } : {})}
          {...(defaultFiltersOpen !== undefined ? { defaultFiltersOpen } : {})}
          {...(pageSize !== undefined ? { pageSize } : {})}
          {...(breadcrumb !== undefined ? { breadcrumb } : {})}
          {...(wrapResults !== undefined ? { wrapResults } : {})}
          {...(views !== undefined ? { views } : {})}
          {...(defaultView !== undefined ? { defaultView } : {})}
          {...(onViewChange !== undefined ? { onViewChange } : {})}
          {...(resultsAction !== undefined ? { resultsAction } : {})}
          {...(resultsHeadingLevel !== undefined ? { resultsHeadingLevel } : {})}
        />
      </SearchStateProvider>
    </SkinTheme>
  );
}
