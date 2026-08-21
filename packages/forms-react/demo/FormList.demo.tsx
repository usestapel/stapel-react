/** The admin entry point — the workspace's forms. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FormList } from "../src/index.js";
import { FormsDemoHarness, DemoCard, StepBadge } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_FORM_ROW, DEMO_WORKSPACE_ID } from "./fixtures.js";

const HANDLERS: DemoHandlers = { "/forms": [DEMO_FORM_ROW] };

function List(): ReactElement {
  return (
    <FormsDemoHarness handlers={HANDLERS}>
      <DemoCard heading="FormList">
        <FormList workspaceId={DEMO_WORKSPACE_ID}>
          {(bag) => (
            <>
              <StepBadge step={bag.state.status} />
              <StepBadge
                step={
                  bag.state.status === "ready" ? `forms: ${bag.state.data.length}` : "—"
                }
              />
            </>
          )}
        </FormList>
      </DemoCard>
    </FormsDemoHarness>
  );
}

export default defineDemo({
  id: "forms.list",
  title: "Forms list",
  description:
    "Headless list of a workspace's forms, rendered through matchList so 'no forms yet' can only be said about a load that succeeded.",
  component: FormList,
  tokens: ["surface-raised"],
  variants: { default: { render: () => <List /> } },
});
