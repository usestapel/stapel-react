/** The document route: the editor for the type, or an honest refusal. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DocSurface } from "../src/default/index.js";
import { DocsDemoHarness, textBody } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DOC_COLLAB,
  DOC_CONTRACT,
  DOC_NOTES,
  MARKDOWN_BODY,
} from "./fixtures.js";

const MARKDOWN: DemoHandlers = {
  "/documents/d-notes/content": textBody(MARKDOWN_BODY, 7, "text/markdown"),
  "/documents/d-notes": DOC_NOTES,
};
const COLLAB: DemoHandlers = { "/documents/d-collab": DOC_COLLAB };
const BINARY: DemoHandlers = {
  "/documents/d-contract/download": { url: "https://cdn.demo.invalid/signed" },
  "/documents/d-contract": DOC_CONTRACT,
};
const GONE: DemoHandlers = {
  "/documents/d-notes": [404, { code: "error.404.not_found" }],
};

function Surface(props: {
  handlers: DemoHandlers;
  documentId: string;
}): ReactElement {
  return (
    <DocsDemoHarness handlers={props.handlers}>
      <DocSurface documentId={props.documentId} />
    </DocsDemoHarness>
  );
}

export default defineDemo({
  id: "docs.document",
  title: "Document",
  description:
    "The resolution ladder: an explicitly registered editor, then the skin's default for the hint, then the unstyled builtin, then the file card. The crdt variant is the guard this pair was missing — a type whose write discipline is the update journal must not be handed a snapshot Save the wire would refuse, so it gets a stated reason and its bytes.",
  component: DocSurface,
  covers: ["DocEditor"],
  variants: {
    default: {
      viewport: "phone",
      step: "markdown-loaded",
      description: "A markdown document on the If-Match snapshot path.",
      render: () => <Surface handlers={MARKDOWN} documentId={DOC_NOTES.id} />,
    },
    "download-only": {
      viewport: "phone",
      step: "file",
      description: "editor_hint '' — the file card, with the download.",
      render: () => <Surface handlers={BINARY} documentId={DOC_CONTRACT.id} />,
    },
    "crdt-unsupported": {
      viewport: "phone",
      step: "collab-unsupported",
      description: "A crdt-discipline type with no registered collaborative editor.",
      render: () => <Surface handlers={COLLAB} documentId={DOC_COLLAB.id} />,
    },
    "not-found": {
      viewport: "desktop",
      step: "failed",
      description: "The head read answered 404 — the sentence and a retry.",
      render: () => <Surface handlers={GONE} documentId={DOC_NOTES.id} />,
    },
  },
});
