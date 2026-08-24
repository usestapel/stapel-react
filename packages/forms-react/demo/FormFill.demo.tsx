/** The anonymous respondent's surface — the LoadState arms a form can be in. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FormFill } from "../src/index.js";
import { FormsDemoHarness, DemoCard, StepBadge } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_PUBLIC_FORM, DEMO_PUBLIC_ID } from "./fixtures.js";

const OK: DemoHandlers = { [`/public/${DEMO_PUBLIC_ID}/`]: DEMO_PUBLIC_FORM };

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
  // ONE variant. `closed` (410) and `outage` (503) used to stand beside this
  // one and photographed identically: their difference arrives with a fetch,
  // and a static render never awaits one, so the gallery showed the same
  // `loading` chip under three names (visual pass M-6 / C-SAMESHOT, now a
  // failing assertion in `test/demos.test.tsx`). The three-way split those
  // variants existed to document is asserted in `test/loadStates.test.tsx`
  // and DRAWN in `forms.stapel-form` — this demo documents the bag's shape.
  variants: {
    default: {
      description: "Schema loaded — the headless bag a host renders its own visuals over",
      step: "ready",
      render: () => <Fill handlers={OK} />,
    },
  },
});
