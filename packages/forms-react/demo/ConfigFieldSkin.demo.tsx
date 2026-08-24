/**
 * One row of a field's config form, chosen by the CONFIG-WIDGET kind — the
 * mechanism that keeps `<FormBuilderPane>` data-driven instead of shipping a
 * hand-written form per attribute type.
 *
 * The `unimplemented` variant is the point: upstream declares 13 config
 * widgets and this skin draws 11. The two it does not (`hierarchical_options`,
 * `timestamp_array`) render an explanation rather than vanishing — a config
 * form that hides an option looks complete when it is not.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ConfigField } from "../src/default/index.js";
import type { ConfigFieldSpec } from "../src/index.js";
import { FormsDemoHarness, SkinFrame } from "./_harness.js";

const NUMBER_SPEC: ConfigFieldSpec = {
  name: "maxLength",
  kind: "number",
  label_key: "admin.attributes.form.string.maxLength",
  params: { step: 1 },
};

const OPTIONS_SPEC: ConfigFieldSpec = {
  name: "options",
  kind: "string_options",
  label_key: "admin.attributes.form.select.options",
};

const UNIMPLEMENTED_SPEC: ConfigFieldSpec = {
  name: "options",
  kind: "hierarchical_options",
  label_key: "admin.attributes.form.hierarchical_select.options",
};

function Row(props: {
  spec: ConfigFieldSpec;
  value: unknown;
}): ReactElement {
  return (
    <FormsDemoHarness>
      <SkinFrame maxWidth="28rem">
        <ConfigField
          spec={props.spec}
          value={props.value}
          disabled={false}
          onChange={() => undefined}
        />
      </SkinFrame>
    </FormsDemoHarness>
  );
}

export default defineDemo({
  id: "forms.config-field",
  title: "Config row (default skin)",
  description:
    "The data-driven config row: a declaration arrives from GET /field-kinds as {name, kind, params} and this picks the widget. A widget the skin does not implement — including one a future stapel-attributes release adds — degrades to a named explanation instead of a control that would write a wrong shape into a published schema.",
  component: ConfigField,
  tokens: ["surface-raised"],
  variants: {
    number: {
      viewport: "phone",
      step: "number",
      description: "`maxLength` on a string field.",
      render: () => <Row spec={NUMBER_SPEC} value={80} />,
    },
    "string-options": {
      viewport: "phone",
      step: "string_options",
      description: "The choices of a select field, as an editable list.",
      render: () => <Row spec={OPTIONS_SPEC} value={["Sales", "Support"]} />,
    },
    unimplemented: {
      viewport: "phone",
      step: "unsupported_widget",
      description:
        "`hierarchical_options` — declared upstream, not drawn here, and SAID so rather than hidden.",
      render: () => <Row spec={UNIMPLEMENTED_SPEC} value={undefined} />,
    },
  },
});
