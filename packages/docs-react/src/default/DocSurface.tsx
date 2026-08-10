/**
 * `<DocSurface/>` — the default skin's document view: reads the head
 * (`useDocument`), resolves the editing surface for its `editor_hint`, and
 * renders it under the `DocEditor` bag (If-Match snapshot discipline).
 *
 * Resolution ladder (each rung a no-fork seam):
 *   1. an EXPLICIT `registerDocEditor(hint, …)` registration — the host
 *      swapped the editor globally; the skin never shadows that;
 *   2. the skin's chrome-styled default for the hint (the
 *      `"editor.text" | "editor.markdown" | "editor.csv"` slots);
 *   3. the unstyled builtin from the editor registry (a custom hint some
 *      module registered only as a builtin-level component);
 *   4. the `fileCard` slot — download/preview (`editor_hint: ""`, unknown
 *      hints, binary uploads). Degrade to a file, never to a crash.
 *
 * Self-themed via `DocsSkinTheme`.
 */
import type { ReactElement } from "react";
import { Spin } from "antd";
import { useErrorDisplay } from "@stapel/core";
import type { ThemeMode } from "@stapel/tokens-antd";
import { DocEditor } from "../headless/DocEditor.js";
import { explicitDocEditor, resolveDocEditor } from "../editors/registry.js";
import type { DocEditorComponent } from "../editors/registry.js";
import { useDocument } from "../model/queries.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";
import { DocsSkinTheme } from "./theme.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { resolveDocsSkinComponent } from "./slots.js";

export interface DocSurfaceProps {
  readonly documentId: string;
  readonly readOnly?: boolean;
  /** Light or dark; defaults to the host document's declared mode. */
  readonly mode?: ThemeMode;
}

const SKIN_EDITOR_SLOTS = {
  text: "editor.text",
  markdown: "editor.markdown",
  csv: "editor.csv",
} as const;

function surfaceFor(hint: string): DocEditorComponent | null {
  const explicit = explicitDocEditor(hint);
  if (explicit) return explicit;
  const slot =
    hint in SKIN_EDITOR_SLOTS
      ? SKIN_EDITOR_SLOTS[hint as keyof typeof SKIN_EDITOR_SLOTS]
      : null;
  if (slot !== null) return resolveDocsSkinComponent(slot);
  return resolveDocEditor(hint);
}

export function DocSurface(props: DocSurfaceProps): ReactElement {
  const errorDisplay = useErrorDisplay(DOCS_I18N_KEYS.unknownError);
  const documentQuery = useDocument(props.documentId);
  const Card = resolveDocsSkinComponent("fileCard");

  const themeProps = props.mode !== undefined ? { mode: props.mode } : {};

  if (documentQuery.isLoading) {
    return (
      <DocsSkinTheme {...themeProps}>
        <Spin data-testid="docs-surface-loading" />
      </DocsSkinTheme>
    );
  }
  if (documentQuery.isError || documentQuery.data === undefined) {
    return (
      <DocsSkinTheme {...themeProps}>
        <ErrorAlert
          error={errorDisplay(documentQuery.error)}
          testId="docs-surface-error"
        />
      </DocsSkinTheme>
    );
  }

  const doc = documentQuery.data;
  const Editor = surfaceFor(doc.editor_hint);

  return (
    <DocsSkinTheme {...themeProps}>
      {Editor === null ? (
        <Card documentId={doc.id} />
      ) : (
        <DocEditor documentId={doc.id}>
          {(bag) => (
            <Editor
              bag={bag}
              {...(props.readOnly !== undefined
                ? { readOnly: props.readOnly }
                : {})}
            />
          )}
        </DocEditor>
      )}
    </DocsSkinTheme>
  );
}
