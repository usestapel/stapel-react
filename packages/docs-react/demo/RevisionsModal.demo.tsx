/** Version history: list, preview, pin-as-named, rollback-as-new-head. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { RevisionsModal } from "../src/default/index.js";
import { DocsDemoHarness, textBody } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DOC_CONTRACT,
  DOC_NOTES,
  MARKDOWN_BODY,
  REVISION_HEAD,
  REVISION_NAMED,
} from "./fixtures.js";

const HISTORY: DemoHandlers = {
  "/documents/d-notes/revisions/rev-named/content": textBody(MARKDOWN_BODY, 5, "text/markdown"),
  "/documents/d-notes/revisions": [REVISION_HEAD, REVISION_NAMED],
  "/documents/d-notes": DOC_NOTES,
};
const NO_HISTORY: DemoHandlers = {
  "/documents/d-notes/revisions": [],
  "/documents/d-notes": DOC_NOTES,
};
const BINARY: DemoHandlers = {
  "/documents/d-contract/revisions": [
    { ...REVISION_HEAD, document_id: DOC_CONTRACT.id },
  ],
  "/documents/d-contract": DOC_CONTRACT,
};

function History(props: {
  handlers: DemoHandlers;
  documentId: string;
}): ReactElement {
  return (
    <DocsDemoHarness handlers={props.handlers}>
      <RevisionsModal documentId={props.documentId} open onClose={() => undefined} />
    </DocsDemoHarness>
  );
}

export default defineDemo({
  id: "docs.revisions",
  title: "Version history",
  description:
    "A bottom sheet on a phone and a centred modal above the tablet breakpoint, with the list and the preview stacking on a narrow one. Rollback is switched off on the revision the document is already at — restoring it would write a byte-identical head and a history entry saying nothing happened — and the reason is beside the button, because a disabled control receives no pointer events.",
  component: RevisionsModal,
  covers: ["RevisionHistory"],
  variants: {
    default: {
      viewport: "phone",
      step: "history",
      description: "Two revisions; the head's rollback is off with its reason.",
      render: () => <History handlers={HISTORY} documentId={DOC_NOTES.id} />,
    },
    desktop: {
      viewport: "desktop",
      step: "history-wide",
      description: "The modal: list beside preview.",
      render: () => <History handlers={HISTORY} documentId={DOC_NOTES.id} />,
    },
    empty: {
      viewport: "phone",
      step: "empty",
      description: "A document nobody has saved twice yet.",
      render: () => <History handlers={NO_HISTORY} documentId={DOC_NOTES.id} />,
    },
    binary: {
      viewport: "phone",
      step: "binary",
      description: "A binary document's revisions offer a download, not a garbled preview.",
      render: () => <History handlers={BINARY} documentId={DOC_CONTRACT.id} />,
    },
  },
});
