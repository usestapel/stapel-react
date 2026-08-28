/**
 * `<SearchResultsPane>` — the antd result page: the count, the degradation
 * banner, the cards, and the keyset controls.
 *
 * Rendered through the shared substrate's `LoadList`, whose FOUR arms are the
 * point. "Nothing matches this search" is reachable only from a search that
 * actually ran; a 5xx renders "we could not run this search" plus a retry. The
 * substitution of one for the other is what cost the 2026-08-09 incident, and
 * the spec's §7.4 negative leg exercises this exact pane against a forced 5xx.
 *
 * The window refusal gets its own sentence. `error.400.search_window_exceeded`
 * is "narrow the search", not "there is nothing here" — it arrives as a 400
 * with an empty body, which is precisely how it would otherwise render as an
 * empty page.
 *
 * ── Two things the pager used to get wrong ────────────────────────────────
 *
 * 1. **Its reasons were in `title=`.** A disabled antd Button receives no
 *    pointer events, so the browser tooltip never fires — on any device — and
 *    a phone has no hover to begin with. Both buttons are `GatedButton` now:
 *    the block's reason is ordinary text beside the control and the button's
 *    `aria-describedby` points at it.
 * 2. **It rendered when there was nothing to page.** Two dead buttons under an
 *    empty state is the fleet's C-DEADPAGER defect; the pager now appears only
 *    when the answer actually has another page in some direction.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import { errorCode, useT, useTPlural } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { SearchItem } from "../api/types.js";
import { SearchResults } from "../headless/SearchResults.js";
import type { SearchResultsBag } from "../headless/SearchResults.js";
import { useScorerNames } from "../headless/useScorerNames.js";
import { SEARCH_WINDOW_EXCEEDED } from "../i18n/errorsMap.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { DegradationNotice } from "./DegradationNotice.js";
import type { DegradationNoticeVariant } from "./DegradationNotice.js";
import { SearchResultCard } from "./SearchResultCard.js";
import type { SearchCardRenderer } from "./SearchResultCard.js";
import type { SearchResultsLayout } from "./ViewSwitch.js";
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
 * The widest a column of results is allowed to get.
 *
 * Off the spacing scale and named for it: it is a MEASURE, the reading-width
 * decision every long page has to take. Without it the pane spread the full
 * width of whatever it was dropped into — the visual pass measured a 2560px
 * pane with four cards floating at the top of it and a status row 1350px from
 * the buttons that act on it (class C-NOMAXW).
 */
export const RESULTS_MAX_WIDTH = 1120;

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
  gap: spacing[3],
  alignItems: "stretch",
};

/**
 * The LIST arrangement: one wide row per result.
 *
 * The same grid with one track, deliberately — not a second layout mechanism.
 * A list is a grid whose column count is one, and expressing it that way is
 * what keeps the card slot, the gap and the stretch identical between the two
 * arrangements, so switching views cannot change anything except the number of
 * columns.
 */
const RESULTS_LIST: CSSProperties = {
  ...RESULTS_GRID,
  gridTemplateColumns: "1fr",
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
  /**
   * What this list is CALLED on this surface. Default: "Results".
   *
   * The pane owning the heading row is what stops a screen printing two
   * captions — but "Results" is only the right word when the person performed
   * a search. A landing's newest-first strip is "Fresh listings"; a seller's
   * page is "This seller's listings"; a category page's is the category. Every
   * one of those surfaces had written its own `<Title>` above the pane and got
   * the pane's "Results" underneath it a moment later — two headings, one
   * list, on the three busiest screens of the storefront.
   *
   * So the name comes IN, to the row that already exists, instead of being
   * printed a second time above it. Still exactly one heading either way.
   */
  readonly heading?: ReactNode;
  /** Rendered under the pager — where the container puts the ranking link. */
  readonly footer?: ReactNode;
  /**
   * How this surface says what the engine could not do (default `"banner"`).
   *
   * A catalogue page wants the warning box. A landing page showing six cards
   * under a hero has no room for one and passes `"inline"` or `"off"` — a
   * decision about THIS surface, not about whether the degradation matters.
   * Note that an `exact_total`-only degradation never raises a banner under
   * any variant: it is a count nuance the count itself already speaks as
   * "N+", not a failed search.
   */
  readonly degradationNotice?: DegradationNoticeVariant;
  readonly enabled?: boolean;
  /** Widest the column of results may grow (default {@link RESULTS_MAX_WIDTH});
   * `null` lets the container decide. */
  readonly maxWidth?: number | null;
  /**
   * How the loaded rows are arranged: as many card columns as fit
   * (`"grid"`, the default) or one wide row each (`"list"`). The view SWITCH
   * that flips this lives in `<ViewSwitch>`; the pane only draws.
   *
   * Ignored when `renderResults` replaces the arrangement entirely.
   */
  readonly layout?: SearchResultsLayout;
  /**
   * Heading level for the results caption. Default `4`, which is what every
   * surface that EMBEDS this pane under its own title needs.
   *
   * `<SearchPage>` passes `1`: on a results SCREEN the list's name is the
   * page's heading, and a page whose only heading is an `<h4>` has a document
   * outline that starts three levels down — the thing a screen reader's
   * heading list is for.
   */
  readonly headingLevel?: 1 | 2 | 3 | 4 | 5;
}

