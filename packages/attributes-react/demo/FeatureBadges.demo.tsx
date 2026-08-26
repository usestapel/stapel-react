/**
 * The DISPLAY half: the same catalogue, read back.
 *
 * `<FeatureBadges/>` is what a result card shows under a title;
 * `<FeatureValueList/>` is the spec table of a detail page. Both are
 * renderers over `formatFeatureValue`, so neither re-implements a single
 * type's formatting — which is why a `hierarchical_select` shows its
 * catalogue LABELS ("Passenger / Hatchback") rather than the values it stores,
 * and why `postfix1000` swaps unit and scale at a thousand.
 *
 * Two rules a naive spec table breaks, and the reason the third variant
 * exists at all:
 *
 *  - **`show_as_badge` is the CATEGORY's decision**, made by whoever
 *    configured the feature. This component honours it instead of picking its
 *    own first three values.
 *  - **An unreadable value SAYS SO.** A blank cell where a spec line belongs
 *    reads as "this car has no size grid", which is a different and false
 *    statement from "this build cannot show that value" — and different again
 *    from "nobody filled it in".
 */
import type { ReactElement } from "react";
import { Flex } from "antd";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { FeatureBadges, FeatureValueList } from "../src/default/index.js";
import type { FeatureDef, FeaturesDto } from "../src/index.js";
import { AttributesDemoHarness } from "./_harness.js";
import { ALL_FEATURES, MIXED_FEATURES, STORED, STORED_WITH_GAPS } from "./fixtures.js";

/** A card's summary line above the full table — the two surfaces as a page
 * actually composes them. */
function CardAndSpecs(props: {
  readonly features: readonly FeatureDef[];
  readonly values: FeaturesDto;
}): ReactElement {
  return (
    <Flex vertical gap={spacing[4]}>
      <FeatureBadges features={props.features} values={props.values} />
      <FeatureValueList features={props.features} values={props.values} />
    </Flex>
  );
}

export default defineDemo({
  id: "attributes.display",
  title: "Badges and the spec table",
  description:
    "The stored {slug: {type, value}} envelope rendered back: badges for a card, a Descriptions table for a detail page. Values are formatted by type — a hierarchical path resolves to its catalogue labels, a hex_color carries its swatch onto the tag, a float carries its translated postfix — and an absent or unreadable value is named rather than left blank.",
  component: FeatureBadges,
  covers: ["FeatureValueList"],
  tokens: ["surface-raised", "text-secondary"],
  variants: {
    badges: {
      description:
        "Only the four features the category flagged show_as_badge, in the order it declared. A feature with no value is omitted here — a card is a summary, and 'not specified' is not a selling point.",
      viewport: "phone",
      step: "badges",
      render: () => (
        <AttributesDemoHarness>
          <FeatureBadges features={ALL_FEATURES} values={STORED} />
        </AttributesDemoHarness>
      ),
    },
    "spec table": {
      description:
        "Every feature and its value, headers excluded. Nine of the ten types formatted, each by its own rule — and `length` reads 4.28 m because the unit travelled with the number.",
      viewport: "desktop",
      step: "specs",
      render: () => (
        <AttributesDemoHarness>
          <FeatureValueList features={ALL_FEATURES} values={STORED} />
        </AttributesDemoHarness>
      ),
    },
    "two kinds of absence": {
      description:
        "'Not specified' (nobody answered) and 'This value cannot be shown here' (a stored value of a type this build cannot format) are different facts and read differently. Neither is an empty cell; the type slug travels as data-attributes-type for support.",
      viewport: "phone",
      step: "gaps",
      render: () => (
        <AttributesDemoHarness>
          <FeatureValueList features={MIXED_FEATURES} values={STORED_WITH_GAPS} />
        </AttributesDemoHarness>
      ),
    },
    "card and specs": {
      description: "How a detail page composes the two: the summary line, then the full table.",
      viewport: "desktop",
      step: "composed",
      render: () => (
        <AttributesDemoHarness>
          <CardAndSpecs features={ALL_FEATURES} values={STORED} />
        </AttributesDemoHarness>
      ),
    },
  },
});
