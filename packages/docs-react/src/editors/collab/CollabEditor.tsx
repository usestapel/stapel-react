/**
 * CodeMirror 6 + yCollab over the Y.Doc session — the live co-editing
 * surface for the yjs-codec builtin types of stapel-docs 0.7.0
 * (`ymd`/`ytxt`, hints `markdown.crdt`/`text.crdt`).
 *
 * The rules of the two sibling engines hold here unchanged:
 *
 * 1. **Nothing reaches the pair's main entry.** yjs, y-codemirror.next and
 *    the CodeMirror trio are OPTIONAL peers behind this subpath, fetched
 *    with dynamic `import()` at mount.
 * 2. **Absence is a designed screen** — with ONE deliberate difference from
 *    the codemirror/milkdown arms: there is NO snapshot-editor fallback. A
 *    crdt document's body is a binary Y state; a textarea over it would
 *    offer a Save the write door refuses by name
 *    (`error.400.docs_invalid_crdt_payload`). The absence arm states the
 *    missing packages and stays read-only.
 * 3. **No presence, no cursors, no awareness.** 0.7.0 ships no awareness
 *    transport, so `yCollab` is bound WITHOUT one (remote selections simply
 *    do not render) instead of faking a channel. When the backend grows one,
 *    it will arrive here as a binding change, not a redesign.
 *
 * The editing loop, end to end:
 *
 *   hydrate  GET /content bytes → Y.applyUpdate (origin-tagged)
 *   remote   useDocStream events → session.applyRemote (origin-tagged)
 *   local    Y update events → debounced POST /updates batches
 *            (client_id + client_seq — the journal's own dedup)
 *   resync   session.resync(): the fresh state MERGES into the live doc —
 *            unsent local edits survive and flush (the rebase test pins it)
 *
 * There is no Save button and no dirty state: the journal IS the save. The
 * `DocEditorBag` this component receives from `<DocEditor>` is used for its
 * `documentId` only — the snapshot machinery (value/save/If-Match) has no
 * meaning on a crdt type, and wiring it up would be a second write path.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useT } from "@stapel/core";
import type {
  DocEditorAdapterProps,
  DocEditorComponent,
  DocEditorWrap,
} from "../registry.js";
import { isOptionalPeerMissing } from "../optionalPeer.js";
import { CODEMIRROR_PEER_NAMES, loadCodeMirror } from "../codemirror/CodeMirrorEditor.js";
import type { CodeMirrorLoader, CodeMirrorModules } from "../codemirror/CodeMirrorEditor.js";
import { DOCS_I18N_KEYS } from "../../i18n/keys.js";
import { useDocsApi } from "../../model/context.js";
import { useDocStream } from "../../model/stream.js";
import type { DocStreamBag } from "../../model/stream.js";
import { createYDocSession } from "./session.js";
import type { CollabTransport, YDocSession } from "./session.js";
import { COLLAB_PEER_NAMES, collabPeersLookLoaded, loadCollabPeers } from "./yjsPeer.js";
import type { CollabPeerModules, CollabPeersLoader } from "./yjsPeer.js";

/** Where the engine got to. `missing` is a first-class arm, not an error. */
export type CollabStatus = "loading" | "ready" | "missing" | "failed";

/** Options of {@link createCollabDocEditor}. */
export interface CollabDocEditorOptions {
  /** `"markdown"` loads `@codemirror/lang-markdown` for highlighting;
   * `"none"` (the `text.crdt` hint) stays plain. */
  readonly language?: "markdown" | "none";
  /** Chrome to render the surface inside. NOTE: the default skin's
   * `EditorChrome` renders the SNAPSHOT bag (Save/dirty/conflict), which is
   * meaningless here — pass a chrome built for a live surface, or none. */
  readonly wrap?: DocEditorWrap;
  /** Test/demo seam: replaces the `import("yjs")`/`import("y-codemirror.next")`. */
  readonly loadPeer?: CollabPeersLoader;
  /** Test/demo seam: replaces the `import("@codemirror/…")` calls. */
  readonly loadCodeMirrorPeer?: CodeMirrorLoader;
  /** Local-edit debounce before a batch POSTs. Default
   * {@link COLLAB_APPEND_DEBOUNCE_MS}. */
  readonly debounceMs?: number;
  /** Poll tempo when this deployment serves no socket (forwarded to
   * `useDocStream`). */
  readonly fallbackRefetchInterval?: number;
  /** Value of the surface's `data-doc-editor` attribute. */
  readonly testAttribute?: string;
  /** Test/demo seam: observe the created session. */
  readonly onSession?: (session: YDocSession) => void;
}

/**
 * Build a registrable live editor component. Configuration lives at factory
 * time, not in props — the registry hands a component only the
 * `DocEditorAdapterProps` bag.
 */
