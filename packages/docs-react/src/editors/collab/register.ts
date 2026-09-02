/**
 * Registration — the whole integration surface of this module, the
 * `registerCodeMirrorDocEditors` pattern verbatim.
 *
 * Which hints: the backend's builtin yjs-codec types are `ymd` ("Markdown
 * (live)") and `ytxt` ("Plain text (live)") with `editor_hint`
 * `"markdown.crdt"` and `"text.crdt"` (`doc_types.py` at the pinned v0.7.0
 * contract). An EXPLICIT registration is what `/default`'s `DocSurface`
 * resolves first — and for a crdt document it is also what stands the
 * skin's discipline guard down ("a registered crdt editor IS the
 * collaborative path"), so this one call is the entire opt-in.
 *
 * This helper is NOT folded into `registerDocsRichEditors` on purpose: that
 * helper lives in `/default` and its two engines are snapshot editors under
 * the skin's `EditorChrome`; pulling the collab wrapper (session + stream
 * hook) into the skin bundle would tax every host that never opens a live
 * document. The collab surface is its own subpath, its own budget, its own
 * single call.
 */
import { registerDocEditor } from "../registry.js";
import type { DocEditorWrap } from "../registry.js";
import type { CodeMirrorLoader } from "../codemirror/CodeMirrorEditor.js";
import { createCollabDocEditor } from "./CollabEditor.js";
import type { CollabPeersLoader } from "./yjsPeer.js";
import type { YDocSession } from "./session.js";

/** The hints {@link registerCollabDocEditors} claims by default. */
export const COLLAB_DEFAULT_HINTS: readonly string[] = [
  "markdown.crdt",
  "text.crdt",
];

/** Options of {@link registerCollabDocEditors}. */
export interface RegisterCollabOptions {
  /** Chrome to render each surface inside. NOTE: not the snapshot
   * `EditorChrome` — see `CollabDocEditorOptions.wrap`. */
  readonly wrap?: DocEditorWrap;
  /** Hints to register for. Default {@link COLLAB_DEFAULT_HINTS};
   * `*.crdt` hints ending in `markdown.crdt` get markdown highlighting. */
  readonly hints?: readonly string[];
  /** Local-edit debounce before a batch POSTs. */
  readonly debounceMs?: number;
  /** Poll tempo when this deployment serves no socket. */
  readonly fallbackRefetchInterval?: number;
  /** Test/demo seam: replaces the yjs / y-codemirror.next imports. */
  readonly loadPeer?: CollabPeersLoader;
  /** Test/demo seam: replaces the `import("@codemirror/…")` calls. */
  readonly loadCodeMirrorPeer?: CodeMirrorLoader;
  /** Test/demo seam: observe each surface's session. */
  readonly onSession?: (session: YDocSession) => void;
}

/**
 * Register the live co-editing surface for the yjs-codec builtin hints. Call
 * once at startup, before the first resolve — the registry is module-global.
 * Returns the hints it claimed, so a caller can undo them
 * (`unregisterDocEditor`) in a test.
 */
export function registerCollabDocEditors(
  options: RegisterCollabOptions = {}
): readonly string[] {
  const hints = options.hints ?? COLLAB_DEFAULT_HINTS;
  for (const hint of hints) {
    registerDocEditor(
      hint,
      createCollabDocEditor({
        language: hint === "markdown.crdt" ? "markdown" : "none",
        testAttribute: hint,
        ...(options.wrap !== undefined ? { wrap: options.wrap } : {}),
        ...(options.debounceMs !== undefined
          ? { debounceMs: options.debounceMs }
          : {}),
        ...(options.fallbackRefetchInterval !== undefined
          ? { fallbackRefetchInterval: options.fallbackRefetchInterval }
          : {}),
        ...(options.loadPeer !== undefined ? { loadPeer: options.loadPeer } : {}),
        ...(options.loadCodeMirrorPeer !== undefined
          ? { loadCodeMirrorPeer: options.loadCodeMirrorPeer }
          : {}),
        ...(options.onSession !== undefined ? { onSession: options.onSession } : {}),
      })
    );
  }
  return hints;
}
