/**
 * `@stapel/docs-react/editors/milkdown` — the markdown WYSIWYG surface, behind
 * an OPTIONAL peer and a dynamic `import()`, with CodeMirror as its source
 * mode and its fallback.
 *
 * ```ts
 * // once, at startup:
 * import { registerMilkdownDocEditor } from "@stapel/docs-react/editors/milkdown";
 * import { EditorChrome } from "@stapel/docs-react/default"; // optional
 *
 * registerMilkdownDocEditor({ wrap: EditorChrome });
 * ```
 *
 * ```sh
 * pnpm add @milkdown/crepe @codemirror/state @codemirror/view @codemirror/lang-markdown
 * # and, in the host's entry, once:
 * #   import "@milkdown/crepe/theme/common/style.css";
 * #   import "@milkdown/crepe/theme/frame.css";
 * ```
 *
 * **Round-trip caveat:** markdown is Milkdown's native serialization format,
 * but remark NORMALIZES on the way out — `serialize ∘ parse` is semantic, not
 * byte-stable. A machine-written document saved from the rich surface comes
 * back the same document and a different file (list markers, escapes, the
 * trailing newline). Source mode — one click away, CodeMirror — is byte-stable
 * and is the right surface for machine-written documents.
 */
export {
  MILKDOWN_PEER,
  MILKDOWN_THEME_IMPORTS,
  MilkdownDocEditor,
  createMilkdownDocEditor,
  loadMilkdown,
} from "./MilkdownEditor.js";
export type {
  MilkdownDocEditorOptions,
  MilkdownLoader,
  MilkdownModule,
  MilkdownStatus,
} from "./MilkdownEditor.js";
export { registerMilkdownDocEditor } from "./register.js";
export type { RegisterMilkdownOptions } from "./register.js";
