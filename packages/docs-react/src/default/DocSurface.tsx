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
 * ── The crdt guard ────────────────────────────────────────────────────────
 *
 * A document's TYPE fixes its write discipline (`DocumentPresenterDTO.collab`
 * — `"crdt"` or `"snapshot"`). Snapshot types save whole states under
 * `If-Match`; crdt types accumulate an update journal, and the backend
 * refuses journal writes for the wrong discipline
 * (`error.400.docs_updates_not_crdt`) exactly as it refuses a content PUT for
 * a type whose body is not mutable that way. Every v1 builtin is snapshot, so
 * the box needs no crdt editor — but a host registering a crdt type is the
 * documented extension seam, and mounting a snapshot editor on it would offer
 * a Save that the wire cannot honour. So a crdt document with no explicitly
 * registered editor gets a stated reason instead of a broken one, and the
 * seam is named in it.
 *
 * Self-themed via `SkinTheme`.
 */
import type { ReactElement } from "react";
import { Flex } from "antd";
import { EmptyState, LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import { loadStateFromQuery, useT } from "@stapel/core";
import type { ThemeMode } from "@stapel/tokens-antd";
import { DocEditor } from "../headless/DocEditor.js";
import { explicitDocEditor, resolveDocEditor } from "../editors/registry.js";
import type { DocEditorComponent } from "../editors/registry.js";
import { useDocument } from "../model/queries.js";
import type { DocDocument } from "../api/types.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";
import { resolveDocsSkinComponent } from "./slots.js";

export interface DocSurfaceProps {
  readonly documentId: string;
  readonly readOnly?: boolean;
  /** Light or dark; defaults to the host document's live declared mode. */
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
  const t = useT();
  const documentQuery = useDocument(props.documentId);
  const Card = resolveDocsSkinComponent("fileCard");
  const themeProps = props.mode !== undefined ? { mode: props.mode } : {};

  function body(doc: DocDocument): ReactElement {
    // The host's own editor for the hint outranks everything, including the
    // discipline guard — a registered crdt editor IS the collaborative path.
    const explicit = explicitDocEditor(doc.editor_hint);
    if (explicit === null && doc.collab === "crdt") {
      return (
        <Flex vertical gap="small">
          <EmptyState
            compact
            title={t(DOCS_I18N_KEYS.editorCollabUnsupported)}
            hint={t(DOCS_I18N_KEYS.editorCollabUnsupportedHint)}
            testId="docs-surface-collab-unsupported"
          />
          {/* The bytes are still readable: a document nobody can edit here
              is not a document nobody can have. */}
          <Card documentId={doc.id} />
        </Flex>
      );
    }
    const Editor = explicit ?? surfaceFor(doc.editor_hint);
    if (Editor === null) return <Card documentId={doc.id} />;
    return (
      <DocEditor documentId={doc.id}>
        {(bag) => (
          <Editor
            bag={bag}
            {...(props.readOnly !== undefined ? { readOnly: props.readOnly } : {})}
          />
        )}
      </DocEditor>
    );
  }

  return (
    <SkinTheme {...themeProps} data-testid="docs-surface">
      <LoadBoundary
        state={loadStateFromQuery(documentQuery)}
        onRetry={() => {
          void documentQuery.refetch();
        }}
        testId="docs-surface"
      >
        {body}
      </LoadBoundary>
    </SkinTheme>
  );
}
