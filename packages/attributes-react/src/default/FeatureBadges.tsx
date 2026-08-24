/**
 * The DISPLAY half — `<FeatureBadges/>` for a card, `<FeatureValueList/>` for
 * a detail page. Both are renderers over `formatFeatureValue`; neither
 * re-implements a single type's formatting.
 *
 * Two rules they hold that a naive spec table does not:
 *
 *  - **An unreadable value says so.** A type this build cannot format renders
 *    a named notice, not an empty cell — the display twin of the unsupported
 *    editor. A blank cell where a spec line belongs reads as "this listing
 *    has no engine size", which is a different and false statement.
 *  - **`show_as_badge` / `show_at_title` are the CATEGORY's decision**, made
 *    by whoever configured the feature, and this component honours it instead
 *    of picking its own first three values.
 */
import type { ReactElement } from "react";
import { Descriptions, Flex, Tag, Typography } from "antd";
import { useI18n, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { FeatureDef, FeaturesDto } from "../types.js";
import { featureName, featureType } from "../types.js";
import { formatFeatureValue, hexColorSwatch } from "../format.js";
import { ATTRIBUTES_I18N_KEYS } from "../i18n/keys.js";

export interface FeatureDisplayProps {
  readonly features: readonly FeatureDef[];
  /** The stored values, in the same `{slug: {type, value}}` envelope the
   * composer submitted. */
  readonly values: FeaturesDto;
}

/** Feature + its formatted value, in the order the category declared. */
function useRows(
  props: FeatureDisplayProps,
  only?: (feature: FeatureDef) => boolean
): readonly {
  readonly feature: FeatureDef;
  readonly text: string | undefined;
  readonly swatch: string | undefined;
}[] {
  const t = useT();
  const { locale } = useI18n();
  return props.features
    .filter((feature) => featureType(feature) !== "header")
    .filter((feature) => (only ? only(feature) : true))
    .map((feature) => {
      const dto = props.values[feature.slug];
      return {
        feature,
        text: formatFeatureValue(feature, dto, { t, locale }),
        swatch: featureType(feature) === "hex_color" ? hexColorSwatch(dto) : undefined,
      };
    });
}

/** A row's value, or the named reason there is none. */
function ValueText(props: {
  readonly feature: FeatureDef;
  readonly text: string | undefined;
  readonly hasValue: boolean;
}): ReactElement {
  const t = useT();
  if (props.text !== undefined) return <>{props.text}</>;
  const type = featureType(props.feature);
  // Two different absences, said differently: nothing was entered, versus
  // something was entered that this build cannot read.
  if (!props.hasValue || type === undefined) {
    return (
      <Typography.Text type="secondary">{t(ATTRIBUTES_I18N_KEYS.valueNotSet)}</Typography.Text>
    );
  }
  return (
    // Same C-DEVCOPY rule as the unsupported EDITOR notice: the sentence says
    // what happened, the type slug travels as an attribute for support.
    <Typography.Text
      type="warning"
      data-testid="attributes-unreadable-value"
      data-attributes-type={type}
    >
      {t(ATTRIBUTES_I18N_KEYS.valueUnreadable)}
    </Typography.Text>
  );
}

/**
 * The `show_as_badge` values, as antd `Tag`s — what a result card shows under
 * a title. Features with no value are omitted here (a card is a summary, and
 * "not specified" is not a selling point); the detail list below says it
 * explicitly instead.
 */
export function FeatureBadges(props: FeatureDisplayProps): ReactElement {
  const rows = useRows(props, (feature) => feature.show_as_badge === true);
  const shown = rows.filter((row) => row.text !== undefined);
  return (
    <Flex gap={spacing[1]} wrap data-testid="attributes-badges">
      {shown.map((row) => (
        <Tag
          key={row.feature.slug}
          {...(row.swatch ? { color: row.swatch } : {})}
          data-testid={`attributes-badge-${row.feature.slug}`}
        >
          {row.text}
        </Tag>
      ))}
    </Flex>
  );
}

/** Every feature and its value — the spec table of a detail page. */
export function FeatureValueList(props: FeatureDisplayProps): ReactElement {
  const rows = useRows(props);
  return (
    <Descriptions
      column={1}
      size="small"
      data-testid="attributes-value-list"
      items={rows.map((row) => ({
        key: row.feature.slug,
        label: featureName(row.feature),
        children: (
          <ValueText
            feature={row.feature}
            text={row.text}
            hasValue={props.values[row.feature.slug] !== undefined}
          />
        ),
      }))}
    />
  );
}
