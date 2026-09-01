/**
 * Milkdown (Crepe) as the WYSIWYG surface for `editor_hint: "markdown"` —
 * behind an OPTIONAL peer and a dynamic `import()` (editors research §1.3).
 *
 * ── Why Milkdown and not a lighter WYSIWYG ─────────────────────────────────
 *
 * Because markdown is its NATIVE serialization format (remark), not an export
 * path. Every alternative surveyed owns a JSON document model and converts on
 * the way out — Tiptap through a third-party plugin, BlockNote through a
 * function literally named `blocksToMarkdownLossy` — and stapel-docs is written
 * to by services, so a lossy conversion corrupts the source of truth on the
 * first open. `@milkdown/crepe` is the batteries-included build (toolbar,
 * slash menu, block handles); `@milkdown/core` + the commonmark preset is the
 * assemble-it-yourself route, which buys nothing here since the whole thing is
 * behind a lazy peer either way.
 *
 * ── THE CAVEAT, stated where it cannot be missed ───────────────────────────
 *
 * **`serialize ∘ parse` is SEMANTIC here, not byte-stable.** remark normalizes
 * a document on the way out: list markers (`*` → `-`), emphasis delimiters,
 * escaping, setext vs ATX headings, the trailing newline, hard-break spelling.
 * A machine-generated document that a person opens in this surface and saves
 * comes back the same DOCUMENT and a different FILE. Consequences the fleet
 * cares about: knowledge chunking (AST/heading-based) is unaffected; a
 * server-side line diff is — the first WYSIWYG save can look like a rewrite of
 * the whole file.
 *
 * That is why this surface ships a SOURCE mode next to the rich one, and why
 * the source mode is CodeMirror: for a machine-written document that must stay
 * byte-identical, source mode is the correct surface, and it is one click away
 * rather than one fork away. It is also the fallback: with `@milkdown/crepe`
 * absent, this component IS the CodeMirror surface (and, with that absent too,
 * the pair's plain builtin), under a sentence saying why.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useT } from "@stapel/core";
import type {
  DocEditorAdapterProps,
  DocEditorComponent,
  DocEditorWrap,
} from "../registry.js";
import { importOptionalPeer, isOptionalPeerMissing } from "../optionalPeer.js";
import { createCodeMirrorDocEditor } from "../codemirror/CodeMirrorEditor.js";
import type { CodeMirrorLoader } from "../codemirror/CodeMirrorEditor.js";
import { DOCS_I18N_KEYS } from "../../i18n/keys.js";

/** The optional peer this surface loads. */
export const MILKDOWN_PEER = "@milkdown/crepe";

/** Its stylesheet is NOT imported here: a headless pair does not decide a
 * host's CSS pipeline. Import it in the host's entry, once. */
export const MILKDOWN_THEME_IMPORTS: readonly string[] = [
  "@milkdown/crepe/theme/common/style.css",
  "@milkdown/crepe/theme/frame.css",
];

// ── the sliver of Crepe this module touches ────────────────────────────────
// Structural types: the peer is optional, so the build must typecheck without
// it installed.

interface CrepeListenerLike {
  markdownUpdated(
    callback: (ctx: unknown, markdown: string, previous: string) => void
  ): unknown;
}
interface CrepeLike {
  create(): Promise<unknown>;
  destroy(): unknown;
  getMarkdown(): string;
  on(register: (listener: CrepeListenerLike) => void): unknown;
  setReadonly?(readOnly: boolean): unknown;
}
interface CrepeCtor {
  new (config: {
    root: HTMLElement;
    defaultValue?: string;
    features?: Record<string, boolean>;
  }): CrepeLike;
}

/** What {@link MilkdownLoader} must resolve to. */
export interface MilkdownModule {
  readonly Crepe: CrepeCtor;
}

/** Load the optional peer. Injectable so a test drives every arm — including
 * the one where the package is not installed. */
export type MilkdownLoader = () => Promise<MilkdownModule>;

/** The real loader: one dynamic import, no static reference anywhere. */
export const loadMilkdown: MilkdownLoader = async (): Promise<MilkdownModule> =>
  (await importOptionalPeer(MILKDOWN_PEER)) as MilkdownModule;

/** Where the engine got to. `missing` is a first-class arm, not an error. */
export type MilkdownStatus = "loading" | "ready" | "missing" | "failed";

/** Options of {@link createMilkdownDocEditor}. */
export interface MilkdownDocEditorOptions {
  /** Chrome to render the surface inside — `/default`'s `EditorChrome`. */
  readonly wrap?: DocEditorWrap;
  /** Test/demo seam: replaces the `import("@milkdown/crepe")`. */
  readonly loadPeer?: MilkdownLoader;
  /** Test/demo seam forwarded to the source-mode surface. */
  readonly loadCodeMirrorPeer?: CodeMirrorLoader;
  /** Start in source mode (byte-stable) rather than rich mode. Default false.
   * A host that writes documents by machine may prefer `true`. */
  readonly defaultSourceMode?: boolean;
  /** Hide the rich/source switch (a product that wants one surface only). */
  readonly hideModeSwitch?: boolean;
}

function looksLoaded(module: MilkdownModule | undefined): boolean {
  const loose = module as { Crepe?: unknown } | undefined;
  return typeof loose?.Crepe === "function";
}

