/** The three builtin editors and the chrome they share. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import {
  DefaultCsvEditor,
  DefaultMarkdownEditor,
  DefaultTextEditor,
  EditorChrome,
} from "../src/default/index.js";
import { DocEditor } from "../src/index.js";
import { DocsDemoHarness, textBody } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { CSV_BODY, DOC_BUDGET, DOC_NOTES, MARKDOWN_BODY } from "./fixtures.js";

const TEXT: DemoHandlers = {
  "/documents/d-notes/content": textBody("Ship the wave.\n", 7),
  "/documents/d-notes": DOC_NOTES,
};
const MARKDOWN: DemoHandlers = {
  "/documents/d-notes/content": textBody(MARKDOWN_BODY, 7, "text/markdown"),
  "/documents/d-notes": DOC_NOTES,
};
const CSV: DemoHandlers = {
  "/documents/d-budget/content": textBody(CSV_BODY, 7, "text/csv"),
  "/documents/d-budget": DOC_BUDGET,
};

type Editor = typeof DefaultTextEditor;

function Editing(props: {
  handlers: DemoHandlers;
  documentId: string;
  editor: Editor;
}): ReactElement {
  const Chosen = props.editor;
  return (
    <DocsDemoHarness handlers={props.handlers}>
      <DocEditor documentId={props.documentId}>
        {(bag) => <Chosen bag={bag} />}
      </DocEditor>
    </DocsDemoHarness>
  );
}

export default defineDemo({
  id: "docs.editors",
  title: "Editors",
  description:
    "Every builtin editor rides one EditorChrome: Save (also Ctrl/Cmd-S), the dirty marker, the saving state, the conflict banner with the informed override, and the folded error line. Markdown is a SOURCE editor on purpose — a default that dragged a WYSIWYG dependency in would not be a default, it would be a decision; a host swaps it with registerDocEditor or the editor.markdown slot.",
  component: DefaultTextEditor,
  covers: ["EditorChrome", "DefaultMarkdownEditor", "DefaultCsvEditor", "DocEditor"],
  variants: {
    default: {
      viewport: "phone",
      step: "text-loaded",
      description: "Plain text, saved, nothing dirty.",
      render: () => (
        <Editing handlers={TEXT} documentId={DOC_NOTES.id} editor={DefaultTextEditor} />
      ),
    },
    markdown: {
      viewport: "phone",
      step: "markdown-loaded",
      description: "Markdown source in a monospace field.",
      render: () => (
        <Editing
          handlers={MARKDOWN}
          documentId={DOC_NOTES.id}
          editor={DefaultMarkdownEditor}
        />
      ),
    },
    csv: {
      viewport: "desktop",
      step: "csv-loaded",
      description: "A CSV snapshot as a table of cells: add row / add column / delete row.",
      render: () => (
        <Editing handlers={CSV} documentId={DOC_BUDGET.id} editor={DefaultCsvEditor} />
      ),
    },
  },
});

/** Referenced so the chrome is imported as a value, not only as coverage. */
export const CHROME: typeof EditorChrome = EditorChrome;
