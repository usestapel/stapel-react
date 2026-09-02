/** The Trash tab — deliberately the docs pair's pane, in the drive's frame. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DriveTrashPane } from "../src/default/index.js";
import { DriveDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DOC_CONTRACT, FOLDER_FINANCE, WORKSPACE_ID } from "./fixtures.js";

const FULL: DemoHandlers = {
  "/trash": { folders: [FOLDER_FINANCE], documents: [DOC_CONTRACT] },
};
const EMPTY: DemoHandlers = { "/trash": { folders: [], documents: [] } };

function Pane(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <DriveDemoHarness handlers={props.handlers}>
      <DriveTrashPane workspaceId={WORKSPACE_ID} />
    </DriveDemoHarness>
  );
}

export default defineDemo({
  id: "drive.trash",
  title: "Trash",
  description:
    "A thin wrapper over @stapel/docs-react's TrashPane, not a second implementation. The trash was the one drive surface that was already finished — restore, per-item delete-forever, and an Empty trash whose three off-states each say WHICH — and re-drawing it here would mean diverging on the first bug fix.",
  component: DriveTrashPane,
  variants: {
    default: {
      viewport: "phone",
      step: "populated",
      description: "One trashed folder and one trashed file; Empty trash is live.",
      render: () => <Pane handlers={FULL} />,
    },
    empty: {
      viewport: "phone",
      step: "empty",
      description: "Genuinely empty: the button is off WITH the empty reason.",
      render: () => <Pane handlers={EMPTY} />,
    },
  },
});
