import type { ReactElement } from "react";
import type { DocEditorAdapterProps } from "../registry.js";

/**
 * Builtin editor for `editor_hint: "markdown"` — markdown SOURCE editing with
 * controlled `<textarea>` semantics, deliberately WITHOUT a preview: a
 * renderer would be a dependency and a visual opinion, and this pair ships
 * neither (repo canon). A host that wants preview registers its own component
 * (`registerDocEditor("markdown", …)`) or composes one next to this textarea
 * from the same bag value. Kept separate from `TextEditor` so one hint can be
 * overridden without the other.
 */
export function MarkdownEditor(props: DocEditorAdapterProps): ReactElement {
  return (
    <textarea
      data-doc-editor="markdown"
      value={props.bag.value}
      readOnly={props.readOnly ?? false}
      disabled={props.bag.isLoading}
      onChange={(event) => {
        props.bag.setValue(event.target.value);
      }}
    />
  );
}
