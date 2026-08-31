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
 * `defaultGeo` centres a fresh search on the visitor — a granted browser
 * prompt, or the server's IP guess when there was none — and `geoLabel` says
 * what that place is CALLED. Both are the host's to resolve: this page has a
 * `lat` and a `lon` in its query string and no way on earth to turn them into
 * "Berlin Mitte", which is exactly why it must not print them. A search
 * package that grew a geocoder to say a nicer sentence would have taken on the
 * whole of `geo-react` to avoid one bad line.
 *
 * The centring is applied once, only into a URL that carries no location, and
 * never again after the visitor has said anything about location themselves —
 * see {@link SearchStateProviderProps.defaultGeo}, which owns the rules.
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
import { spacing } from "@stapel/tokens";
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
import { PageSizeSelect } from "./PageSizeSelect.js";
import { SearchBox } from "./SearchBox.js";
import { SearchResultsPane } from "./SearchResultsPane.js";
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
const RAIL: CSSProperties = {
  flex: `0 0 ${String(FILTERS_RAIL_WIDTH)}px`,
  maxWidth: FILTERS_RAIL_WIDTH,
  position: "sticky",
  top: 0,
  alignSelf: "flex-start",
  maxHeight: "100dvh",
  overflowY: "auto",
  overscrollBehavior: "contain",
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
   * What the current category is CALLED — the chip's own text. The pair holds
   * a path of slugs and no way to turn one into a catalogue name; absent, the
   * chip states the path's last segment. See
   * {@link FilterChipsProps.categoryLabel}.
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
   * Open the search centred where the visitor is, when the URL says nothing
   * about location — see {@link SearchStateProviderProps.defaultGeo} for the
   * four rules that keep it from overruling a link or a person.
   *
   * The host resolves the position; this page does not know what a map or a
   * geocoder is and must not learn. A browser prompt (`usePermission`
   * + `geolocation`) or the server's IP guess both arrive here as the same two
   * numbers, and `geoLabel` is where the name of the place they mean comes in.
   */
  readonly defaultGeo?: SearchGeo | undefined;
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
  readonly categoryFeatures?: readonly FeatureDef[];
  readonly locale?: string;
  readonly resolveFacetLabels?: FacetLabelResolver;
  readonly searchBox?: boolean;
  readonly languages?: readonly string[];
  readonly renderCategoryFilter?: (slot: CategoryFilterSlotProps) => ReactNode;
  readonly categoryLabel?: ReactNode;
  readonly renderGeoFilter?: (slot: GeoFilterSlotProps) => ReactNode;
  readonly geoLabel?: ReactNode;
  readonly footer?: ReactNode;
  readonly filtersHeader?: ReactNode;
  readonly resultsHeader?: ReactNode;
  readonly resultsHeading?: ReactNode;
  readonly degradationNotice?: DegradationNoticeVariant;
  readonly filtersLayout?: SearchFiltersLayout;
  readonly defaultFiltersOpen?: boolean;
  readonly pageSize?: boolean;
  readonly breadcrumb?: ReactNode;
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
  const { state } = useSearchState();
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
  });
  const filtersEmpty =
    facets.state.status === "ready" &&
    facets.state.data.length === 0 &&
    facets.activeFilters === 0 &&
    ranges.length === 0 &&
    state.category === undefined &&
    state.lang === undefined &&
    props.renderCategoryFilter === undefined &&
    props.renderGeoFilter === undefined &&
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
      {filtersEmpty ? null : (
        <FacetPanelPane
          {...(layout === "sheet" ? { heading: null } : {})}
          {...(categoryFeatures !== undefined ? { categoryFeatures } : {})}
          {...(locale !== undefined ? { locale } : {})}
          {...(resolveFacetLabels !== undefined ? { resolveFacetLabels } : {})}
          {...(props.languages !== undefined ? { languages: props.languages } : {})}
          {...(props.renderCategoryFilter !== undefined
            ? { renderCategoryFilter: props.renderCategoryFilter }
            : {})}
          {...(props.renderGeoFilter !== undefined
            ? { renderGeoFilter: props.renderGeoFilter }
            : {})}
          {...(props.geoLabel !== undefined ? { geoLabel: props.geoLabel } : {})}
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
      {...(phoneToolbar ? { header: "compact" as const } : {})}
      headingLevel={props.resultsHeadingLevel ?? 1}
      {...(view.render !== undefined ? { renderResults: view.render } : {})}
      {...(view.layout !== undefined ? { layout: view.layout } : {})}
      {...(props.renderCard !== undefined ? { renderCard: props.renderCard } : {})}
      {...(props.footer !== undefined ? { footer: props.footer } : {})}
      {...(props.resultsHeading !== undefined
        ? { heading: props.resultsHeading }
        : {})}
      {...(props.degradationNotice !== undefined
        ? { degradationNotice: props.degradationNotice }
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

      {/* Above the chips in the sheet layout and above the columns in the
          other one — see {@link SearchPageProps.resultsHeader}. `?? null` is
          the written decision, not an oversight: a page with nothing to say
          about location says nothing rather than reserving a blank row. */}
      {props.resultsHeader !== undefined && (
        <div data-testid="search-results-header">{props.resultsHeader}</div>
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
            {...(props.renderCategoryFilter !== undefined
              ? { renderCategoryFilter: props.renderCategoryFilter }
              : {})}
            {...(props.categoryLabel !== undefined
              ? { categoryLabel: props.categoryLabel }
              : {})}
            {...(props.renderGeoFilter !== undefined
              ? { renderGeoFilter: props.renderGeoFilter }
              : {})}
            {...(props.geoLabel !== undefined ? { geoLabel: props.geoLabel } : {})}
            /* The row above already states the location and opens its own
               sheet, so the chip would be the second control over one filter
               — see `FilterChipsProps.geoChip`. */
            {...(props.resultsHeader !== undefined ? { geoChip: false } : {})}
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
          <div style={RAIL}>{panel}</div>
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
    defaultGeo,
    footer,
    filtersHeader,
    resultsHeader,
    resultsHeading,
    degradationNotice,
    filtersLayout,
    defaultFiltersOpen,
    pageSize,
    breadcrumb,
    views,
    defaultView,
    onViewChange,
    resultsAction,
    resultsHeadingLevel,
    mode,
    ...parseOptions
  } = props;

  return (
    <SkinTheme surface="base" {...(mode !== undefined ? { mode } : {})}>
      <SearchStateProvider adapter={adapter} defaultGeo={defaultGeo} {...parseOptions}>
        <SearchPageBody
          {...(renderCard !== undefined ? { renderCard } : {})}
          {...(categoryFeatures !== undefined ? { categoryFeatures } : {})}
          {...(locale !== undefined ? { locale } : {})}
          {...(resolveFacetLabels !== undefined ? { resolveFacetLabels } : {})}
          {...(searchBox !== undefined ? { searchBox } : {})}
          {...(languages !== undefined ? { languages } : {})}
          {...(renderCategoryFilter !== undefined ? { renderCategoryFilter } : {})}
          {...(categoryLabel !== undefined ? { categoryLabel } : {})}
          {...(renderGeoFilter !== undefined ? { renderGeoFilter } : {})}
          {...(geoLabel !== undefined ? { geoLabel } : {})}
          {...(footer !== undefined ? { footer } : {})}
          {...(filtersHeader !== undefined ? { filtersHeader } : {})}
          {...(resultsHeader !== undefined ? { resultsHeader } : {})}
          {...(resultsHeading !== undefined ? { resultsHeading } : {})}
          {...(degradationNotice !== undefined ? { degradationNotice } : {})}
          {...(filtersLayout !== undefined ? { filtersLayout } : {})}
          {...(defaultFiltersOpen !== undefined ? { defaultFiltersOpen } : {})}
          {...(pageSize !== undefined ? { pageSize } : {})}
          {...(breadcrumb !== undefined ? { breadcrumb } : {})}
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
