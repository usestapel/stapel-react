/**
 * The ten builtin value editors, drawn.
 *
 * A category's features are not a form the designer laid out — they are rows
 * of a catalogue an admin configured, and the control for each one is decided
 * at RUNTIME from `config.type` plus that type's own config. So the thing
 * worth photographing is not "a form": it is that an absent `uiStyle` means a
 * dropdown, that a closed `options` list is not a text box, that `maxLength`
 * counts code points, that `lockUserInput` says WHY it is locked, and that a
 * refusal lands under the control it is about rather than in a banner.
 *
 * Every variant opens already seeded, which is what makes a static shot worth
 * taking: `assertVariantsRenderDistinctly` in `test/demos.test.tsx` fails the
 * build if two of them ever photograph the same frame.
 */
import { defineDemo } from "@stapel/showcase";
import { FeatureFields } from "../src/default/index.js";
import { AttributesDemoHarness, EditableFeatureFields } from "./_harness.js";
import {
  CHOICE_FEATURES,
  CHOICE_VALUES,
  REFUSED_VALUES,
  TEXT_FEATURES,
  TEXT_VALUES,
  UNIT_FEATURES,
  UNIT_VALUES,
} from "./fixtures.js";

export default defineDemo({
  id: "attributes.fields",
  title: "Feature fields - the ten builtin editors",
  description:
    "<FeatureFields> runs the resolution ladder per feature (host registration > skin builtin > loud notice) and draws each value type from its own config. It holds no state and owns no submit: values in, changes out, so the composer that owns the draft keeps one source of truth. All ten builtin types appear across these variants.",
  component: FeatureFields,
  tokens: ["surface-raised", "text"],
  variants: {
    "text and numbers": {
      description:
        "header, string, int, float, bool — a caption with no label or asterisk, a code-point counter rather than a hard cap (the DOM counts UTF-16, the engine counts code points), a translated postfix on the float, and the admin's own comment under the headline.",
      viewport: "phone",
      step: "answered",
      render: () => (
        <AttributesDemoHarness surface="base">
          <EditableFeatureFields features={TEXT_FEATURES} initialValues={TEXT_VALUES} />
        </AttributesDemoHarness>
      ),
    },
    choices: {
      description:
        "select (chips, and checkboxes with the minimum said in words), hierarchical_select as a Cascader whose minDepth stops a partial path being selectable, hex_color as a category picker with real swatches, and a select the catalogue locked — with the reason beside it, not a bare grey control.",
      viewport: "desktop",
      step: "chosen",
      render: () => (
        <AttributesDemoHarness surface="base">
          <EditableFeatureFields features={CHOICE_FEATURES} initialValues={CHOICE_VALUES} />
        </AttributesDemoHarness>
      ),
    },
    "dates and units": {
      description:
        "date is a Unix timestamp, not an ISO string — and 'year only' is a number, because a date input would force a month and a day the admin said they do not want. convertible_unit sends the number AS TYPED beside its unit; the server converts.",
      viewport: "phone",
      step: "measured",
      render: () => (
        <AttributesDemoHarness surface="base">
          <EditableFeatureFields features={UNIT_FEATURES} initialValues={UNIT_VALUES} />
        </AttributesDemoHarness>
      ),
    },
    refused: {
      description:
        "The mirror speaks the engine's own error.400.feature_* keys, and each refusal lands under the control it is about. A banner says 'something is wrong'; this says 'this box is wrong', and only the second one can be acted on.",
      viewport: "desktop",
      step: "invalid",
      render: () => (
        <AttributesDemoHarness surface="base">
          <EditableFeatureFields
            features={TEXT_FEATURES}
            initialValues={REFUSED_VALUES}
            showErrors
          />
        </AttributesDemoHarness>
      ),
    },
    submitting: {
      description:
        "A submit in flight: every editor goes read-only at once, from the one prop the composer already owns.",
      viewport: "phone",
      step: "submitting",
      render: () => (
        <AttributesDemoHarness surface="base">
          <EditableFeatureFields
            features={TEXT_FEATURES}
            initialValues={TEXT_VALUES}
            submitting
          />
        </AttributesDemoHarness>
      ),
    },
  },
});
