/** The anonymous respondent's surface — the LoadState arms a form can be in. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FormFill } from "../src/index.js";
import { FormsDemoHarness, DemoCard, StepBadge } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_PUBLIC_FORM, DEMO_PUBLIC_ID } from "./fixtures.js";

const OK: DemoHandlers = { [`/public/${DEMO_PUBLIC_ID}/`]: DEMO_PUBLIC_FORM };
const CLOSED: DemoHandlers = {
  [`/public/${DEMO_PUBLIC_ID}/`]: [410, { localizable_error: "error.410.forms_closed" }],
};
const OUTAGE: DemoHandlers = {
  [`/public/${DEMO_PUBLIC_ID}/`]: [503, { localizable_error: "stapel.http.503" }],
};

function Fill(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <FormsDemoHarness handlers={props.handlers}>
      <DemoCard heading="FormFill">
        <FormFill publicId={DEMO_PUBLIC_ID}>
          {(bag) => (
            <>
              <StepBadge step={bag.state.status} />
              {bag.unsupportedKinds.length > 0 && (
                <StepBadge step={`unsupported: ${bag.unsupportedKinds.join(",")}`} />
              )}
              <StepBadge step={bag.submit.available ? "submit:ready" : "submit:blocked"} />
            </>
          )}
        </FormFill>
      </DemoCard>
    </FormsDemoHarness>
  );
}

/**
 * Three variants because a schema fetch has three outcomes and a form that
 * shows the same blank page for all of them is the defect `LoadState` exists
 * to prevent: `ready`, the CLOSED verdict, and an outage that is not a verdict.
 */
export default defineDemo({
  id: "forms.fill",
  title: "Form fill",
  description:
    "Headless anonymous fill: the schema load as a three-state LoadState, the unsupported-kind guard, and the submit gate's reason.",
  component: FormFill,
  tokens: ["surface-raised"],
  variants: {
    default: { description: "Schema loaded", render: () => <Fill handlers={OK} /> },
    closed: { description: "410 — the form is closed", render: () => <Fill handlers={CLOSED} /> },
    outage: {
      description: "503 — we could not ask, which is not 'no form here'",
      render: () => <Fill handlers={OUTAGE} />,
    },
  },
});
