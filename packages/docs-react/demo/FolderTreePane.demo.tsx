/** The folder tree pane: rename / move / new subfolder / trash per folder. */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FolderTreePane } from "../src/default/index.js";
import { DocsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { FOLDER_DRAFTS, FOLDER_SPECS, WORKSPACE_ID } from "./fixtures.js";

const TREE: DemoHandlers = { "/folders": [FOLDER_SPECS, FOLDER_DRAFTS] };
const NONE: DemoHandlers = { "/folders": [] };
const OUTAGE: DemoHandlers = { "/folders": [503, { code: "error.503.mandate_unavailable" }] };

function Pane(props: { handlers: DemoHandlers }): ReactElement {
  const [selected, setSelected] = useState<string | null>(FOLDER_SPECS.id);
  return (
    <DocsDemoHarness handlers={props.handlers}>
      <FolderTreePane
        workspaceId={WORKSPACE_ID}
        selectedFolderId={selected}
        onSelectFolder={setSelected}
      />
    </DocsDemoHarness>
  );
}

export default defineDemo({
  id: "docs.folder-tree",
  title: "Folder tree",
  description:
    "One wire read, rendered as a tree by parent_id. A folder whose parent is missing (trashed) stays reachable as a root rather than disappearing. The failed arm is a stated failure, never 'no folders yet'.",
  component: FolderTreePane,
  covers: ["FolderTree"],
  variants: {
    default: {
      viewport: "phone",
      step: "populated",
      description: "Two folders, one nested, with the per-folder actions menu.",
      render: () => <Pane handlers={TREE} />,
    },
    empty: {
      viewport: "phone",
      step: "empty",
      description: "No folders yet — beside a live New folder button.",
      render: () => <Pane handlers={NONE} />,
    },
    failed: {
      viewport: "desktop",
      step: "failed",
      description: "The folder read failed: the sentence and a retry, not an empty tree.",
      render: () => <Pane handlers={OUTAGE} />,
    },
  },
});
