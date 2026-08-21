/** Response review — per-version columns, keyset paging, export. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ResponsesTable } from "../src/index.js";
import { FormsDemoHarness, DemoCard, StepBadge } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DEMO_FORM_ID,
  DEMO_SUBMISSIONS,
  DEMO_VERSIONS,
  DEMO_WORKSPACE_ID,
} from "./fixtures.js";

const HANDLERS: DemoHandlers = {
  "/submissions": DEMO_SUBMISSIONS,
  "/versions": DEMO_VERSIONS,
};

const EMPTY: DemoHandlers = { "/submissions": [], "/versions": DEMO_VERSIONS };

function Responses(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <FormsDemoHarness handlers={props.handlers}>
      <DemoCard heading="ResponsesTable">
        <ResponsesTable workspaceId={DEMO_WORKSPACE_ID} formId={DEMO_FORM_ID}>
          {(bag) => (
            <>
              <StepBadge step={bag.state.status} />
              <StepBadge
                step={
                  bag.state.status === "ready"
                    ? `rows: ${bag.state.data.rows.length} · cols: ${bag.state.data.columns.length}`
                    : "—"
                }
              />
              <StepBadge step={`page: ${bag.pageIndex}`} />
            </>
          )}
        </ResponsesTable>
      </DemoCard>
    </FormsDemoHarness>
  );
}

export default defineDemo({
  id: "forms.responses",
  title: "Responses table",
  description:
    "Headless response review: columns taken from the version each response answered, keyset paging, resend and CSV export.",
  component: ResponsesTable,
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <Responses handlers={HANDLERS} /> },
    empty: {
      description: "A load that succeeded and found nothing — not an outage",
      render: () => <Responses handlers={EMPTY} />,
    },
  },
});
