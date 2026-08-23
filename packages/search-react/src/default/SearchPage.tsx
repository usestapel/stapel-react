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
 * The three seams a storefront fills (spec §6.2 items 1–3): `renderCard`
 * (a `<ListingCard>`), `categoryFeatures` (from categories-react, for facet
 * labels), and `footer` (the container's own chrome). None of them is
 * optional behaviour in disguise — every one has a working default.
 */
import type { ReactElement, ReactNode } from "react";
import { Col, Flex, Row } from "antd";
import type { FeatureDef } from "@stapel/attributes-react";
import { SearchStateProvider } from "../headless/SearchStateProvider.js";
import type { SearchParamsAdapter } from "../headless/SearchStateProvider.js";
import type { ParseSearchStateOptions } from "../state/urlState.js";
import { FacetPanelPane } from "./FacetPanelPane.js";
import { SearchResultsPane } from "./SearchResultsPane.js";
import { SortSelect } from "./SortSelect.js";
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
}

export function SearchPage(props: SearchPageProps): ReactElement {
  const {
    adapter,
    renderCard,
    categoryFeatures,
    locale,
    footer,
    mode,
    ...parseOptions
  } = props;

  return (
    <SearchSkinTheme {...(mode !== undefined ? { mode } : {})}>
      <SearchStateProvider adapter={adapter} {...parseOptions}>
        <Flex vertical gap={16} data-testid="search-page">
          <UrlIssueNotice />
          <Row gutter={[16, 16]}>
            <Col xs={24} md={7}>
              <FacetPanelPane
                {...(categoryFeatures !== undefined ? { categoryFeatures } : {})}
                {...(locale !== undefined ? { locale } : {})}
              />
            </Col>
            <Col xs={24} md={17}>
              {/* ONE heading and ONE sort control. The page used to caption
                  the toolbar "Results" and then mount a pane whose own heading
                  says "Results" again — the live /s page printed both, one
                  above the other. The pane owns the heading row; the page puts
                  the sort control INTO it. */}
              <SearchResultsPane
                toolbar={<SortSelect />}
                {...(renderCard !== undefined ? { renderCard } : {})}
                {...(footer !== undefined ? { footer } : {})}
              />
            </Col>
          </Row>
        </Flex>
      </SearchStateProvider>
    </SearchSkinTheme>
  );
}
