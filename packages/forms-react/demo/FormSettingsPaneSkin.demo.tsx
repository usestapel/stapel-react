/**
 * The screen that closes the pair's defining gap: `PATCH /forms/<id>` is the
 * only writer of `Form.settings`, and `Form.settings` is where a form's
 * notification destinations and its retention override live. Before this
 * surface existed, a form built entirely through the shipped skin collected
 * responses that reached nobody.
 *
 * The `no-destination` variant is the one worth looking at: it is what an
 * admin sees the moment before the mistake, and it says so.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FormSettingsPane } from "../src/default/index.js";
import { formsQueryKeys } from "../src/index.js";
import { FormsDemoHarness, SkinFrame } from "./_harness.js";
import type { DemoSeed } from "./_harness.js";
import {
  DEMO_FORM_ID,
  DEMO_FORM_ROW,
  DEMO_FORM_ROW_NO_DESTINATION,
  DEMO_WORKSPACE_ID,
} from "./fixtures.js";

function seedFor(row: unknown): readonly DemoSeed[] {
  return [[formsQueryKeys.form(DEMO_WORKSPACE_ID, DEMO_FORM_ID), row]];
}

function Pane(props: { row: unknown }): ReactElement {
  return (
    <FormsDemoHarness seed={seedFor(props.row)} workspaceId={DEMO_WORKSPACE_ID}>
      <SkinFrame maxWidth="34rem">
        <FormSettingsPane formId={DEMO_FORM_ID} />
      </SkinFrame>
    </FormsDemoHarness>
  );
}

export default defineDemo({
  id: "forms.settings-pane",
  title: "Form settings (default skin)",
  description:
    "Who gets told when a response arrives, and how long responses are kept. Destinations are not validated here — the server accepts what it accepts, so an address that does not look like one is a notice beside the field, never a refusal. The retention ceiling is a deployment setting no client can read, so a too-long override comes back as the server's own error.400.forms_invalid_retention rather than a guessed number.",
  component: FormSettingsPane,
  covers: ["FormSettingsEditor"],
  tokens: ["surface-raised"],
  variants: {
    configured: {
      viewport: "phone",
      step: "has_destination",
      description: "A form whose responses reach a real inbox.",
      render: () => <Pane row={DEMO_FORM_ROW} />,
    },
    "no-destination": {
      viewport: "phone",
      step: "no_destination",
      description:
        "Nothing configured: the pane states the consequence — responses stored, nobody told — instead of leaving two empty inputs that look finished.",
      render: () => <Pane row={DEMO_FORM_ROW_NO_DESTINATION} />,
    },
  },
});
