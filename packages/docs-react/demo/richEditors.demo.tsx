/**
 * The two OPTIONAL editor engines, in the skin's chrome.
 *
 * Every variant renders a REAL surface: the CodeMirror ones load the real
 * `@codemirror/*` packages with `import()`, and the "not installed" variant
 * forces the arm a host without the peers actually gets — the pair's builtin
 * textarea under a sentence, still saving through the same If-Match bag.
 *
 * The rich variant mounts the real `@milkdown/crepe`. It draws UNSTYLED here
 * on purpose: the pair does not import a stylesheet on a host's behalf (a
 * headless pair does not own anyone's CSS pipeline), so a product adds
 * `@milkdown/crepe/theme/common/style.css` in its own entry — which is exactly
 * what `MILKDOWN_THEME_IMPORTS` names.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { EditorChrome } from "../src/default/index.js";
import { DocEditor } from "../src/index.js";
import { createCodeMirrorDocEditor } from "../src/editors/codemirror/index.js";
import type { CodeMirrorModules } from "../src/editors/codemirror/index.js";
import { createMilkdownDocEditor } from "../src/editors/milkdown/index.js";
import type { DocEditorComponent } from "../src/editors/registry.js";
import { DocsDemoHarness, textBody } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DOC_NOTES, MARKDOWN_BODY } from "./fixtures.js";

const MARKDOWN: DemoHandlers = {
  "/documents/d-notes/content": textBody(MARKDOWN_BODY, 7, "text/markdown"),
  "/documents/d-notes": DOC_NOTES,
};
const TEXT: DemoHandlers = {
  "/documents/d-notes/content": textBody(
    "Ship the wave.\nNothing here is rewritten by opening it.\n",
    7
  ),
  "/documents/d-notes": DOC_NOTES,
};

/** The arm a host that never installed the optional peers gets. */
const NOT_INSTALLED = (): Promise<CodeMirrorModules> =>
  Promise.reject(new Error('Cannot find module "@codemirror/view"'));

const RichMarkdown = createMilkdownDocEditor({ wrap: EditorChrome });
const SourceOnlyMarkdown = createMilkdownDocEditor({
  wrap: EditorChrome,
  loadPeer: () => Promise.reject(new Error('Cannot find module "@milkdown/crepe"')),
});
const CodeMirrorText = createCodeMirrorDocEditor({
  wrap: EditorChrome,
  testAttribute: "text",
});
const EngineMissing = createCodeMirrorDocEditor({
  wrap: EditorChrome,
  testAttribute: "text",
  loadPeer: NOT_INSTALLED,
});

function Editing(props: {
  handlers: DemoHandlers;
  editor: DocEditorComponent;
}): ReactElement {
  const Chosen = props.editor;
  return (
    <DocsDemoHarness handlers={props.handlers}>
      <DocEditor documentId={DOC_NOTES.id}>
        {(bag) => <Chosen bag={bag} />}
      </DocEditor>
    </DocsDemoHarness>
  );
}

export default defineDemo({
  id: "docs.richEditors",
  title: "Rich editors",
  description:
    "CodeMirror 6 and Milkdown as OPTIONAL peers loaded with import(): no editor engine is in the pair's main entry, which is budgeted at 12 KB — a fifth of the lightest WYSIWYG measured. Markdown gets the WYSIWYG with a one-click source mode, because remark normalizes on save (semantic round-trip, not byte-for-byte) and a machine-written document belongs in the byte-stable surface. With the peers absent, every surface degrades to the pair's textarea builtin under a sentence, still saving through the same If-Match bag.",
  component: EditorChrome,
  covers: ["DocEditor"],
  variants: {
    default: {
      viewport: "phone",
      step: "markdown-wysiwyg",
      description:
        "Milkdown (Crepe) editing markdown, in the skin's chrome. Unstyled here: the host imports the Crepe theme in its own entry.",
      render: () => <Editing handlers={MARKDOWN} editor={RichMarkdown} />,
    },
    "markdown-source": {
      viewport: "phone",
      step: "markdown-source",
      description:
        "The source surface — CodeMirror, byte-stable. Also what the markdown hint falls back to when @milkdown/crepe is not installed.",
      render: () => <Editing handlers={MARKDOWN} editor={SourceOnlyMarkdown} />,
    },
    "text-codemirror": {
      viewport: "desktop",
      step: "text-codemirror",
      description: "editor_hint 'text' on CodeMirror: the document model IS the string.",
      render: () => <Editing handlers={TEXT} editor={CodeMirrorText} />,
    },
    "engine-missing": {
      viewport: "phone",
      step: "engine-missing",
      description:
        "The optional peers are not installed: a sentence, the builtin textarea, and a Save that still works.",
      render: () => <Editing handlers={TEXT} editor={EngineMissing} />,
    },
  },
});
