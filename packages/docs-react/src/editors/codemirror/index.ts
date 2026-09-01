/**
 * `@stapel/docs-react/editors/codemirror` — the CodeMirror 6 editing surface,
 * behind OPTIONAL peers and a dynamic `import()`.
 *
 * ```ts
 * // once, at startup:
 * import { registerCodeMirrorDocEditors } from "@stapel/docs-react/editors/codemirror";
 * import { EditorChrome } from "@stapel/docs-react/default"; // optional
 *
 * registerCodeMirrorDocEditors({ wrap: EditorChrome });
 * ```
 *
 * ```sh
 * pnpm add @codemirror/state @codemirror/view @codemirror/lang-markdown
 * ```
 *
 * Without those packages nothing breaks: the surface renders the pair's plain
 * builtin under a sentence that says the engine is not installed, and the
 * document is still edited and saved through the same If-Match bag.
 */
export {
  CODEMIRROR_PEERS,
  CODEMIRROR_PEER_NAMES,
  CodeMirrorDocEditor,
  CodeMirrorMarkdownDocEditor,
  createCodeMirrorDocEditor,
  loadCodeMirror,
} from "./CodeMirrorEditor.js";
export type {
  CodeMirrorDocEditorOptions,
  CodeMirrorLoader,
  CodeMirrorModules,
  CodeMirrorStatus,
} from "./CodeMirrorEditor.js";
export { isByteStable, parseDocSource, serializeDocSource } from "./source.js";
export { registerCodeMirrorDocEditors } from "./register.js";
export type { RegisterCodeMirrorOptions } from "./register.js";
