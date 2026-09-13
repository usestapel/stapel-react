/**
 * The listing page's spec rows ("Characteristics"), as SENTENCES.
 *
 * ── What was on screen, and why a table was the wrong shape ───────────────
 *
 * The list was `<Descriptions column={1}>`: a real two-column table, label
 * cell beside value cell. On a phone — and in the split layout's half-width
 * left column — the value cell is narrow, so a long answer ("Trim level",
 * a full trim name, a two-line address) wrapped INSIDE it and stacked under
 * itself in a column a third of the page wide, beside acres of empty label
 * gutter. A spec row is not tabular data that a reader scans down one axis;
 * it is a short question and its answer, and it reads as a line of text.
 *
 * So the label is an inline `<span>`, muted, and the value follows it in the
 * SAME text flow. A long value now wraps as a paragraph — full measure,
 * hanging under the label — and a short one costs one line instead of a row
 * of a table.
 *
 * ── The two-column grid that survives is a grid of ROWS ───────────────────
 *
 * The split layout still puts two columns of spec rows side by side on a wide
 * screen, because a forty-row list under a photograph is a scroll nobody
 * finishes. What is gone is the label being its own COLUMN: the columns hold
 * whole rows, cut by row count so the category's declaration order still
 * reads top-to-bottom, left column first. `<ListingSpecColumns>` is that cut,
 * kept here beside the row it cuts.
 *
 * ── Units and digits ─────────────────────────────────────────────────────
 *
 * Every value goes through `formatSpecValue` rather than the shared
 * `formatFeatureValue`: same answer, typeset — the unit appended and the
 * digits grouped by the reader's locale. `model/featureText.ts` says where
 * the unit comes from and why there is no `unit` key to read it from.
 */
import { useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Typography, theme as antdTheme } from "antd";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { useI18n, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import {
  ATTRIBUTES_I18N_KEYS,
  featureName,
  featureType,
  isRedactedValue,
  isValuePresent,
  isValueVerified,
} from "@stapel/attributes-react";
import type { FeatureDef, FeatureValueDto } from "@stapel/attributes-react";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { formatSpecValue } from "../model/featureText.js";

/** The class the list itself carries — the grid the rows are laid into. */
export const SPEC_LIST_CLASS = "stapel-listing-spec-list";
/** The class one spec row carries. */
export const SPEC_ROW_CLASS = "stapel-listing-spec-row";
/** The class the row's label carries. */
export const SPEC_LABEL_CLASS = "stapel-listing-spec-label";
/** The class the row's value carries. */
export const SPEC_VALUE_CLASS = "stapel-listing-spec-value";
/** The class the fold's control carries, so it can cross both columns. */
export const SPEC_FOOT_CLASS = "stapel-listing-spec-foot";
/** The `href` the hoisted spec stylesheet is deduplicated by. */
export const SPEC_STYLE_HREF = "stapel-listings-spec";

/** The gutter between a label and its answer. */
const SPEC_COLUMN_GAP: number = spacing[3];
/** The gap between two characteristics. */
const SPEC_ROW_GAP: number = spacing[1];

/**
 * THE LIST IS A GRID OF TWO COLUMNS, and the row dissolves into it.
 *
 * ── Why not the paragraph this replaced ─────────────────────────
 *
 * The row WAS a paragraph: a muted label, one non-breaking space drawn by the
 * label's `::after`, then the value in the same text flow. That shape was
 * adopted against a real defect and fixed it — antd's `<Descriptions>` gave
 * the value a cell a third of the page wide, in which a long answer wrapped
 * under itself beside acres of empty label gutter. What it produced instead
 * is the defect the reviewers measured at 390 / 768 / 1024 / 1440 in both
 * themes: with the label INLINE, every value starts wherever the label before
 * it happened to end, so fifteen characteristics read as fifteen sentences of
 * prose and there is no column for an eye to run down.
 *
 * ── Why this grid is not the table coming back ────────────────────
 *
 * The tracks are the whole argument. `minmax(0, max-content)` for the LABEL:
 * the column is exactly as wide as the longest label in this list and not one
 * pixel more — it is not a reserved third of the page, and under pressure it
 * may shrink below its content rather than push the answers off the page.
 * `minmax(0, 1fr)` for the VALUE: every pixel that is left. So a long answer
 * has MORE measure than it had as the second half of a paragraph, while the
 * answers line up. Both findings hold at once, which is why this is one rule
 * and not a width per breakpoint.
 *
 * `display: contents` on the ROW is the mechanism. A column can only be
 * shared by every row if the labels and the values are children of the same
 * grid; the row element stays in the DOM — it is what "one characteristic"
 * means to a reader, to the fold's count and to a test — and lays out nothing
 * of its own. The separator goes with it: a column gap and a non-breaking
 * space would be a double gutter, and the space is what made it prose.
 *
 * The label's own colour is set per-instance as a custom property so ONE
 * hoisted copy of this sheet serves either theme.
 */
export function specListCss(): string {
  return [
    `.${SPEC_LIST_CLASS}{display:grid;` +
      `grid-template-columns:minmax(0,max-content) minmax(0,1fr);` +
      `column-gap:${String(SPEC_COLUMN_GAP)}px;row-gap:${String(SPEC_ROW_GAP)}px;` +
      `align-items:baseline;min-inline-size:0}`,
    // The row keeps its element and lays out nothing: its label and its value
    // are the grid's own items. `margin: 0` for the `<p>` it still is on an
    // engine that does not honour `display: contents`.
    `.${SPEC_ROW_CLASS}{display:contents;margin:0}`,
    `.${SPEC_LABEL_CLASS}{color:var(--listing-spec-label)}`,
    // A value is the one thing here that can be longer than its column: a
    // stored code, a URL, a long compound word. It wraps inside its own track
    // rather than widening the grid.
    `.${SPEC_VALUE_CLASS}{min-inline-size:0;overflow-wrap:anywhere}`,
    // The fold's control is a row of its own, not a third column.
    `.${SPEC_FOOT_CLASS}{grid-column:1/-1}`,
  ].join("");
}

export interface ListingSpecListProps {
  /** The category's features, in the order they are declared. */
  readonly features: readonly FeatureDef[];
  /** The DISPLAY envelope — redacted stubs included, which is what makes a
   * withheld row keep its place. */
  readonly values: Readonly<Record<string, FeatureValueDto>>;
  /** The surface's own test id, so a split page holding two columns of these
   * does not hand a test two elements under one name. */
  readonly testId?: string;
  /**
   * HOW MANY ROWS STAND BEFORE THE FOLD. Default: all of them.
   *
   * This is a PRESENTATION limit and nothing else — it hides no field from
   * anybody, because the control under the list opens the rest in place and
   * every row is in the accessibility tree once it is open. The reference
   * classified folds at about eighteen and calls the control "all
   * characteristics"; the argument is the same one the description has, that
   * a forty-row list under a photograph on a 390px phone is four screens
   * between the price and the seller.
   *
   * It is a PROP and not a default, because the fold is a decision about a
   * VIEWPORT and this package does not read viewports (see the pane's
   * `layout` / `galleryLayout`): a desktop split column with two columns of
   * rows wants none of it.
   *
   * The stated limit is honoured only when it actually saves something: a
   * list of eleven with a limit of ten draws all eleven rather than a fold
   * that hides one row behind a button as tall as the row.
   */
  readonly limit?: number;
  readonly style?: CSSProperties;
}

/** How many rows a fold has to hide before it is worth one. See
 * {@link ListingSpecListProps.limit}. */
export const SPEC_FOLD_MIN_HIDDEN = 2;

/**
 * A withheld value's row: what the system OBSERVED, and nothing more — the
 * same three states `@stapel/attributes-react` prints, said with its own
 * copy keys so the two lists cannot drift into two different sentences.
 */
function redactedText(dto: FeatureValueDto | undefined, t: (key: string) => string): string {
  if (!isValuePresent(dto)) return t(ATTRIBUTES_I18N_KEYS.valueNotSet);
  if (isValueVerified(dto)) return t(ATTRIBUTES_I18N_KEYS.valueVerified);
  return t(ATTRIBUTES_I18N_KEYS.valueProvided);
}

export function ListingSpecList(props: ListingSpecListProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const { token } = antdTheme.useToken();

  const [open, setOpen] = useState(false);

  // A `header` is a section caption in a FORM, not a value: it has none, and
  // a spec table that printed one would print "not specified" under it.
  const rows = props.features.filter((feature) => featureType(feature) !== "header");

  /* THE FOLD, and it folds nothing it cannot save two rows by folding. The
     limit is counted over the rows that are actually DRAWN, not over the
     features handed in — a category whose declaration ends in three form
     headers would otherwise fold a list that is already short. */
  const limit = props.limit ?? Number.POSITIVE_INFINITY;
  const folded =
    !open && rows.length - limit >= SPEC_FOLD_MIN_HIDDEN
      ? rows.slice(0, limit)
      : rows;

  return (
    <SkinTheme surface="bare">
      <style href={SPEC_STYLE_HREF} precedence="default">
        {specListCss()}
      </style>
      <div
        className={SPEC_LIST_CLASS}
        data-testid={props.testId ?? "listings-spec-list"}
        style={{
          // The label's colour, per instance: one hoisted sheet, either theme.
          ["--listing-spec-label" as string]: token.colorTextSecondary,
          ...props.style,
        }}
      >
        {folded.map((feature) => {
          const dto = props.values[feature.slug];
          const redacted = isRedactedValue(dto);
          const text = redacted
            ? redactedText(dto, t)
            : (formatSpecValue(feature, dto, { t, locale }) ??
              t(
                dto === undefined || featureType(feature) === undefined
                  ? ATTRIBUTES_I18N_KEYS.valueNotSet
                  : ATTRIBUTES_I18N_KEYS.valueUnreadable
              ));
          return (
            <p
              key={feature.slug}
              className={SPEC_ROW_CLASS}
              data-testid={`listings-spec-row-${feature.slug}`}
            >
              <Typography.Text
                type="secondary"
                className={SPEC_LABEL_CLASS}
                data-testid={`listings-spec-label-${feature.slug}`}
              >
                {featureName(feature)}
              </Typography.Text>
              <span
                className={SPEC_VALUE_CLASS}
                data-testid={`listings-spec-value-${feature.slug}`}
              >
                {text}
              </span>
            </p>
          );
        })}
        {/* `aria-expanded` rather than a second sentence: the control IS the
            state, and a person using a screen reader is told the list opened
            without the list announcing itself. It disappears once open —
            there is no "show less", because a reader who opened forty rows
            scrolls past them and does not scroll back up to close them. */}
        {folded.length === rows.length ? null : (
          <Typography.Link
            role="button"
            className={SPEC_FOOT_CLASS}
            aria-expanded={false}
            data-testid={`${props.testId ?? "listings-spec-list"}-show-all`}
            data-analytics="none"
            data-analytics-reason="a look, not an outcome — unfolding a list changes no record"
            onClick={() => {
              setOpen(true);
            }}
          >
            {t(LISTINGS_I18N_KEYS.detailShowAll)}
          </Typography.Link>
        )}
      </div>
    </SkinTheme>
  );
}

/**
 * The same rows in TWO columns on a wide screen — a grid of whole rows, cut
 * by row count so the category's declaration order still reads top-to-bottom,
 * left column first.
 *
 * The cut is here rather than inside the list because a CSS `columns` rule
 * would break a wrapped paragraph across the column boundary, which is
 * exactly the defect the paragraph shape was adopted to avoid.
 *
 * `limit` is accepted (one props type) and deliberately NOT forwarded: a fold
 * applied to each half would hide the same count twice and leave two "show
 * all" controls that open different halves of one list. The two-column arm is
 * the wide screen, which is the arm the fold exists to spare.
 */
export function ListingSpecColumns(props: ListingSpecListProps): ReactElement {
  const half = Math.ceil(props.features.length / 2);
  return (
    <div
      data-testid={props.testId ?? "listings-detail-specs-split"}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: spacing[4],
        alignItems: "start",
      }}
    >
      <ListingSpecList
        features={props.features.slice(0, half)}
        values={props.values}
        testId="listings-spec-list"
      />
      {props.features.length > half ? (
        <ListingSpecList
          features={props.features.slice(half)}
          values={props.values}
          testId="listings-spec-list-second"
        />
      ) : null}
    </div>
  );
}
