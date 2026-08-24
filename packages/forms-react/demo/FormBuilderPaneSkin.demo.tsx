/**
 * The authoring surface as it ships. Data-driven throughout: the config rows
 * under each field come from `GET /field-kinds`, which serves
 * `stapel_attributes.config_form()` verbatim — there is no per-kind form in
 * this pair, which is why a type registered upstream reaches the builder with
 * no release on either side of the wire.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FormBuilderPane } from "../src/default/index.js";
import { formsQueryKeys } from "../src/index.js";
import { FormsDemoHarness, SkinFrame } from "./_harness.js";
import type { DemoSeed } from "./_harness.js";
import {
  DEMO_FIELD_KINDS,
  DEMO_FORM_ID,
  DEMO_FORM_ROW,
  DEMO_FORM_ROW_EMPTY_DRAFT,
  DEMO_WORKSPACE_ID,
} from "./fixtures.js";

const CATALOGUE = {
  kinds: DEMO_FIELD_KINDS.kinds,
  configWidgets: DEMO_FIELD_KINDS.config_widgets,
};

function seedFor(row: unknown): readonly DemoSeed[] {
  return [
    [formsQueryKeys.form(DEMO_WORKSPACE_ID, DEMO_FORM_ID), row],
    [formsQueryKeys.fieldKinds(DEMO_WORKSPACE_ID), CATALOGUE],
  ];
}

function Pane(props: { row: unknown }): ReactElement {
  return (
    <FormsDemoHarness seed={seedFor(props.row)} workspaceId={DEMO_WORKSPACE_ID}>
      <SkinFrame>
        <FormBuilderPane formId={DEMO_FORM_ID} />
      </SkinFrame>
    </FormsDemoHarness>
  );
}

export default defineDemo({
  id: "forms.builder-pane",
  title: "Form builder (default skin)",
  description:
    "Draft editing, publish, lifecycle state and the public link, plus the door to the form's settings. Reorder buttons at the ends of the list are gated with the reason beside them rather than greyed out for no stated cause, and a kind the deployment does not recognise stays listed and says why it cannot be configured — dropping it would silently delete a field from a stored schema.",
  component: FormBuilderPane,
  covers: ["FormBuilder", "ConfigField"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "ready",
      description: "A draft with two fields and the catalogue loaded.",
      render: () => <Pane row={DEMO_FORM_ROW} />,
    },
    "empty-draft": {
      viewport: "phone",
      step: "empty_schema",
      description:
        "A form nobody has started: the designed empty state, with the add-a-field row underneath it.",
      render: () => <Pane row={DEMO_FORM_ROW_EMPTY_DRAFT} />,
    },
  },
});
