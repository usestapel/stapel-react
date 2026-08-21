/** The authoring surface — data-driven off the config-form declarations. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FormBuilder } from "../src/index.js";
import { FormsDemoHarness, DemoCard, StepBadge } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_FORM_ID, DEMO_FORM_ROW, DEMO_WORKSPACE_ID } from "./fixtures.js";

const HANDLERS: DemoHandlers = { [`/forms/${DEMO_FORM_ID}`]: DEMO_FORM_ROW };

function Builder(): ReactElement {
  return (
    <FormsDemoHarness handlers={HANDLERS}>
      <DemoCard heading="FormBuilder">
        <FormBuilder workspaceId={DEMO_WORKSPACE_ID} formId={DEMO_FORM_ID}>
          {(bag) => (
            <>
              <StepBadge step={bag.state.status} />
              <StepBadge step={`fields: ${bag.fields.length}`} />
              <StepBadge step={bag.isDirty ? "dirty" : "clean"} />
              {/* Publishing is blocked until the draft is saved — the reason
                  is readable, not a grey rectangle. */}
              <StepBadge
                step={bag.publish.available ? "publish:ready" : "publish:blocked"}
              />
            </>
          )}
        </FormBuilder>
      </DemoCard>
    </FormsDemoHarness>
  );
}

export default defineDemo({
  id: "forms.builder",
  title: "Form builder",
  description:
    "Headless authoring: a draft schema, per-kind config forms mirrored from stapel-attributes, and the save-before-publish gate.",
  component: FormBuilder,
  tokens: ["surface-raised"],
  variants: { default: { render: () => <Builder /> } },
});
