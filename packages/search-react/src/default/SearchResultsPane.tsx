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
import type { ReactElement, ReactNode } from "react";
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

export interface SearchResultsPaneProps extends ThemeModeProp {
  /**
   * The card slot (spec §6.2 item 1). A storefront passes
   * `(item) => <ListingCard …/>`; omitted, the generic card renders.
   * Either way the `promoted` marking is the renderer's obligation and the
   * default honours it.
   */
  readonly renderCard?: SearchCardRenderer;
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
  const renderCard = props.renderCard;

  return (
    <SearchSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <SearchResults {...(props.enabled !== undefined ? { enabled: props.enabled } : {})}>
        {(bag) => (
          <Flex vertical gap={16}>
            <Flex justify="space-between" align="center" wrap gap={8}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {t(SEARCH_I18N_KEYS.resultsTitle)}
              </Typography.Title>
              <Count bag={bag} />
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
                <Flex vertical gap={12} data-testid="search-results">
                  {items.map((item: SearchItem) => (
                    <div key={item.key}>
                      {renderCard !== undefined ? (
                        renderCard(item)
                      ) : (
                        <SearchResultCard item={item} />
                      )}
                    </div>
                  ))}
                </Flex>
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
