/**
 * `<PopularValues>` — the busiest values of one facet, printed as words a
 * person can click, above the results.
 *
 * A dictionary facet in the rail answers "narrow this list"; it does not
 * answer "what is IN this category". On a feed page of a cars leaf the second
 * question is the one a visitor arrives with, and its answer is already in the
 * envelope: `Toyota 802` is a bucket and its count. Printed as a multi-column
 * block it is a table of contents for the category — the eleven makes that
 * account for most of it, in one glance, each one a filter.
 *
 * ── What it is NOT ────────────────────────────────────────────────────────
 *
 * Not a replacement for the facet control: it shows the busy head of ONE
 * group and says so with a link into the whole thing (`onShowAll`). Not a
 * second source of counts either — the numbers are the answer's own
 * drill-down counts, the same ones the checkbox rows carry, so a value cannot
 * read `802` here and `93` in the panel.
 *
 * ── Hidden on a phone by a PROP ───────────────────────────────────────────
 *
 * `hidden` rather than a media query inside, because whether a 390px screen
 * has room for a block of forty links is a decision about the PAGE, and the
 * page is the storefront's. A component that hid itself below some width of
 * its own choosing would take that decision away from the only surface that
 * knows what else is on screen — and would still render the DOM, which is
 * what `display: none` costs a screen reader.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import {
  POINTER_FOCUS,
  POINTER_FOCUS_STYLE_HREF,
  pointerFocusCss,
} from "./focusRing.js";
import type { FacetGroup, FacetOption } from "../state/facets.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

/** How many values the block prints before the link into the full control. */
export const POPULAR_VALUES_LIMIT = 12;

/** How many columns the list flows into when a host names a number. Three
 * fills a desktop content column without turning a make into a two-line wrap. */
export const POPULAR_VALUES_COLUMNS = 3;

/**
 * The ceiling on columns a HOST may ask for.
 *
 * Past four a block whose width is fixed by its words stops being a table of
 * contents and becomes a grid of two-word cells: each column is one make and
 * one number, and a fifth column puts 60px of air between «Toyota 4» and the
 * next make. Four is where that density still reads as a list.
 *
 * It governs the numeric arm ONLY, and since 0.45 that is the whole of its
 * job. The responsive arm has no count to cap and needs none — see
 * {@link POPULAR_VALUE_COLUMN_WIDTH}: there the MEASURE is the ceiling, so a
 * column can never be narrower than a value and its count however many of them
 * the pane holds.
 */
export const POPULAR_VALUES_MAX_COLUMNS = 4;

/**
 * The minimum measure one column of this block needs, and the whole of the
 * responsive arm's layout input.
 *
 * `column-width` is a MINIMUM, not a width: the browser fits as many columns
 * of at least this measure as the element's own width allows and then widens
 * them to fill it. That is what makes the number a ceiling on density as well
 * as a floor on legibility — no pane, however wide, can produce a column
 * narrower than this.
 *
 * ── 150, and it is measured rather than reasoned ──────────────────────────
 *
 * It was 200, declared as the measure «Ford 1 204» needs. Swept in a real
 * browser over the live twelve makes and over a worst case of the longest make
 * on the stand with a four-digit count, at this gap:
 *
 *   200 → 4 columns in the storefront's 1088px pane, 3 rows
 *   170 → 4 columns, 3 rows
 *   160 → 4 columns, 3 rows
 *   150 → 6 columns, 2 rows
 *
 * 150 is the knee, and nothing wraps at it: because the browser widens the
 * columns to fill, the USED column is 155px in that pane and never below 152px
 * at any width swept. The old claim that a value wraps under its own number
 * below 200 does not hold at the default type step.
 */
export const POPULAR_VALUE_COLUMN_WIDTH = 150;

/**
 * The gutter between columns — one step up the scale from the row's own, so a
 * new column reads as a column rather than as a wrapped line.
 *
 * Exported because it is half of the arithmetic that decides how many columns
 * a pane produces (`floor((available + gap) / (width + gap))`), and a host
 * sizing a reservation for this block should not have to re-measure it.
 */
export const POPULAR_VALUES_COLUMN_GAP: number = spacing[6];

/** A value with no evidence behind it is not a popular value. Uncounted
 * options carry `count: null` and are dropped here rather than printed with a
 * blank where the number belongs — the block IS the numbers. */
function hasEvidence(option: FacetOption): boolean {
  return option.count !== null && option.count > 0;
}

/** The busiest values of the group, count-descending, capped. */
export function popularOptions(
  group: FacetGroup,
  limit: number = POPULAR_VALUES_LIMIT
): readonly FacetOption[] {
  return [...group.options.filter(hasEvidence)]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, limit);
}