/**
 * Build a registrable markdown editor. Configuration lives HERE, at factory
 * time: the registry hands a component only the bag, and a loader created
 * fresh per render would re-mount the engine on every keystroke.
 */
export function createMilkdownDocEditor(
  options: MilkdownDocEditorOptions = {}
): DocEditorComponent {
  const load = options.loadPeer ?? loadMilkdown;
  const Wrap = options.wrap;
  const SourceEditor = createCodeMirrorDocEditor({
    language: "markdown",
    testAttribute: "markdown",
    ...(options.loadCodeMirrorPeer !== undefined
      ? { loadPeer: options.loadCodeMirrorPeer }
      : {}),
  });

  function MilkdownDocEditorSurface(props: DocEditorAdapterProps): ReactElement {
    const t = useT();
    const readOnly = props.readOnly ?? false;
    const [status, setStatus] = useState<MilkdownStatus>("loading");
    const [module, setModule] = useState<MilkdownModule | null>(null);
    const [sourceMode, setSourceMode] = useState(options.defaultSourceMode ?? false);
    const hostRef = useRef<HTMLDivElement | null>(null);
    const crepeRef = useRef<CrepeLike | null>(null);
    // The bag is rebuilt every render; the editor's change listener is
    // installed once and must always reach the current `setValue`.
    const bagRef = useRef({ value: props.bag.value, setValue: props.bag.setValue });

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
          setModule(loaded);
          setStatus("ready");
        } catch (thrown) {
          if (cancelled) return;
          setStatus(
            isOptionalPeerMissing(thrown, [MILKDOWN_PEER]) ? "missing" : "failed"
          );
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    // Mount the rich editor. The document is seeded ONCE, from the bag's value
    // at mount: Crepe owns a ProseMirror state after that, and re-seeding it
    // from a prop would fight the person typing. Leaving and re-entering rich
    // mode re-mounts it against the then-current value, which is exactly the
    // handover the mode switch needs.
    //
    // WAITING FOR THE CONTENT IS NOT OPTIONAL. The bag's value is `""` until
    // the read resolves; an editor seeded there shows an empty document and,
    // on the first save, writes that emptiness over the file. So the mount is
    // gated on `isLoading` — the one dependency that turns "seeded once" from
    // a shortcut into a correct rule.
    const contentLoading = props.bag.isLoading;
    useEffect(() => {
      const host = hostRef.current;
      if (module === null || host === null || sourceMode || contentLoading) {
        return undefined;
      }
      let disposed = false;
      const crepe = new module.Crepe({ root: host, defaultValue: bagRef.current.value });
      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown) => {
          // Guard the open: a normalizing serializer would otherwise mark the
          // document dirty (and, on a Ctrl-S reflex, REWRITE it) before anyone
          // typed a character.
          if (markdown === bagRef.current.value) return;
          bagRef.current.setValue(markdown);
        });
      });
      void (async (): Promise<void> => {
        try {
          await crepe.create();
          if (disposed) {
            crepe.destroy();
            return;
          }
          crepeRef.current = crepe;
          crepe.setReadonly?.(readOnly);
        } catch {
          if (!disposed) setStatus("failed");
        }
      })();
      return () => {
        disposed = true;
        crepeRef.current = null;
        crepe.destroy();
      };
    }, [module, sourceMode, readOnly, contentLoading]);

    const engineAbsent = status === "missing" || status === "failed";
    const showSource = sourceMode || engineAbsent;

    function loadingLine(): ReactElement {
      return (
        <p data-doc-editor-engine="loading" data-testid="docs-editor-engine-loading">
          {t(DOCS_I18N_KEYS.editorEngineLoading)}
        </p>
      );
    }

    function body(): ReactElement {
      if (status === "loading") return loadingLine();
      if (engineAbsent) {
        return (
          <div data-doc-editor-engine={status}>
            <p data-testid="docs-editor-engine-absent">
              {t(
                status === "missing"
                  ? DOCS_I18N_KEYS.editorEngineMissing
                  : DOCS_I18N_KEYS.editorEngineFailed
              )}
            </p>
            <SourceEditor bag={props.bag} readOnly={readOnly} />
          </div>
        );
      }
      if (showSource) return <SourceEditor bag={props.bag} readOnly={readOnly} />;
      // The rich surface's host element appears only once there is a document
      // to seed it with — see the mount effect.
      if (contentLoading) return loadingLine();
      return (
        <div
          ref={hostRef}
          data-doc-editor="markdown"
          data-doc-editor-engine="milkdown"
          data-testid="docs-editor-milkdown"
        />
      );
    }

    const surface = (
      <div data-doc-editor-surface="markdown">
        {!engineAbsent && options.hideModeSwitch !== true && (
          <button
            type="button"
            data-testid="docs-editor-mode-switch"
            data-analytics="none"
            data-analytics-reason="editing-surface preference — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            onClick={() => {
              setSourceMode((mode) => !mode);
            }}
          >
            {t(
              sourceMode ? DOCS_I18N_KEYS.editorModeRich : DOCS_I18N_KEYS.editorModeSource
            )}
          </button>
        )}
        {body()}
      </div>
    );

    return Wrap === undefined ? surface : <Wrap bag={props.bag}>{surface}</Wrap>;
  }

  return MilkdownDocEditorSurface;
}

/** The rich markdown surface (`editor_hint: "markdown"`), unchromed. */
export const MilkdownDocEditor: DocEditorComponent = createMilkdownDocEditor();
