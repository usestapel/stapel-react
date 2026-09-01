/**
 * One call that gives the default skin the real editors.
 *
 * The skin's own defaults are textareas on purpose (see `editors.tsx`): a
 * default that dragged a WYSIWYG dependency in would not be a default, it
 * would be a decision. The lazy engines are the opposite choice made
 * explicitly, by a host, at startup — and this helper is the two-line version
 * of it, with the skin's chrome kept.
 *
 * ```ts
 * import { registerDocsRichEditors } from "@stapel/docs-react/default";
 * registerDocsRichEditors();
 * ```
 *
 * What it does: registers Milkdown (WYSIWYG, with CodeMirror source mode) for
 * `"markdown"` and CodeMirror for `"text"`, each wrapped in `EditorChrome`, so
 * save / dirty / conflict-override stay exactly where they were. Registration
 * is the registry's own seam, so `DocSurface`'s ladder picks these up ahead of
 * the skin defaults with no other change — and with the optional peers not
 * installed, each surface degrades to the textarea it replaced, under a
 * sentence saying why.
 *
 * Nothing here is imported by the skin itself: a host that never calls this
 * pays for none of it, and the engine packages are still fetched with
 * `import()` only when a surface mounts.
 */
import { registerCodeMirrorDocEditors } from "../editors/codemirror/register.js";
import type { RegisterCodeMirrorOptions } from "../editors/codemirror/register.js";
import { registerMilkdownDocEditor } from "../editors/milkdown/register.js";
import type { RegisterMilkdownOptions } from "../editors/milkdown/register.js";
import { EditorChrome } from "./editors.js";

/** Options of {@link registerDocsRichEditors}. */
export interface RegisterDocsRichEditorsOptions {
  /** Register CodeMirror for `"text"`. Default true. */
  readonly text?: boolean;
  /** Register Milkdown (WYSIWYG + source mode) for `"markdown"`. Default true;
   * `false` registers CodeMirror there instead — markdown SOURCE editing,
   * byte-stable, for a product whose documents are machine-written. */
  readonly markdownWysiwyg?: boolean;
  /** Test/demo seams, forwarded to the engine loaders. */
  readonly codeMirror?: Omit<RegisterCodeMirrorOptions, "wrap" | "hints">;
  readonly milkdown?: Omit<RegisterMilkdownOptions, "wrap" | "hint">;
}

/** Register the lazy engines for the skin's editor hints. Returns the hints it
 * claimed, so a test can undo them with `unregisterDocEditor`. */
export function registerDocsRichEditors(
  options: RegisterDocsRichEditorsOptions = {}
): readonly string[] {
  const claimed: string[] = [];
  if (options.text ?? true) {
    claimed.push(
      ...registerCodeMirrorDocEditors({
        wrap: EditorChrome,
        hints: ["text"],
        ...(options.codeMirror ?? {}),
      })
    );
  }
  if (options.markdownWysiwyg ?? true) {
    claimed.push(
      registerMilkdownDocEditor({ wrap: EditorChrome, ...(options.milkdown ?? {}) })
    );
  } else {
    claimed.push(
      ...registerCodeMirrorDocEditors({
        wrap: EditorChrome,
        hints: ["markdown"],
        ...(options.codeMirror ?? {}),
      })
    );
  }
  return claimed;
}
