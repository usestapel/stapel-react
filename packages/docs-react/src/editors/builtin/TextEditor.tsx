import type { ReactElement } from "react";
import type { DocEditorAdapterProps } from "../registry.js";

/**
 * Builtin editor for `editor_hint: "text"` — controlled `<textarea>`
 * semantics over the DocEditor bag, completely unstyled (zero visual
 * opinion; style via the `data-doc-editor` attribute or replace the whole
 * component with `registerDocEditor("text", …)`). Saving, dirty state, and
 * conflict handling stay in the bag — this component only edits the value.
 */
export function TextEditor(props: DocEditorAdapterProps): ReactElement {
  return (
    <textarea
      data-doc-editor="text"
      value={props.bag.value}
      readOnly={props.readOnly ?? false}
      disabled={props.bag.isLoading}
      onChange={(event) => {
        props.bag.setValue(event.target.value);
      }}
    />
  );
}
