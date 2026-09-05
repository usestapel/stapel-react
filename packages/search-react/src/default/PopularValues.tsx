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
import { breakpoints, spacing } from "@stapel/tokens";
import type { FacetGroup, FacetOption } from "../state/facets.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

/** How many values the block prints before the link into the full control. */
export const POPULAR_VALUES_LIMIT = 12;

/** How many columns the list flows into. Three fills a desktop content column
 * without turning a make into a two-line wrap. */
export const POPULAR_VALUES_COLUMNS = 3;

/**
 * The width one column of this block needs: a make and its count, on one line,
 * at the default type step. «Ford 1 204» is the measure; below it a value
 * wraps under its own number and the block stops being scannable.
 */
export const POPULAR_VALUE_COLUMN_WIDTH = 200;

/** The class the container query is hung on. */
export const POPULAR_VALUES_CLASS = "stapel-popular-values";

/** The `href` the hoisted ladder sheet is deduplicated by (React 19). */
export const POPULAR_VALUES_STYLE_HREF = "stapel-popular-values";

/**
 * The ladder `columns="responsive"` climbs — one rung per column, by the width
 * of the BLOCK rather than of the window.
 *
 * The container is what decides, and it has to be: this block sits in the
 * results column, which on a 1440px desktop is the window minus a 280px rail
 * minus the gap. A media query would give it four columns at a width it never
 * has, and one column inside a narrow host container that happens to sit on a
 * wide screen. `container-type: inline-size` plus `@container` asks the only
 * question that has an answer here — how wide is this block.
 *
 * The rungs: one column while the block is narrower than two of
 * {@link POPULAR_VALUE_COLUMN_WIDTH}, then the two token breakpoints for the
 * third and fourth. `tablet` and `desktop` are `@stapel/tokens`' own numbers,
 * and using them here is the same statement they make everywhere else — this
 * is where a layout of this density gains a column.
 */
export const POPULAR_VALUES_LADDER: readonly {
  readonly minInlineSize: number;
  readonly columns: number;
}[] = [
  { minInlineSize: POPULAR_VALUE_COLUMN_WIDTH * 2, columns: 2 },
  { minInlineSize: breakpoints.tablet, columns: 3 },
  { minInlineSize: breakpoints.desktop, columns: 4 },
];

/**
 * The ladder as CSS. One `@container` rule per rung, ascending, so the widest
 * matching rung is the one that wins by ordinary cascade order.
 *
 * Emitted as a hoisted `<style>` rather than an inline style because a
 * container query is unreachable from one — the same reason `<SearchPage>`
 * hoists its rail sheet.
 */
export function popularValuesLadderCss(): string {
  const block = `.${POPULAR_VALUES_CLASS}`;
  return [
    `${block}{container-type:inline-size}`,
    `${block}>[data-popular-columns]{column-count:1}`,
    ...POPULAR_VALUES_LADDER.map(
      (rung) =>
        `@container (min-width: ${String(rung.minInlineSize)}px)` +
        `{${block}>[data-popular-columns]{column-count:${String(rung.columns)}}}`
    ),
  ].join("\n");
}

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
   * `"responsive"` climbs {@link POPULAR_VALUES_LADDER} by the width of the
   * BLOCK — 1, 2, 3, 4 — instead of taking one number for every surface. The
   * numeric form stays, and stays the default: a host that has already decided
   * its layout should not have that decision taken back by a query.
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
      {...(responsive ? { className: POPULAR_VALUES_CLASS } : {})}
      data-testid={`popular-values-${group.slug}`}
      data-label-source={group.labelSource}
      data-columns={responsive ? "responsive" : String(props.columns ?? POPULAR_VALUES_COLUMNS)}
    >
      {/* The ladder, hoisted and deduped by `href`: a container query has no
          inline form. Only where it is asked for — a block with a fixed
          column count needs no sheet at all. */}
      {responsive && (
        <style href={POPULAR_VALUES_STYLE_HREF} precedence="default">
          {popularValuesLadderCss()}
        </style>
      )}
      {props.heading !== null && (
        <Typography.Text strong>{props.heading ?? group.label}</Typography.Text>
      )}
      <div
        {...(responsive ? { "data-popular-columns": "" } : {})}
        style={{
          // The rungs live in the sheet above; an inline `column-count` here
          // would win against every one of them.
          ...(responsive
            ? {}
            : { columnCount: props.columns ?? POPULAR_VALUES_COLUMNS }),
          columnGap: spacing[4],
        }}
      >
        {options.map((option) => (
          <div key={option.value} style={ROW}>
            <Button
              type="link"
              size="small"
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
