/**
 * `<SearchResultsPane>` — the antd result page: the count, the degradation
 * banner, the cards, and the keyset controls.
 *
 * Rendered through core's `matchList`, whose FOUR required arms are the point.
 * "Nothing matches this search" is reachable only from a search that actually
 * ran; a 5xx renders "we could not run this search" plus a retry. The
 * substitution of one for the other is what cost the 2026-08-09 incident, and
 * the spec's §7.4 negative leg exercises this exact pane against a forced 5xx.
 *
 * The window refusal gets its own sentence. `error.400.search_window_exceeded`
 * is "narrow the search", not "there is nothing here" — it arrives as a 400
 * with an empty body, which is precisely how it would otherwise render as an
 * empty page.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Empty, Flex, Spin, Typography } from "antd";
import {
  errorCode,
  matchList,
  toFlowError,
  useDescribeFlowError,
  useT,
  useTPlural,
} from "@stapel/core";
import type { SearchItem } from "../api/types.js";
import { SearchResults } from "../headless/SearchResults.js";
import type { SearchResultsBag } from "../headless/SearchResults.js";
import { SEARCH_WINDOW_EXCEEDED } from "../i18n/errorsMap.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { DegradationNotice } from "./DegradationNotice.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { SearchResultCard } from "./SearchResultCard.js";
import type { SearchCardRenderer } from "./SearchResultCard.js";
import { SearchSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

/**
 * The whole result LAYOUT, for a container that wants its own — a map beside
 * the list, a masonry wall, a table. It receives the loaded rows; the pane
 * still owns the four load arms around it, so "nothing found" and "we could
 * not run this search" stay the pane's sentences rather than the slot's
 * problem.
 */
export type SearchResultsRenderer = (
  items: readonly SearchItem[]
) => ReactNode;

/**
 * The results grid. `auto-fill` + `minmax(280px, 1fr)`: as many columns as fit,
 * each at least a readable card and never wider than its share — a catalogue
 * on a 1400px desktop is four columns, not four full-bleed rows, and the same
 * declaration collapses to one column on a phone with no breakpoint to
 * maintain. 280px is the width below which the default card's title, price and
 * location stop fitting on their own lines.
 */
const RESULTS_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 12,
  alignItems: "stretch",
};

export interface SearchResultsPaneProps extends ThemeModeProp {
  /**
   * The card slot (spec §6.2 item 1). A storefront passes
   * `(item) => <ListingCard …/>`; omitted, the generic card renders.
   * Either way the `promoted` marking is the renderer's obligation and the
   * default honours it.
   */
  readonly renderCard?: SearchCardRenderer;
  /**
   * The layout slot: replaces the grid entirely, `renderCard` and all. Use it
   * when the container's arrangement is not "cards in a grid".
   */
  readonly renderResults?: SearchResultsRenderer;
  /**
   * Rendered beside the count in the heading row — the sort control, a view
   * switch. The pane owns the heading, so a screen that composes it hands its
   * toolbar in here instead of printing a second caption above the pane.
   */
  readonly toolbar?: ReactNode;
  /** Rendered under the pager — where the container puts the ranking link. */
  readonly footer?: ReactNode;
  readonly enabled?: boolean;
}

function Count(props: { bag: SearchResultsBag }): ReactElement | null {
  // A COUNTED sentence: `tPlural` asks Intl.PluralRules for the locale's
  // category, so Russian gets three different endings for 1, 3 and 17 instead
  // of the single one that was right for 5-20 and wrong everywhere else.
  const tPlural = useTPlural();
  const page = props.bag.page;
  if (page === null) return null;
  return (
    <Typography.Text type="secondary" data-testid="search-count">
      {page.countIsEstimate
        ? tPlural(SEARCH_I18N_KEYS.resultsCountApproximate, {
            count: page.count,
          })
        : tPlural(SEARCH_I18N_KEYS.resultsCountExact, { count: page.count })}
    </Typography.Text>
  );
}

function Pager(props: { bag: SearchResultsBag }): ReactElement {
  const t = useT();
  const { prev, next, goPrev, goNext } = props.bag;
  return (
    <Flex gap={8} justify="center" data-testid="search-pager">
      <Button
        disabled={!prev.available}
        title={prev.available ? undefined : t(prev.block.code, prev.block.params)}
        onClick={goPrev}
        data-analytics="none"
        data-analytics-reason="keyset paging is a read, not a flow step"
        data-testid="search-prev"
      >
        {t(SEARCH_I18N_KEYS.resultsPrev)}
      </Button>
      <Button
        disabled={!next.available}
        title={next.available ? undefined : t(next.block.code, next.block.params)}
        onClick={goNext}
        data-analytics="none"
        data-analytics-reason="keyset paging is a read, not a flow step"
        data-testid="search-next"
      >
        {t(SEARCH_I18N_KEYS.resultsNext)}
      </Button>
    </Flex>
  );
}

export function SearchResultsPane(props: SearchResultsPaneProps): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const { renderCard, renderResults } = props;

  return (
    <SearchSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <SearchResults {...(props.enabled !== undefined ? { enabled: props.enabled } : {})}>
        {(bag) => (
          <Flex vertical gap={16}>
            <Flex justify="space-between" align="center" wrap gap={8}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {t(SEARCH_I18N_KEYS.resultsTitle)}
              </Typography.Title>
              <Flex align="center" wrap gap={12}>
                <Count bag={bag} />
                {props.toolbar}
              </Flex>
            </Flex>

            <DegradationNotice degradations={bag.degradations} />

            {matchList(bag.state, {
              loading: () => (
                <Flex justify="center" style={{ padding: 24 }}>
                  <Spin data-testid="search-loading" />
                </Flex>
              ),
              failed: (error) => {
                // The window refusal is a DIFFERENT sentence from a failed
                // search, and both are different from "nothing found".
                const isWindow = errorCode(error) === SEARCH_WINDOW_EXCEEDED;
                return (
                  <ErrorAlert
                    testId={isWindow ? "search-window-exceeded" : "search-failed"}
                    error={{
                      ...describe(toFlowError(error)),
                      message: t(
                        isWindow
                          ? SEARCH_I18N_KEYS.resultsWindowExceeded
                          : SEARCH_I18N_KEYS.resultsLoadFailed
                      ),
                    }}
                    action={
                      <Button
                        size="small"
                        onClick={bag.refetch}
                        data-analytics="none"
                        data-analytics-reason="retry of a failed read; no flow to step"
                      >
                        {t(SEARCH_I18N_KEYS.resultsRetry)}
                      </Button>
                    }
                  />
                );
              },
              empty: () => (
                <Empty
                  data-testid="search-empty"
                  description={t(SEARCH_I18N_KEYS.resultsEmpty)}
                />
              ),
              ready: (items) => (
                <div data-testid="search-results">
                  {renderResults !== undefined ? (
                    renderResults(items)
                  ) : (
                    <div style={RESULTS_GRID} data-testid="search-results-grid">
                      {items.map((item: SearchItem) => (
                        <div key={item.key}>
                          {renderCard !== undefined ? (
                            renderCard(item)
                          ) : (
                            <SearchResultCard item={item} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            })}

            <Pager bag={bag} />
            {props.footer}
          </Flex>
        )}
      </SearchResults>
    </SearchSkinTheme>
  );
}
