/**
 * `<SearchPage>` — the composed screen the nav manifest points at: filters on
 * the left, sort and results on the right, the ranking link in the footer.
 *
 * It composes the two panes and owns NO state of its own. The URL is the
 * state, and it arrives through the `adapter` prop — which is where a host
 * hands in `useRouterSearchParams()` from `@stapel/search-react/router`, or
 * its own binding. The page does not reach for a router, so the same
 * component renders under react-router, under a Next.js app router, and in a
 * test with a plain `URLSearchParams`.
 *
 * The seams a storefront fills: `renderCard` (a `<ListingCard>`),
 * `categoryFeatures` (from categories-react, for facet labels), `footer` (the
 * container's own chrome), `filtersHeader` (a control this pair does not ship
 * — a geo centre, say) and `resultsHeading` (what THIS surface calls its
 * list). None of them is optional behaviour in disguise — every one has a
 * working default.
 *
 * ── The filter column is laid out only when there is something in it ───────
 *
 * `Col md={7}` was unconditional, and on a deployment whose search plan
 * declares no facets that spent a quarter of every results page — `/s`, every
 * category page, every seller page — on an empty-state illustration saying
 * "no filters for this search". Saying it once is honest; reserving a column
 * for it on every screen is not a message, it is a hole. The page asks the
 * facet bag what it has (`useFacetPanel`) and gives the results the whole
 * width when the answer is nothing AND the host put nothing in
 * `filtersHeader`. Note which way the test runs: the column stays for
 * `loading` and for `failed`, because a panel that has not answered yet is not
 * a panel with nothing in it, and a layout that reflowed underneath a person
 * mid-load would be worse than the hole.
 */
import type { ReactElement, ReactNode } from "react";
import { Col, Flex, Row } from "antd";
import type { FeatureDef } from "@stapel/attributes-react";
import { SearchStateProvider } from "../headless/SearchStateProvider.js";
import type { SearchParamsAdapter } from "../headless/SearchStateProvider.js";
import { useFacetPanel } from "../headless/FacetPanel.js";
import type { ParseSearchStateOptions } from "../state/urlState.js";
import { FacetPanelPane } from "./FacetPanelPane.js";
import { SearchResultsPane } from "./SearchResultsPane.js";
import { SortSelect } from "./SortSelect.js";
import type { DegradationNoticeVariant } from "./DegradationNotice.js";
import type { SearchCardRenderer } from "./SearchResultCard.js";
import { SearchSkinTheme } from "./theme.js";
import { UrlIssueNotice } from "./UrlIssueNotice.js";
import type { ThemeModeProp } from "./types.js";

export interface SearchPageProps extends ThemeModeProp, ParseSearchStateOptions {
  /** The URL binding. `useRouterSearchParams()` from `./router` is the
   * react-router one. */
  readonly adapter: SearchParamsAdapter;
  readonly renderCard?: SearchCardRenderer;
  readonly categoryFeatures?: readonly FeatureDef[];
  readonly locale?: string;
  /** Container chrome under the results — e.g. the ranking-disclosure link. */
  readonly footer?: ReactNode;
  /**
   * Rendered at the TOP of the filter column, above the facets.
   *
   * The slot exists for a filter this pair cannot ship: the obvious one is a
   * geo centre. `SearchQueryState` has carried `geo` since 0.2 and
   * `<SortSelect>` already disables "by distance" with the reason "no centre
   * set" — but nothing in this pair could ever SET one, because turning an
   * address into a coordinate needs a geocoder and a geocoder is the
   * deployment's. Whatever a host renders here reads and writes the same URL
   * state as the facets beside it (`useSearchState().setGeo`), so it is a
   * filter in every sense that matters and not a decoration bolted on top.
   */
  readonly filtersHeader?: ReactNode;
  /** What this surface calls its result list. See
   * {@link SearchResultsPaneProps.heading}. */
  readonly resultsHeading?: ReactNode;
  /** How the results surface says what the engine could not do (default
   * `"banner"`). Handed straight to `<SearchResultsPane>`. */
  readonly degradationNotice?: DegradationNoticeVariant;
}

/**
 * The two columns, inside the state provider — which is where they have to be,
 * because the layout decision reads the same search the panes read.
 */
interface SearchPageBodyProps {
  readonly renderCard?: SearchCardRenderer;
  readonly categoryFeatures?: readonly FeatureDef[];
  readonly locale?: string;
  readonly footer?: ReactNode;
  readonly filtersHeader?: ReactNode;
  readonly resultsHeading?: ReactNode;
  readonly degradationNotice?: DegradationNoticeVariant;
}

function SearchPageBody(props: SearchPageBodyProps): ReactElement {
  const { categoryFeatures, locale, filtersHeader } = props;
  const facets = useFacetPanel({
    ...(categoryFeatures !== undefined ? { categoryFeatures } : {}),
    ...(locale !== undefined ? { locale } : {}),
  });
  // "Nothing to filter by" is a LOADED answer of zero groups, and only that —
  // see the header. `loading` and `failed` keep the column, because a panel
  // that has not answered yet is not a panel with nothing in it. An active
  // filter holds it open too: a person who has chosen something must be able
  // to un-choose it.
  const filtersEmpty =
    facets.state.status === "ready" &&
    facets.state.data.length === 0 &&
    facets.activeFilters === 0;
  const showFilters = filtersHeader !== undefined || !filtersEmpty;

  const results = (
    <SearchResultsPane
      toolbar={<SortSelect />}
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
    <Flex vertical gap={16} data-testid="search-page" data-filters={showFilters ? "on" : "off"}>
      <UrlIssueNotice />
      {showFilters ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={7}>
            <Flex vertical gap={16}>
              {filtersHeader}
              {/* The facet panel is skipped entirely when the only thing it
                  would draw is its own empty state and the column is open for
                  the host's control alone — one empty-state illustration under
                  a working filter is still a hole, just a smaller one. */}
              {filtersEmpty ? null : (
                <FacetPanelPane
                  {...(categoryFeatures !== undefined ? { categoryFeatures } : {})}
                  {...(locale !== undefined ? { locale } : {})}
                />
              )}
            </Flex>
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
    footer,
    filtersHeader,
    resultsHeading,
    degradationNotice,
    mode,
    ...parseOptions
  } = props;

  return (
    <SearchSkinTheme {...(mode !== undefined ? { mode } : {})}>
      <SearchStateProvider adapter={adapter} {...parseOptions}>
        <SearchPageBody
          {...(renderCard !== undefined ? { renderCard } : {})}
          {...(categoryFeatures !== undefined ? { categoryFeatures } : {})}
          {...(locale !== undefined ? { locale } : {})}
          {...(footer !== undefined ? { footer } : {})}
          {...(filtersHeader !== undefined ? { filtersHeader } : {})}
          {...(resultsHeading !== undefined ? { resultsHeading } : {})}
          {...(degradationNotice !== undefined ? { degradationNotice } : {})}
        />
      </SearchStateProvider>
    </SearchSkinTheme>
  );
}
