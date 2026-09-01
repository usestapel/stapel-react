/**
 * CodeMirror 6 as a docs editor — `txt` outright, and the SOURCE mode of the
 * markdown surface (editors research §1.3).
 *
 * Three rules this module exists to keep:
 *
 * 1. **Nothing here reaches the pair's main entry.** `@codemirror/*` are
 *    OPTIONAL peers, this file lives behind the `@stapel/docs-react/editors/
 *    codemirror` subpath, and the packages themselves are fetched with a
 *    dynamic `import()` at mount. The main entry's 12 KB budget never sees a
 *    byte of an editor engine; `size-limit` and `test/lazyEditors.test.tsx`
 *    both hold that line.
 * 2. **Byte stability.** CodeMirror edits the raw string — the document model
 *    IS the text — so a machine-written document opened and closed untouched
 *    is the same file. See `source.ts` for the contract and its test.
 * 3. **Absence is a designed screen, not a crash.** With the peers not
 *    installed the surface renders the pair's own plain-textarea builtin under
 *    a sentence saying why (the `CallStage`/`livekit-client` precedent). The
 *    document stays editable and savable through the very same bag.
 *
 * The engine carries NO chrome: save, the dirty marker, the conflict banner
 * belong to the skin. Pass `/default`'s `EditorChrome` as `wrap` to get them
 * (`registerCodeMirrorDocEditors({ wrap: EditorChrome })`), or leave it out
 * for a bare surface a host chromes itself.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useT } from "@stapel/core";
import type {
  DocEditorAdapterProps,
  DocEditorComponent,
  DocEditorWrap,
} from "../registry.js";
import { TextEditor } from "../builtin/TextEditor.js";
import { MarkdownEditor } from "../builtin/MarkdownEditor.js";
import { importOptionalPeer, isOptionalPeerMissing } from "../optionalPeer.js";
import { DOCS_I18N_KEYS } from "../../i18n/keys.js";

/** The optional peers this surface loads. `lang-markdown` is the only one that
 * may legitimately be absent on its own: without it the surface is still a
 * correct plain-text editor, just unhighlighted. */
export const CODEMIRROR_PEERS: {
  readonly state: "@codemirror/state";
  readonly view: "@codemirror/view";
  readonly langMarkdown: "@codemirror/lang-markdown";
} = {
  state: "@codemirror/state",
  view: "@codemirror/view",
  langMarkdown: "@codemirror/lang-markdown",
};

/** Every specifier this surface may fail to resolve — what the "is it just
 * not installed?" check matches against. */
export const CODEMIRROR_PEER_NAMES: readonly string[] = [
  CODEMIRROR_PEERS.state,
  CODEMIRROR_PEERS.view,
  CODEMIRROR_PEERS.langMarkdown,
];

// ── the sliver of CodeMirror this module touches ────────────────────────────
// Structural types, not `import type` from the packages: the peers are
// optional, so the build must typecheck on a machine that never installed
// them (the `CallStage` convention).

interface CmDocLike {
  readonly length: number;
  toString(): string;
}
interface CmStateLike {
  readonly doc: CmDocLike;
}
interface CmViewUpdateLike {
  readonly docChanged: boolean;
  readonly state: CmStateLike;
}
interface CmViewLike {
  readonly state: CmStateLike;
  dispatch(transaction: unknown): void;
  destroy(): void;
}
interface CmViewCtor {
  new (config: { state: unknown; parent: HTMLElement }): CmViewLike;
  readonly updateListener: { of(fn: (update: CmViewUpdateLike) => void): unknown };
  readonly editable: { of(value: boolean): unknown };
  readonly lineWrapping: unknown;
}
interface CmStateStatic {
  create(config: { doc: string; extensions?: unknown[] }): unknown;
}

/** What {@link CodeMirrorLoader} must resolve to. */
export interface CodeMirrorModules {
  readonly state: { readonly EditorState: CmStateStatic };
  readonly view: { readonly EditorView: CmViewCtor };
  /** `@codemirror/lang-markdown`, when installed. */
  readonly langMarkdown?: { readonly markdown?: () => unknown } | undefined;
}

/** Load the optional peers. Injectable so a test — and a demo — drives every
 * arm, including the one where the packages are not installed. */
export type CodeMirrorLoader = () => Promise<CodeMirrorModules>;

/** The real loader: three dynamic imports, no static reference anywhere. */
export const loadCodeMirror: CodeMirrorLoader = async (): Promise<CodeMirrorModules> => {
  const [state, view] = await Promise.all([
    importOptionalPeer(CODEMIRROR_PEERS.state),
    importOptionalPeer(CODEMIRROR_PEERS.view),
  ]);
  // Highlighting is a nicety; a missing language package must not cost the
  // document its editor.
  const langMarkdown = await importOptionalPeer(CODEMIRROR_PEERS.langMarkdown).catch(
    () => undefined
  );
  return {
    state,
    view,
    langMarkdown,
  } as CodeMirrorModules;
};

/** Where the engine got to. `missing` is a first-class arm, not an error. */
export type CodeMirrorStatus = "loading" | "ready" | "missing" | "failed";

/** Options of {@link createCodeMirrorDocEditor}. */
export interface CodeMirrorDocEditorOptions {
  /** `"markdown"` loads `@codemirror/lang-markdown` for highlighting;
   * `"none"` (default for the `"text"` hint) stays plain. */
  readonly language?: "markdown" | "none";
  /** Chrome to render the surface inside — `/default`'s `EditorChrome`. */
  readonly wrap?: DocEditorWrap;
  /** Test/demo seam: replaces the `import("@codemirror/…")` calls. */
  readonly loadPeer?: CodeMirrorLoader;
  /** Value of the surface's `data-doc-editor` attribute (the hook every skin
   * and test styles/queries by). Defaults to the language. */
  readonly testAttribute?: string;
}

