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
import type { ReactElement, ReactNode } from "react";
import { Button, Col, Flex, Row } from "antd";
import { SkinDialog, SkinTheme, useDialogSurface } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { FeatureDef } from "@stapel/attributes-react";
import { SearchStateProvider, useSearchState } from "../headless/SearchStateProvider.js";
import type { SearchParamsAdapter } from "../headless/SearchStateProvider.js";
import { useFacetPanel } from "../headless/FacetPanel.js";
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
  readonly pageSize?: boolean;
}

/**
 * The two columns, inside the state provider — which is where they have to be,
 * because the layout decision reads the same search the panes read.
 */
function SearchPageBody(props: SearchPageBodyProps): ReactElement {
  const t = useT();
  const { categoryFeatures, locale, filtersHeader } = props;
  const { state } = useSearchState();
  const facets = useFacetPanel({
    ...(categoryFeatures !== undefined ? { categoryFeatures } : {}),
    ...(locale !== undefined ? { locale } : {}),
  });
  const surface = useDialogSurface();
  const layout: SearchFiltersLayout =
    props.filtersLayout ?? (surface === "sheet" ? "sheet" : "column");
  const [sheetOpen, setSheetOpen] = useState(false);

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
      {filtersEmpty ? null : (
        <FacetPanelPane
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
            {t(SEARCH_I18N_KEYS.filtersOpen, { count: facets.activeFilters })}
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
                {t(SEARCH_I18N_KEYS.filtersApply)}
              </Button>
            }
          >
            {panel}
          </SkinDialog>
          {results}
        </>
      ) : showFilters ? (
        <Row gutter={[spacing[4], spacing[4]]}>
          <Col xs={24} md={7}>
            {panel}
          </Col>
          {/* ONE heading and ONE sort control. The page used to caption
              the toolbar "Results" and then mount a pane whose own heading
              says "Results" again — the live /s page printed both, one
              above the other. The pane owns the heading row; the page puts
              the sort control INTO it, and `resultsHeading` puts this
              surface's own word there rather than above it. */}
          <Col xs={24} md={17}>
            {results}
          </Col>
        </Row>
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
          {...(pageSize !== undefined ? { pageSize } : {})}
        />
      </SearchStateProvider>
    </SkinTheme>
  );
}
