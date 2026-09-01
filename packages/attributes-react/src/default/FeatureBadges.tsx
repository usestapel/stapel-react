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
 *  - **A value this reader may not see is a row, not a hole.** `<FeatureValueList/>`
 *    keeps a redacted row in place and says what the system actually observed
 *    — the seller supplied it — while `<FeatureBadges/>` drops it entirely,
 *    because a card badge strip is not the place for "VIN: provided by the
 *    seller".
 *    See `../visibility.ts` for why the axis exists and why the presence copy
 *    is not a verification claim.
 *
 * Both are their own skin roots (`SkinTheme surface="bare"`): a card or a
 * detail page that draws them on a dark document with no `ConfigProvider`
 * above used to get antd's light algorithm — a light `Tag` and a
 * near-invisible secondary line on a dark surface. `"bare"` because a spec
 * table is inset in a surface its host already painted.
 */
import type { ReactElement } from "react";
import { Descriptions, Flex, Tag, Typography } from "antd";
import { useI18n, useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { FeatureDef, FeatureValueDto, FeaturesDto } from "../types.js";
import { featureName, featureType } from "../types.js";
import { formatFeatureValue, hexColorSwatch } from "../format.js";
import {
  isPublicFeature,
  isRedactedValue,
  isValuePresent,
  isValueVerified,
  valueVerification,
} from "../visibility.js";
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
  readonly dto: FeatureValueDto | undefined;
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
      // A redacted row is not formatted at all. `formatFeatureValue` already
      // refuses it (a stub carries no value, and `isBlank(undefined)` is
      // true), but a stub is a DIFFERENT statement from an empty field and
      // the branch that says so should be visible here rather than inferred
      // from the formatter's return.
      const redacted = isRedactedValue(dto);
      return {
        feature,
        dto,
        text: redacted ? undefined : formatFeatureValue(feature, dto, { t, locale }),
        swatch:
          !redacted && featureType(feature) === "hex_color" ? hexColorSwatch(dto) : undefined,
      };
    });
}

/**
 * A withheld value's row: what the system OBSERVED, and nothing more.
 *
 * Three states, in the order that keeps the copy honest:
 *
 *  - the seller did not fill it in → the ordinary "not specified" treatment,
 *    the same one an empty public field gets. There is nothing to withhold.
 *  - an outside check actually ran and said `verified` → the stronger badge.
 *    **Nothing in the fleet writes a `verification` today**, so this branch is
 *    dead code that is nonetheless correct: the day a registry integration
 *    writes one, the badge upgrades without a release here — and because the
 *    engine never synthesizes one, it cannot upgrade by accident.
 *  - otherwise → "Provided by the seller". A statement about the SELLER's
 *    action, deliberately not about the value being right. We run no VIN
 *    check, so "VIN verified" is a claim about the outside world that no code
 *    here has established, and it is not printed.
 *
 * A `verification` whose `status` this build does not recognise falls into
 * the third branch too: not understood is not verified.
 */
function RedactedValue(props: { readonly dto: FeatureValueDto | undefined }): ReactElement {
  const t = useT();
  if (!isValuePresent(props.dto)) {
    return (
      <Typography.Text type="secondary">{t(ATTRIBUTES_I18N_KEYS.valueNotSet)}</Typography.Text>
    );
  }
  if (isValueVerified(props.dto)) {
    const verification = valueVerification(props.dto);
    return (
      <Tag
        color="success"
        data-testid="attributes-value-verified"
        // Who checked and when are machine facts for support, not copy for a
        // reader — the same C-DEVCOPY rule the unsupported notice follows.
        {...(typeof verification?.source === "string"
          ? { "data-attributes-verification-source": verification.source }
          : {})}
        {...(typeof verification?.verified_at === "string"
          ? { "data-attributes-verified-at": verification.verified_at }
          : {})}
      >
        {t(ATTRIBUTES_I18N_KEYS.valueVerified)}
      </Tag>
    );
  }
  return (
    <Typography.Text type="secondary" data-testid="attributes-value-provided">
      {t(ATTRIBUTES_I18N_KEYS.valueProvided)}
    </Typography.Text>
  );
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
  // A non-public feature is NEVER a badge. The engine forces
  // `show_as_badge: false` on one and keeps hidden values out of
  // `features_badges` entirely, so both filters below are defensive — but a
  // card badge strip is not the place for "VIN: provided by the seller", and a
  // renderer that can only be correct because of what the server did is the
  // arrangement that leaked the VIN in the first place.
  const rows = useRows(
    props,
    (feature) => feature.show_as_badge === true && isPublicFeature(feature)
  );
  const shown = rows.filter((row) => row.text !== undefined && !isRedactedValue(row.dto));
  return (
    <SkinTheme surface="bare">
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
    </SkinTheme>
  );
}

/**
 * Every feature and its value — the spec table of a detail page.
 *
 * A row whose value this reader may not see KEEPS ITS PLACE, as the presence
 * statement instead of the value. That is deliberate and it is the whole
 * shape of the redaction: the public table then has the same rows in the same
 * order as the seller's own, and a buyer can see that the field exists and
 * was answered. Dropping the row would make the field's very existence
 * invisible, which is a worse answer for a buyer deciding whether to ask.
 */
export function FeatureValueList(props: FeatureDisplayProps): ReactElement {
  const rows = useRows(props);
  return (
    <SkinTheme surface="bare">
      <Descriptions
        column={1}
        size="small"
        data-testid="attributes-value-list"
        items={rows.map((row) => ({
          key: row.feature.slug,
          label: featureName(row.feature),
          children: isRedactedValue(row.dto) ? (
            <RedactedValue dto={row.dto} />
          ) : (
            <ValueText
              feature={row.feature}
              text={row.text}
              hasValue={props.values[row.feature.slug] !== undefined}
            />
          ),
        }))}
      />
    </SkinTheme>
  );
}
