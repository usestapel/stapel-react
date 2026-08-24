/** The flagship surface: folder tree + document list + the two creation doors. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FileManager } from "../src/default/index.js";
import { DocsDemoHarness, neverSettles } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DOC_BUDGET,
  DOC_CONTRACT,
  DOC_NOTES,
  FOLDER_DRAFTS,
  FOLDER_SPECS,
  WORKSPACE_ID,
} from "./fixtures.js";

const POPULATED: DemoHandlers = {
  "/folders": [FOLDER_SPECS, FOLDER_DRAFTS],
  "/documents": [DOC_NOTES, DOC_BUDGET, DOC_CONTRACT],
  "/trash": { folders: [], documents: [] },
};
const EMPTY: DemoHandlers = {
  "/folders": [],
  "/documents": [],
  "/trash": { folders: [], documents: [] },
};
const OUTAGE: DemoHandlers = {
  "/folders": [500, { code: "error.500.internal" }],
  "/documents": [500, { code: "error.500.internal" }],
  "/trash": [500, { code: "error.500.internal" }],
};
const LOADING: DemoHandlers = {
  "/folders": neverSettles,
  "/documents": neverSettles,
  "/trash": neverSettles,
};

function Manager(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <DocsDemoHarness handlers={props.handlers}>
      <FileManager workspaceId={WORKSPACE_ID} onOpenDocument={() => undefined} />
    </DocsDemoHarness>
  );
}

export default defineDemo({
  id: "docs.file-manager",
  title: "File manager",
  description:
    "The workspace's documents: folder tree beside the list on a wide box, one pane at a time under the tablet breakpoint (measured off the container, not the viewport). New document and Upload are both here because both are how a document comes into existence. Every row's menu opens by click as well as by right-click, so rename/move/trash are reachable by keyboard and on touch.",
  component: FileManager,
  covers: ["DocsProvider", "DocumentList", "FolderTree", "Breadcrumbs", "DocUploader"],
  variants: {
    default: {
      viewport: "desktop",
      step: "populated",
      description: "Two panes, three documents, two folders.",
      render: () => <Manager handlers={POPULATED} />,
    },
    phone: {
      viewport: "phone",
      step: "populated",
      description: "One pane at a time with a Folders/Files switch; 44px controls.",
      render: () => <Manager handlers={POPULATED} />,
    },
    empty: {
      viewport: "phone",
      step: "empty",
      description: "A workspace with nothing in it — said only about a read that succeeded.",
      render: () => <Manager handlers={EMPTY} />,
    },
    loading: {
      viewport: "phone",
      step: "loading",
      description: "Both reads still in flight: skeletons, and no claim about emptiness.",
      render: () => <Manager handlers={LOADING} />,
    },
    outage: {
      viewport: "desktop",
      step: "failed",
      description: "Both reads answered 500 — the failure is stated, never dressed as an empty workspace.",
      render: () => <Manager handlers={OUTAGE} />,
    },
  },
});