function Count(props: { bag: SearchResultsBag }): ReactElement | null {
  // A COUNTED sentence: `tPlural` asks Intl.PluralRules for the locale's
  // category, so Russian gets three different endings for 1, 3 and 17 instead
  // of the single one that was right for 5-20 and wrong everywhere else.
  const tPlural = useTPlural();
  const page = props.bag.page;
  if (page === null) return null;
  // No count line at all when the server cannot say. The alternative — some
  // number — is how "About 0 listings" ended up printed over four visible
  // cards: an unknown total rendered as a claim about the catalogue.
  if (page.countKind === "unknown" || page.count === null) return null;
  return (
    <Typography.Text
      type="secondary"
      data-testid="search-count"
      data-count-kind={page.countKind}
    >
      {page.countKind === "at_least"
        ? tPlural(SEARCH_I18N_KEYS.resultsCountAtLeast, { count: page.count })
        : tPlural(SEARCH_I18N_KEYS.resultsCountExact, { count: page.count })}
    </Typography.Text>
  );
}

/**
 * The keyset controls — rendered only when there IS another page.
 *
 * Keyset paging has no page numbers to jump to: there is a next, a previous,
 * and a server-side depth cap. When neither direction exists the pager is not
 * "disabled", it is absent — a control that can never do anything is not a
 * control that needs explaining.
 */
function Pager(props: { bag: SearchResultsBag }): ReactElement | null {
  const t = useT();
  const { page, prev, next, goPrev, goNext } = props.bag;
  if (page === null || (!page.hasNext && !page.hasPrev)) return null;
  return (
    <Flex gap={spacing[2]} justify="center" wrap data-testid="search-pager">
      <GatedButton
        gate={prev}
        onClick={goPrev}
        testId="search-prev"
        data-analytics="none"
        data-analytics-reason="keyset paging is a read, not a flow step"
      >
        {t(SEARCH_I18N_KEYS.resultsPrev)}
      </GatedButton>
      <GatedButton
        gate={next}
        onClick={goNext}
        testId="search-next"
        data-analytics="none"
        data-analytics-reason="keyset paging is a read, not a flow step"
      >
        {t(SEARCH_I18N_KEYS.resultsNext)}
      </GatedButton>
    </Flex>
  );
}

export function SearchResultsPane(props: SearchResultsPaneProps): ReactElement {
  const t = useT();
  const { renderCard, renderResults } = props;
  const scorerName = useScorerNames();
  const maxWidth = props.maxWidth === undefined ? RESULTS_MAX_WIDTH : props.maxWidth;

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      style={{
        width: "100%",
        ...(maxWidth !== null ? { maxWidth } : {}),
      }}
    >
      <SearchResults {...(props.enabled !== undefined ? { enabled: props.enabled } : {})}>
        {(bag) => (
          <Flex vertical gap={spacing[4]}>
            <Flex justify="space-between" align="center" wrap gap={spacing[2]}>
              <Typography.Title
                level={props.headingLevel ?? 4}
                style={{ margin: 0 }}
                data-testid="search-results-heading"
              >
                {props.heading ?? t(SEARCH_I18N_KEYS.resultsTitle)}
              </Typography.Title>
              <Flex align="center" wrap gap={spacing[3]}>
                <Count bag={bag} />
                {props.toolbar}
              </Flex>
            </Flex>

            <DegradationNotice
              degradations={bag.degradations}
              variant={props.degradationNotice ?? "banner"}
              scorerName={scorerName}
            />

            <LoadList
              state={bag.state}
              testId="search"
              skeletonRows={6}
              onRetry={bag.refetch}
              empty={
                <EmptyState
                  title={t(SEARCH_I18N_KEYS.resultsEmpty)}
                  testId="search-empty"
                />
              }
              failed={(error) => {
                // The window refusal is a DIFFERENT sentence from a failed
                // search, and both are different from "nothing found".
                const isWindow = errorCode(error) === SEARCH_WINDOW_EXCEEDED;
                return (
                  <ErrorAlert
                    testId={isWindow ? "search-window-exceeded" : "search-failed"}
                    thrown={error}
                    message={t(
                      isWindow
                        ? SEARCH_I18N_KEYS.resultsWindowExceeded
                        : SEARCH_I18N_KEYS.resultsLoadFailed
                    )}
                    retryLabel={t(SEARCH_I18N_KEYS.resultsRetry)}
                    onRetry={bag.refetch}
                  />
                );
              }}
            >
              {(items) => (
                <div data-testid="search-results">
                  {renderResults !== undefined ? (
                    renderResults(items)
                  ) : (
                    <div
                      style={props.layout === "list" ? RESULTS_LIST : RESULTS_GRID}
                      data-testid="search-results-grid"
                      data-layout={props.layout ?? "grid"}
                    >
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
              )}
            </LoadList>

            <Pager bag={bag} />
            {props.footer}
          </Flex>
        )}
      </SearchResults>
    </SkinTheme>
  );
}
