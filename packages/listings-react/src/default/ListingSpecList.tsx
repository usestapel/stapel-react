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
import { formatSpecValue } from "../model/featureText.js";

/** The class one spec row carries. */
export const SPEC_ROW_CLASS = "stapel-listing-spec-row";
/** The class the row's inline label carries. */
export const SPEC_LABEL_CLASS = "stapel-listing-spec-label";
/** The `href` the hoisted spec stylesheet is deduplicated by. */
export const SPEC_STYLE_HREF = "stapel-listings-spec";

/**
 * The rules an inline style cannot express — the label's own colour is set
 * per-instance as a custom property so ONE hoisted copy serves either theme.
 *
 * `display: inline` on the label is the whole fix and is stated rather than
 * inherited: antd's `<Text>` renders a `<span>`, but a skin that retunes it
 * to a block would silently put the table back.
 */
export function specListCss(): string {
  return [
    // A paragraph, not a table row. `margin: 0` because the gap between rows
    // is the list's, so a row can be lifted into a grid cell unchanged.
    `.${SPEC_ROW_CLASS}{margin:0;min-inline-size:0;overflow-wrap:anywhere}`,
    `.${SPEC_LABEL_CLASS}{display:inline;color:var(--listing-spec-label)}`,
    // The one space between the question and the answer, owned by the label
    // rather than written as a text node — a `{" "}` between two JSX elements
    // is the kind of whitespace a formatter deletes.
    `.${SPEC_LABEL_CLASS}::after{content:"\\00a0"}`,
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
  readonly style?: CSSProperties;
}

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

  // A `header` is a section caption in a FORM, not a value: it has none, and
  // a spec table that printed one would print "not specified" under it.
  const rows = props.features.filter((feature) => featureType(feature) !== "header");

  return (
    <SkinTheme surface="bare">
      <style href={SPEC_STYLE_HREF} precedence="default">
        {specListCss()}
      </style>
      <div
        data-testid={props.testId ?? "listings-spec-list"}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing[1],
          minWidth: 0,
          ["--listing-spec-label" as string]: token.colorTextSecondary,
          ...props.style,
        }}
      >
        {rows.map((feature) => {
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
              <span data-testid={`listings-spec-value-${feature.slug}`}>{text}</span>
            </p>
          );
        })}
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