/**
 * The columns box, in its two arms.
 *
 * ── The responsive arm: a block, and a MEASURE ────────────────────────────
 *
 * `column-width` asks the element's own width how many columns fit. That is
 * the whole mechanism — no container query, no rungs, no hoisted sheet, and no
 * number that has to be kept in step with a layout this component cannot see.
 * It is also what the expanded band next door already does, so the two arms of
 * one control stop answering "how many columns" two different ways.
 *
 * What it replaced was a container-query ladder whose rungs were the token
 * WINDOW breakpoints — and this block is the window less a 280px rail less the
 * gap, so at 1440 it is 1088px wide and the rung that grants a fourth column
 * (1200px) could never fire. The ladder's own doc argued that a media query
 * would be wrong here for precisely that reason, and then used the window's
 * numbers to measure the container.
 *
 * `inline-size: fit-content` is deliberately NOT here, and its absence is
 * load-bearing twice over. It sized the box to its words — 377px of a 1088px
 * pane on the live storefront, 711px of white beside twelve values stacked
 * four deep — and it is measurably incompatible with a column measure: set
 * together, the box collapses to a single column. The defect `fit-content` was
 * added for (three ~360px columns each holding «Chery 5») cannot arise here,
 * because a column is never wider than the pane divided by however many
 * {@link POPULAR_VALUE_COLUMN_WIDTH} fit in it.
 *
 * `column-fill: balance` spreads the rows evenly over the columns the width
 * produces, rather than filling the first column to the box's block-size.
 *
 * ── The numeric arm: unchanged, words-wide ────────────────────────────────
 *
 * A host that names a number has decided its own layout, and a count divides
 * the container — so three columns of a box handed the whole results pane are
 * three ~360px columns holding «Chery 5», a make and then 300px of nothing.
 * `fit-content` is the cure there and stays: the box takes its natural measure
 * (`columns × widest item + gaps`) unless the space is smaller, in which case
 * the columns shrink rather than overflow.
 */
function COLUMNS(count: number | undefined): CSSProperties {
  if (count === undefined) {
    return {
      columnWidth: POPULAR_VALUE_COLUMN_WIDTH,
      columnGap: POPULAR_VALUES_COLUMN_GAP,
      columnFill: "balance",
    };
  }
  return {
    columnCount: count,
    columnGap: POPULAR_VALUES_COLUMN_GAP,
    inlineSize: "fit-content",
    maxInlineSize: "100%",
  };
}

const ROW: CSSProperties = {
  // `break-inside` keeps a value and its count on one line when the browser
  // decides where the column ends.
  breakInside: "avoid",
  display: "flex",
  gap: spacing[2],
  alignItems: "baseline",
};

export interface PopularValuesProps {
  /** The group to print — normally the first `ref_select` of the plan. */
  readonly group: FacetGroup;
  /** Apply one value. Same signature as the panel's `toggle`, so a host can
   * hand the facet bag's own function straight in. */
  readonly onApply: (slug: string, value: string) => void;
  /** Draw nothing. The phone, decided by the page — see the module note. */
  readonly hidden?: boolean;
  /** How many values. Default {@link POPULAR_VALUES_LIMIT}. */
  readonly limit?: number;
  /**
   * How many columns. Default {@link POPULAR_VALUES_COLUMNS}.
   *
   * `"responsive"` hands the question to the ELEMENT: native multicol over
   * {@link POPULAR_VALUE_COLUMN_WIDTH} fits as many columns as this block's own
   * width allows, at every width, with no rungs to keep in step with a layout
   * this component cannot see. The numeric form stays, and stays the default:
   * a host that has already decided its layout should not have that decision
   * taken back.
   */
  readonly columns?: number | "responsive";
  /** The block's heading. Defaults to the group's own label; `null` draws
   * none, for a surface that has already named the axis. */
  readonly heading?: ReactNode;
  /** Open the full control. Absent draws no link — a link that goes nowhere
   * is worse than a block that stops. */
  readonly onShowAll?: () => void;
}

export function PopularValues(props: PopularValuesProps): ReactElement | null {
  const t = useT();
  const { group } = props;
  if (props.hidden === true) return null;
  const options = popularOptions(group, props.limit ?? POPULAR_VALUES_LIMIT);
  if (options.length === 0) return null;

  const responsive = props.columns === "responsive";

  return (
    <Flex
      vertical
      gap={spacing[2]}
      data-testid={`popular-values-${group.slug}`}
      data-label-source={group.labelSource}
      data-columns={responsive ? "responsive" : String(props.columns ?? POPULAR_VALUES_COLUMNS)}
    >
      {/* The ring the keyboard gets and the mouse does not. */}
      <style href={POINTER_FOCUS_STYLE_HREF} precedence="default">
        {pointerFocusCss()}
      </style>
      {props.heading !== null && (
        <Typography.Text strong>{props.heading ?? group.label}</Typography.Text>
      )}
      <div
        data-testid={`popular-columns-${group.slug}`}
        style={COLUMNS(
          responsive
            ? undefined
            : Math.min(
                props.columns ?? POPULAR_VALUES_COLUMNS,
                POPULAR_VALUES_MAX_COLUMNS
              )
        )}
      >
        {options.map((option) => (
          <div key={option.value} style={ROW}>
            <Button
              type="link"
              size="small"
              {...POINTER_FOCUS}
              style={{ paddingInline: 0, height: "auto" }}
              data-testid={`popular-value-${group.slug}-${option.value}`}
              data-analytics="none"
              data-analytics-reason="a filter is a read, not a flow step"
              onClick={() => {
                props.onApply(group.slug, option.value);
              }}
            >
              {option.label}
            </Button>
            <Typography.Text
              type="secondary"
              data-testid={`popular-count-${group.slug}-${option.value}`}
            >
              {option.count}
            </Typography.Text>
          </div>
        ))}
      </div>
      {props.onShowAll !== undefined && (
        <Button
          type="link"
          size="small"
          {...POINTER_FOCUS}
          style={{ alignSelf: "flex-start", paddingInline: 0 }}
          data-testid={`popular-all-${group.slug}`}
          data-analytics="none"
          data-analytics-reason="opening a filter control is a read, not a flow step"
          onClick={props.onShowAll}
        >
          {t(SEARCH_I18N_KEYS.facetsPopularAll)}
        </Button>
      )}
    </Flex>
  );
}
