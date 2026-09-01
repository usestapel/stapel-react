/**
 * Registration — the whole integration surface of this module.
 *
 * A host does not fork the pair to get CodeMirror; it registers it for the
 * hints it wants (`registerDocEditor` is merge-over-builtins by design, and an
 * explicit registration is what `/default`'s `DocSurface` resolves FIRST, so
 * the skin never shadows the swap).
 *
 * Which hints: the backend's builtin `editor_hint`s are `"text"`, `"markdown"`
 * and `"csv"` (see `editors/registry.ts` — not `"txt"`/`"md"`, which is what
 * the research note called them). `"csv"` is deliberately left alone: its
 * zero-dependency grid is the better surface for a table, and a source editor
 * over CSV is a regression, not an upgrade. A host that disagrees registers
 * `createCodeMirrorDocEditor()` for `"csv"` itself.
 */
import { registerDocEditor } from "../registry.js";
import type { DocEditorWrap } from "../registry.js";
import { createCodeMirrorDocEditor } from "./CodeMirrorEditor.js";
import type { CodeMirrorLoader } from "./CodeMirrorEditor.js";

/** Options of {@link registerCodeMirrorDocEditors}. */
export interface RegisterCodeMirrorOptions {
  /** Chrome to render each surface inside — pass `/default`'s `EditorChrome`
   * to keep the skin's save button, dirty marker and conflict banner. */
  readonly wrap?: DocEditorWrap;
  /** Hints to register for. Default: `["text", "markdown"]`. */
  readonly hints?: readonly string[];
  /** Test/demo seam: replaces the `import("@codemirror/…")` calls. */
  readonly loadPeer?: CodeMirrorLoader;
}

/** The hints {@link registerCodeMirrorDocEditors} claims by default. */
export const CODEMIRROR_DEFAULT_HINTS: readonly string[] = ["text", "markdown"];

/**
 * Register the CodeMirror surface for the source-shaped builtin hints. Call
 * once at startup, before the first resolve — the registry is module-global.
 * Returns the hints it claimed, so a caller can undo them
 * (`unregisterDocEditor`) in a test.
 */
export function registerCodeMirrorDocEditors(
  options: RegisterCodeMirrorOptions = {}
): readonly string[] {
  const hints = options.hints ?? CODEMIRROR_DEFAULT_HINTS;
  for (const hint of hints) {
    registerDocEditor(
      hint,
      createCodeMirrorDocEditor({
        language: hint === "markdown" ? "markdown" : "none",
        testAttribute: hint,
        ...(options.wrap !== undefined ? { wrap: options.wrap } : {}),
        ...(options.loadPeer !== undefined ? { loadPeer: options.loadPeer } : {}),
      })
    );
  }
  return hints;
}