export function createCollabDocEditor(
  options: CollabDocEditorOptions = {}
): DocEditorComponent {
  const language = options.language ?? "none";
  const load = options.loadPeer ?? loadCollabPeers;
  const loadCm = options.loadCodeMirrorPeer ?? loadCodeMirror;
  const Wrap = options.wrap;
  const attribute = options.testAttribute ?? `${language}.crdt`;

  function CollabDocEditorSurface(props: DocEditorAdapterProps): ReactElement {
    const t = useT();
    const api = useDocsApi();
    const documentId = props.bag.documentId;
    const readOnly = props.readOnly ?? false;
    const [status, setStatus] = useState<CollabStatus>("loading");
    const [headSeq, setHeadSeq] = useState<number | null>(null);
    const hostRef = useRef<HTMLDivElement | null>(null);
    const modulesRef = useRef<{
      peers: CollabPeerModules;
      cm: CodeMirrorModules;
    } | null>(null);
    const sessionRef = useRef<YDocSession | null>(null);
    const streamRef = useRef<DocStreamBag | null>(null);
    const apiRef = useRef(api);
    apiRef.current = api;

    // ── load the engines, build the session, hydrate ───────────────────────
    useEffect(() => {
      let cancelled = false;
      setStatus("loading");
      void (async (): Promise<void> => {
        try {
          const [peers, cm] = await Promise.all([load(), loadCm()]);
          if (cancelled) return;
          if (!collabPeersLookLoaded(peers)) {
            setStatus("missing");
            return;
          }
          const transport: CollabTransport = {
            hydrate: async () => {
              const content = await apiRef.current.getContent(documentId);
              return {
                state: new Uint8Array(await content.blob.arrayBuffer()),
                headSeq: content.headSeq ?? 0,
              };
            },
            append: (batch) =>
              apiRef.current.postUpdate(documentId, {
                updates: [...batch.updates],
                client_id: batch.client_id,
                client_seq: batch.client_seq,
              }),
          };
          const session = createYDocSession({
            yjs: peers.yjs,
            transport,
            ...(options.debounceMs !== undefined
              ? { debounceMs: options.debounceMs }
              : {}),
          });
          const seq = await session.start();
          if (cancelled) {
            session.destroy();
            return;
          }
          modulesRef.current = { peers, cm };
          sessionRef.current = session;
          setHeadSeq(seq);
          options.onSession?.(session);
          setStatus("ready");
        } catch (thrown) {
          if (cancelled) return;
          setStatus(
            isOptionalPeerMissing(thrown, [
              ...COLLAB_PEER_NAMES,
              ...CODEMIRROR_PEER_NAMES,
            ])
              ? "missing"
              : "failed"
          );
        }
      })();
      return () => {
        cancelled = true;
        sessionRef.current?.destroy();
        sessionRef.current = null;
        modulesRef.current = null;
      };
    }, [documentId]);

    // ── the stream (socket where served, ?since= poll everywhere) ──────────
    const stream = useDocStream(documentId, {
      enabled: status === "ready",
      onEvents: (events) => {
        sessionRef.current?.applyRemote(events);
      },
      onResync: () => {
        const session = sessionRef.current;
        if (session === null) return;
        void session.resync().then((seq) => {
          streamRef.current?.reset(seq);
        });
      },
      ...(options.fallbackRefetchInterval !== undefined
        ? { fallbackRefetchInterval: options.fallbackRefetchInterval }
        : {}),
    });
    streamRef.current = stream;

    // Arm the cursor at the hydrated head BEFORE the stream turns on for it —
    // replaying rows the snapshot already contains is harmless (idempotent)
    // but pointless, and past the replay window it would order a resync.
    const streamReset = stream.reset;
    useEffect(() => {
      if (status !== "ready" || headSeq === null) return;
      streamReset(headSeq);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- wanted once per hydration, not per render of the bag
    }, [status, headSeq]);

    // ── mount CodeMirror with the yCollab binding ──────────────────────────
    useEffect(() => {
      const host = hostRef.current;
      const modules = modulesRef.current;
      const session = sessionRef.current;
      if (status !== "ready" || host === null || modules === null || session === null) {
        return undefined;
      }
      const { EditorState } = modules.cm.state;
      const { EditorView } = modules.cm.view;
      const extensions: unknown[] = [
        EditorView.lineWrapping,
        EditorView.editable.of(!readOnly),
        // No awareness handed over: none exists in 0.7.0 (module docstring).
        modules.peers.yCodeMirror.yCollab(session.text(), undefined),
      ];
      const markdown = modules.cm.langMarkdown?.markdown;
      if (language === "markdown" && typeof markdown === "function") {
        extensions.push(markdown());
      }
      const view = new EditorView({
        state: EditorState.create({ doc: session.text().toString(), extensions }),
        parent: host,
      });
      return () => {
        view.destroy();
      };
    }, [status, readOnly]);

    const body =
      status === "ready" ? (
        <div
          ref={hostRef}
          data-doc-editor={attribute}
          data-doc-editor-engine="collab"
          data-doc-stream-transport={stream.transport}
          data-testid="docs-editor-collab"
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
          {/* Deliberately NO fallback editor: a snapshot save over a crdt
              body is refused by the write door — see the module docstring. */}
        </div>
      );

    return Wrap === undefined ? body : <Wrap bag={props.bag}>{body}</Wrap>;
  }

  return CollabDocEditorSurface;
}
