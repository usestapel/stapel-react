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
 * `footer` (the container's own chrome), `filtersHeader` and `resultsHeading`.
 * None of them is optional behaviour in disguise — every one has a working
 * default or a visible placeholder.
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
import { useAppliedCount } from "../headless/useAppliedCount.js";
import type { ParseSearchStateOptions } from "../state/urlState.js";
import { buildRangeGroups } from "../state/ranges.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { FacetPanelPane } from "./FacetPanelPane.js";
import type {
  CategoryFilterSlotProps,
  GeoFilterSlotProps,
} from "./FacetPanelPane.js";
import { PageSizeSelect } from "./PageSizeSelect.js";
import { SearchBox } from "./SearchBox.js";
import { SearchResultsPane } from "./SearchResultsPane.js";
import { SortSelect } from "./SortSelect.js";
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

/** The rail: fixed, never squeezed, never grown. */
const RAIL: CSSProperties = {
  flex: `0 0 ${String(FILTERS_RAIL_WIDTH)}px`,
  maxWidth: FILTERS_RAIL_WIDTH,
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
  /** Render the query box at the top. `false` for a container whose HEADER
   * already mounts `<SearchBox>` — one box per screen, not two. */
  readonly searchBox?: boolean;
  /** BCP-47 tags this deployment indexes, for the language filter. */
  readonly languages?: readonly string[];
  /** The catalogue picker slot — see {@link FacetPanelPaneProps}. */
  readonly renderCategoryFilter?: (slot: CategoryFilterSlotProps) => ReactNode;
  /** The location control slot (`geo-react`). */
  readonly renderGeoFilter?: (slot: GeoFilterSlotProps) => ReactNode;
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
}

interface SearchPageBodyProps {
  readonly renderCard?: SearchCardRenderer;
  readonly categoryFeatures?: readonly FeatureDef[];
  readonly locale?: string;
  readonly searchBox?: boolean;
  readonly languages?: readonly string[];
  readonly renderCategoryFilter?: (slot: CategoryFilterSlotProps) => ReactNode;
  readonly renderGeoFilter?: (slot: GeoFilterSlotProps) => ReactNode;
  readonly footer?: ReactNode;
  readonly filtersHeader?: ReactNode;
  readonly resultsHeading?: ReactNode;
  readonly degradationNotice?: DegradationNoticeVariant;
  readonly filtersLayout?: SearchFiltersLayout;
  readonly defaultFiltersOpen?: boolean;
  readonly pageSize?: boolean;
}

/**
 * The two columns, inside the state provider — which is where they have to be,
 * because the layout decision reads the same search the panes read.
 */
function SearchPageBody(props: SearchPageBodyProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { categoryFeatures, locale, filtersHeader } = props;
  const { state } = useSearchState();
  const facets = useFacetPanel({
    ...(categoryFeatures !== undefined ? { categoryFeatures } : {}),
    ...(locale !== undefined ? { locale } : {}),
  });
  const applied = useAppliedCount();
  const surface = useDialogSurface();
  const layout: SearchFiltersLayout =
    props.filtersLayout ?? (surface === "sheet" ? "sheet" : "column");
  const [sheetOpen, setSheetOpen] = useState(props.defaultFiltersOpen === true);

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
          {...(props.languages !== undefined ? { languages: props.languages } : {})}
          {...(props.renderCategoryFilter !== undefined
            ? { renderCategoryFilter: props.renderCategoryFilter }
            : {})}
          {...(props.renderGeoFilter !== undefined
            ? { renderGeoFilter: props.renderGeoFilter }
            : {})}
        />
      )}
    </Flex>
  );

  const toolbar = (
    <Flex align="center" wrap gap={spacing[3]}>
      <SortSelect />
      {props.pageSize !== false && <PageSizeSelect />}
    </Flex>
  );

  const results = (
    <SearchResultsPane
      toolbar={toolbar}
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
      <UrlIssueNotice />

      {showFilters && layout === "sheet" ? (
        <>
          <Button
            block
            data-testid="search-filters-open"
            data-analytics="none"
            data-analytics-reason="opening the filter sheet is a read, not a flow step"
            onClick={() => {
              setSheetOpen(true);
            }}
          >
            {/* "Filters (0)" is a count of nothing printed on the control that
                opens the thing that would produce one. The count appears when
                there is a count. */}
            {facets.activeFilters === 0
              ? t(SEARCH_I18N_KEYS.facetsTitle)
              : t(SEARCH_I18N_KEYS.filtersOpen, { count: facets.activeFilters })}
          </Button>
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
    searchBox,
    languages,
    renderCategoryFilter,
    renderGeoFilter,
    footer,
    filtersHeader,
    resultsHeading,
    degradationNotice,
    filtersLayout,
    defaultFiltersOpen,
    pageSize,
    mode,
    ...parseOptions
  } = props;

  return (
    <SkinTheme surface="base" {...(mode !== undefined ? { mode } : {})}>
      <SearchStateProvider adapter={adapter} {...parseOptions}>
        <SearchPageBody
          {...(renderCard !== undefined ? { renderCard } : {})}
          {...(categoryFeatures !== undefined ? { categoryFeatures } : {})}
          {...(locale !== undefined ? { locale } : {})}
          {...(searchBox !== undefined ? { searchBox } : {})}
          {...(languages !== undefined ? { languages } : {})}
          {...(renderCategoryFilter !== undefined ? { renderCategoryFilter } : {})}
          {...(renderGeoFilter !== undefined ? { renderGeoFilter } : {})}
          {...(footer !== undefined ? { footer } : {})}
          {...(filtersHeader !== undefined ? { filtersHeader } : {})}
          {...(resultsHeading !== undefined ? { resultsHeading } : {})}
          {...(degradationNotice !== undefined ? { degradationNotice } : {})}
          {...(filtersLayout !== undefined ? { filtersLayout } : {})}
          {...(defaultFiltersOpen !== undefined ? { defaultFiltersOpen } : {})}
          {...(pageSize !== undefined ? { pageSize } : {})}
        />
      </SearchStateProvider>
    </SkinTheme>
  );
}
