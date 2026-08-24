/** The breadcrumb trail — navigation chrome that never fabricates a path. */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FileManagerBreadcrumbs } from "../src/default/index.js";
import { DocsDemoHarness, neverSettles } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { FOLDER_DRAFTS, FOLDER_SPECS, WORKSPACE_ID } from "./fixtures.js";

const TREE: DemoHandlers = { "/folders": [FOLDER_SPECS, FOLDER_DRAFTS] };
const PENDING: DemoHandlers = { "/folders": neverSettles };

function Crumbs(props: {
  handlers: DemoHandlers;
  folderId: string | null;
}): ReactElement {
  const [folderId, setFolderId] = useState<string | null>(props.folderId);
  return (
    <DocsDemoHarness handlers={props.handlers}>
      <FileManagerBreadcrumbs
        workspaceId={WORKSPACE_ID}
        folderId={folderId}
        onSelectFolder={setFolderId}
      />
    </DocsDemoHarness>
  );
}

export default defineDemo({
  id: "docs.breadcrumbs",
  title: "Breadcrumbs",
  description:
    "The trail is walked up parent_id over the one folder read. While that read is in flight the root crumb alone is the honest render — a breadcrumb bar must never invent the path it is not sure of.",
  component: FileManagerBreadcrumbs,
  covers: ["Breadcrumbs"],
  variants: {
    default: {
      viewport: "phone",
      step: "nested",
      description: "All documents › Specifications › Drafts.",
      render: () => <Crumbs handlers={TREE} folderId={FOLDER_DRAFTS.id} />,
    },
    root: {
      viewport: "phone",
      step: "root",
      description: "At the workspace root: one crumb, and it is the truth.",
      render: () => <Crumbs handlers={TREE} folderId={null} />,
    },
    loading: {
      viewport: "phone",
      step: "loading",
      description: "The folder read has not landed — the root crumb, not a guessed trail.",
      render: () => <Crumbs handlers={PENDING} folderId={FOLDER_DRAFTS.id} />,
    },
  },
});
