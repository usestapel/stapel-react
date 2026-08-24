/** The trash: restore, delete-forever, and a switched-off Empty that says why. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { TrashPane } from "../src/default/index.js";
import { DocsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DOC_BUDGET, FOLDER_DRAFTS, WORKSPACE_ID } from "./fixtures.js";

const FULL: DemoHandlers = {
  "/trash": { folders: [FOLDER_DRAFTS], documents: [DOC_BUDGET] },
};
const EMPTY: DemoHandlers = { "/trash": { folders: [], documents: [] } };
const OUTAGE: DemoHandlers = { "/trash": [404, { code: "error.404.not_found" }] };

function Pane(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <DocsDemoHarness handlers={props.handlers}>
      <TrashPane workspaceId={WORKSPACE_ID} />
    </DocsDemoHarness>
  );
}

export default defineDemo({
  id: "docs.trash",
  title: "Trash",
  description:
    "Three states that a boolean `disabled` used to blur into one grey button: the read is in flight, the read failed, or the trash is genuinely empty. Each says which, in a sentence beside the control that aria-describedby points at. Delete-forever is confirmed through SkinConfirm — a bottom sheet on a phone, never a popover clipped against the screen edge.",
  component: TrashPane,
  covers: ["TrashBin"],
  variants: {
    default: {
      viewport: "phone",
      step: "populated",
      description: "One trashed folder and one trashed document; Empty trash is live.",
      render: () => <Pane handlers={FULL} />,
    },
    empty: {
      viewport: "phone",
      step: "empty",
      description: "Genuinely empty: the button is off WITH the empty reason.",
      render: () => <Pane handlers={EMPTY} />,
    },
    failed: {
      viewport: "desktop",
      step: "failed",
      description: "The read answered 404: the button is off with the LOAD-FAILURE reason, not the empty one.",
      render: () => <Pane handlers={OUTAGE} />,
    },
  },
});
