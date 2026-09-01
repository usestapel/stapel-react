/**
 * Registration for the Milkdown surface — the whole integration surface of
 * this module. Claims `editor_hint: "markdown"` (the backend's builtin hint;
 * `"md"` is not a hint stapel-docs emits).
 */
import { registerDocEditor } from "../registry.js";
import type { DocEditorWrap } from "../registry.js";
import { createMilkdownDocEditor } from "./MilkdownEditor.js";
import type { MilkdownLoader } from "./MilkdownEditor.js";
import type { CodeMirrorLoader } from "../codemirror/CodeMirrorEditor.js";

/** Options of {@link registerMilkdownDocEditor}. */
export interface RegisterMilkdownOptions {
  /** Chrome to render the surface inside — `/default`'s `EditorChrome`. */
  readonly wrap?: DocEditorWrap;
  /** The hint to claim. Default `"markdown"`. */
  readonly hint?: string;
  /** Start in byte-stable source mode rather than rich mode. */
  readonly defaultSourceMode?: boolean;
  /** Hide the rich/source switch. */
  readonly hideModeSwitch?: boolean;
  /** Test/demo seam: replaces the `import("@milkdown/crepe")`. */
  readonly loadPeer?: MilkdownLoader;
  /** Test/demo seam for the source mode's `import("@codemirror/…")`. */
  readonly loadCodeMirrorPeer?: CodeMirrorLoader;
}

/**
 * Register the Milkdown WYSIWYG for the markdown hint. Call once at startup,
 * before the first resolve. Returns the hint it claimed, so a test can undo it
 * with `unregisterDocEditor`.
 */
export function registerMilkdownDocEditor(
  options: RegisterMilkdownOptions = {}
): string {
  const hint = options.hint ?? "markdown";
  registerDocEditor(
    hint,
    createMilkdownDocEditor({
      ...(options.wrap !== undefined ? { wrap: options.wrap } : {}),
      ...(options.defaultSourceMode !== undefined
        ? { defaultSourceMode: options.defaultSourceMode }
        : {}),
      ...(options.hideModeSwitch !== undefined
        ? { hideModeSwitch: options.hideModeSwitch }
        : {}),
      ...(options.loadPeer !== undefined ? { loadPeer: options.loadPeer } : {}),
      ...(options.loadCodeMirrorPeer !== undefined
        ? { loadCodeMirrorPeer: options.loadCodeMirrorPeer }
        : {}),
    })
  );
  return hint;
}
