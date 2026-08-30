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
  DEMO_VOCABULARY_CLIENT,
  REFUSED_VALUES,
  REF_HIERARCHICAL_FEATURES,
  REF_HIERARCHICAL_VALUES,
  REF_SELECT_FEATURES,
  REF_SELECT_VALUES,
  RULES_NEW_VALUES,
  RULES_USED_VALUES,
  RULE_FEATURES,
  SECTION_FEATURES,
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
    "rules — new": {
      description:
        "Condition = new. The rule engine runs BEFORE any editor: “Screen condition” is not on the page at all (a `show` rule), and “Delivery” still offers post. Values in, states out, one pass — a controlling field's own visibility is never consulted, so a rule cycle is impossible by construction.",
      viewport: "phone",
      step: "condition=new",
      render: () => (
        <AttributesDemoHarness surface="base">
          <EditableFeatureFields features={RULE_FEATURES} initialValues={RULES_NEW_VALUES} />
        </AttributesDemoHarness>
      ),
    },
    "rules — used": {
      description:
        "The same three features, one answer later. “Screen condition” appears AND carries the asterisk (`show` + `require` on one field), and “Delivery” has lost the post option — narrowed out of the config before the control saw it, rather than offered and then refused. Two variants because a rule is a transition, and a single frame cannot photograph one.",
      viewport: "desktop",
      step: "condition=used",
      render: () => (
        <AttributesDemoHarness surface="base">
          <EditableFeatureFields features={RULE_FEATURES} initialValues={RULES_USED_VALUES} />
        </AttributesDemoHarness>
      ),
    },
    sections: {
      description:
        "The form metadata 99.9 % of imported fields carry: `group` becomes a section (ordered by first appearance, ungrouped rows first and unheaded), `description` becomes the help line under the field, `example` becomes the placeholder, and `hints` become ONE info alert per field rather than a stack of boxes.",
      viewport: "phone",
      step: "grouped",
      render: () => (
        <AttributesDemoHarness surface="base">
          <EditableFeatureFields features={SECTION_FEATURES} />
        </AttributesDemoHarness>
      ),
    },
    "ref-select": {
      description:
        "Two vocabulary-backed fields over a mock client: Brand searches a level of `avito-phones`, Model searches the level below narrowed by the brand's code. The options are not in the category schema — they cannot be (529 vendors, 14 962 models) — so the config carries a pointer and the terms arrive over a second wire, debounced and superseding.",
      viewport: "desktop",
      step: "brand-and-model",
      render: () => (
        <AttributesDemoHarness surface="base">
          <EditableFeatureFields
            features={REF_SELECT_FEATURES}
            initialValues={REF_SELECT_VALUES}
            vocabularyClient={DEMO_VOCABULARY_CLIENT}
          />
        </AttributesDemoHarness>
      ),
    },
    "ref-hierarchical": {
      description:
        "One field, three vocabulary levels: Make → Model → Generation as a Cascader that loads each column when the one before it is chosen. Nothing is prefetched past the root — the whole reason this type exists is that the tree does not fit in a response.",
      viewport: "phone",
      step: "cascade",
      render: () => (
        <AttributesDemoHarness surface="base">
          <EditableFeatureFields
            features={REF_HIERARCHICAL_FEATURES}
            initialValues={REF_HIERARCHICAL_VALUES}
            vocabularyClient={DEMO_VOCABULARY_CLIENT}
          />
        </AttributesDemoHarness>
      ),
    },
    "no vocabulary source": {
      description:
        "The same two ref fields with no VocabularyClientProvider above them. A pointer with nothing to resolve it is drawn as the loud notice, never as an empty dropdown — an empty dropdown is a mandatory attribute a person cannot answer and is not told about — and the submit blocks through the same channel an unsupported type uses.",
      viewport: "phone",
      step: "no-client",
      render: () => (
        <AttributesDemoHarness surface="base">
          <EditableFeatureFields features={REF_SELECT_FEATURES} />
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