/** A module namespace that resolved but carries none of the symbols is the
 * same fact as "not installed" (a stub, a wrong major, a broken mirror) — and
 * it must not become a `TypeError` inside an effect. */
function looksLoaded(modules: CodeMirrorModules | undefined): boolean {
  const loose = modules as
    | {
        view?: { EditorView?: unknown };
        state?: { EditorState?: { create?: unknown } };
      }
    | undefined;
  return (
    typeof loose?.view?.EditorView === "function" &&
    typeof loose.state?.EditorState?.create === "function"
  );
}

/**
 * Build a registrable editor component. Configuration lives HERE, at factory
 * time, and not in props: the registry hands a component only the
 * `DocEditorAdapterProps` bag, and a loader created fresh on every render
 * would re-mount the engine on every keystroke.
 */
export function createCodeMirrorDocEditor(
  options: CodeMirrorDocEditorOptions = {}
): DocEditorComponent {
  const language = options.language ?? "none";
  const load = options.loadPeer ?? loadCodeMirror;
  const Wrap = options.wrap;
  const attribute = options.testAttribute ?? language;
  const Fallback = language === "markdown" ? MarkdownEditor : TextEditor;

  function CodeMirrorDocEditorSurface(props: DocEditorAdapterProps): ReactElement {
    const t = useT();
    const readOnly = props.readOnly ?? false;
    const [status, setStatus] = useState<CodeMirrorStatus>("loading");
    const [modules, setModules] = useState<CodeMirrorModules | null>(null);
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<CmViewLike | null>(null);
    // The bag is rebuilt on every render of `<DocEditor>`, so `setValue` has a
    // new identity each time; the CodeMirror update listener is installed once
    // and must always reach the CURRENT one.
    const bagRef = useRef({ value: props.bag.value, setValue: props.bag.setValue });
    // True while THIS component is writing an external value into the view.
    // Without it the resulting `docChanged` bounces back through `setValue` and
    // the document is marked dirty by the act of loading it.
    const syncingRef = useRef(false);

    useEffect(() => {
      bagRef.current = { value: props.bag.value, setValue: props.bag.setValue };
    });

    useEffect(() => {
      let cancelled = false;
      setStatus("loading");
      void (async (): Promise<void> => {
        try {
          const loaded = await load();
          if (cancelled) return;
          if (!looksLoaded(loaded)) {
            setStatus("missing");
            return;
          }
          setModules(loaded);
          setStatus("ready");
        } catch (thrown) {
          if (cancelled) return;
          setStatus(
            isOptionalPeerMissing(thrown, CODEMIRROR_PEER_NAMES) ? "missing" : "failed"
          );
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    // Mount the view once the engine is here. `readOnly` is a dependency on
    // purpose: reconfiguring a compartment for a flag that flips about once
    // per document is more machinery than a re-mount is worth.
    useEffect(() => {
      const host = hostRef.current;
      if (modules === null || host === null) return undefined;
      const { EditorState } = modules.state;
      const { EditorView } = modules.view;
      const extensions: unknown[] = [
        EditorView.lineWrapping,
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of((update: CmViewUpdateLike) => {
          if (!update.docChanged || syncingRef.current) return;
          bagRef.current.setValue(update.state.doc.toString());
        }),
      ];
      const markdown = modules.langMarkdown?.markdown;
      if (language === "markdown" && typeof markdown === "function") {
        extensions.push(markdown());
      }
      const view = new EditorView({
        state: EditorState.create({ doc: bagRef.current.value, extensions }),
        parent: host,
      });
      viewRef.current = view;
      return () => {
        viewRef.current = null;
        view.destroy();
      };
    }, [modules, readOnly]);

    // Adopt a value that changed OUTSIDE the editor (first load, reload, an
    // override save, a source/rich-mode switch). A value the editor itself
    // just produced is already in the document — comparing before dispatching
    // is what keeps this from fighting the user's cursor.
    useEffect(() => {
      const view = viewRef.current;
      if (view === null) return;
      const current = view.state.doc.toString();
      if (current === props.bag.value) return;
      syncingRef.current = true;
      try {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: props.bag.value },
        });
      } finally {
        syncingRef.current = false;
      }
    }, [props.bag.value, status]);

    const body =
      status === "ready" ? (
        <div
          ref={hostRef}
          data-doc-editor={attribute}
          data-doc-editor-engine="codemirror"
          data-testid="docs-editor-codemirror"
        />
      ) : status === "loading" ? (
        <p data-doc-editor-engine="loading" data-testid="docs-editor-engine-loading">
          {t(DOCS_I18N_KEYS.editorEngineLoading)}
        </p>
      ) : (
        <div data-doc-editor-engine={status}>
          <p data-testid="docs-editor-engine-absent">
            {t(
              status === "missing"
                ? DOCS_I18N_KEYS.editorEngineMissing
                : DOCS_I18N_KEYS.editorEngineFailed
            )}
          </p>
          <Fallback bag={props.bag} readOnly={readOnly} />
        </div>
      );

    return Wrap === undefined ? body : <Wrap bag={props.bag}>{body}</Wrap>;
  }

  return CodeMirrorDocEditorSurface;
}

/** The plain-text surface (`editor_hint: "text"`), unchromed. */
export const CodeMirrorDocEditor: DocEditorComponent = createCodeMirrorDocEditor();

/** The markdown-source surface (`editor_hint: "markdown"`), unchromed — also
 * what the Milkdown surface switches to in source mode. */
export const CodeMirrorMarkdownDocEditor: DocEditorComponent =
  createCodeMirrorDocEditor({ language: "markdown", testAttribute: "markdown" });
