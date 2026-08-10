/**
 * The editor registry — THE customer seam of this pair. A document declares
 * which editing surface it wants via `editor_hint` (`DocDocument.editor_hint`,
 * an open backend registry: customer modules add document types without
 * touching stapel-docs); the host resolves the hint here and renders the
 * component with the `DocEditor` bag. Adding an editor for a new type is a
 * REGISTRATION, not a fork:
 *
 * ```tsx
 * registerDocEditor("whiteboard", MyWhiteboardEditor); // at startup
 * // …
 * const Editor = resolveDocEditor(doc.editor_hint);
 * return Editor
 *   ? <DocEditor documentId={doc.id}>{(bag) => <Editor bag={bag} />}</DocEditor>
 *   : <MediaViewer documentId={doc.id}>{…download-only…}</MediaViewer>;
 * ```
 *
 * Resolution order: explicit registration > builtin > `null`. `null` means
 * download-only presentation (`MediaViewer`) — an unknown type degrades to a
 * file, never to a crash. Builtins cover `"text"`, `"markdown"`, `"csv"` —
 * all snapshot documents saved through the If-Match discipline; an explicit
 * `registerDocEditor("text", …)` overrides the builtin without forking.
 */
import type { ComponentType } from "react";
import type { DocEditorBag } from "../headless/DocEditor.js";
import { TextEditor } from "./builtin/TextEditor.js";
import { MarkdownEditor } from "./builtin/MarkdownEditor.js";
import { CsvEditor } from "./builtin/CsvEditor.js";

/** What every registered editor receives — the full editing bag (value,
 * save/If-Match discipline, conflict + override) from `<DocEditor>`. */
export interface DocEditorAdapterProps {
  readonly bag: DocEditorBag;
  readonly readOnly?: boolean;
}

export type DocEditorComponent = ComponentType<DocEditorAdapterProps>;

const registered = new Map<string, DocEditorComponent>();

const builtins = new Map<string, DocEditorComponent>([
  ["text", TextEditor],
  ["markdown", MarkdownEditor],
  ["csv", CsvEditor],
]);

/**
 * Register (or override) the editor for an `editor_hint`. Call at startup,
 * before the first resolve — the registry is module-global, like the i18n
 * bundle registration.
 */
export function registerDocEditor(
  hint: string,
  component: DocEditorComponent
): void {
  registered.set(hint, component);
}

/** Remove an explicit registration (the builtin, if any, resolves again). */
export function unregisterDocEditor(hint: string): void {
  registered.delete(hint);
}

/**
 * Resolve an `editor_hint` to its editor: explicit registration > builtin >
 * `null` (= download-only presentation; render `MediaViewer`).
 */
export function resolveDocEditor(hint: string): DocEditorComponent | null {
  return registered.get(hint) ?? builtins.get(hint) ?? null;
}

/** Every hint that currently resolves (explicit + builtin), sorted. */
export function registeredDocEditorHints(): readonly string[] {
  return [...new Set([...registered.keys(), ...builtins.keys()])].sort();
}
