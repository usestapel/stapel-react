/** The document list on its own — the pane a host can mount without the tree. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DocumentListPane } from "../src/default/index.js";
import { DocsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DOC_BUDGET, DOC_CONTRACT, DOC_NOTES, WORKSPACE_ID } from "./fixtures.js";

const ROWS: DemoHandlers = {
  "/folders": [],
  "/documents": [DOC_NOTES, DOC_BUDGET, DOC_CONTRACT],
};
const NONE: DemoHandlers = { "/folders": [], "/documents": [] };

function Pane(props: {
  handlers: DemoHandlers;
  openable: boolean;
}): ReactElement {
  return (
    <DocsDemoHarness handlers={props.handlers}>
      <DocumentListPane
        workspaceId={WORKSPACE_ID}
        folderId={null}
        {...(props.openable ? { onOpenDocument: () => undefined } : {})}
        onShowHistory={() => undefined}
      />
    </DocsDemoHarness>
  );
}

export default defineDemo({
  id: "docs.document-list",
  title: "Document list",
  description:
    "Dates and sizes formatted in the APP's locale, not the browser's. The 'no-open' variant is the §83 rule with teeth: a host that passes no onOpenDocument gets rows with no Open item and no clickable cursor, rather than an affordance that answers nothing.",
  component: DocumentListPane,
  covers: ["DocumentList"],
  variants: {
    default: {
      viewport: "phone",
      step: "populated",
      description: "Three unfiled documents with their per-row actions menu.",
      render: () => <Pane handlers={ROWS} openable />,
    },
    "no-open-route": {
      viewport: "phone",
      step: "populated-not-openable",
      description: "No onOpenDocument: no Open item, no clickable row.",
      render: () => <Pane handlers={ROWS} openable={false} />,
    },
    empty: {
      viewport: "phone",
      step: "empty",
      description: "The designed empty state with the sentence that says what to do next.",
      render: () => <Pane handlers={NONE} openable />,
    },
  },
});
