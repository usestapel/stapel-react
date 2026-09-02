/**
 * `@stapel/docs-react/editors/collab` — live co-editing for the yjs-codec
 * document types of stapel-docs 0.7.0 (`ymd`/`ytxt`), behind OPTIONAL peers
 * and dynamic `import()`.
 *
 * ```ts
 * // once, at startup:
 * import { registerCollabDocEditors } from "@stapel/docs-react/editors/collab";
 * registerCollabDocEditors();
 * ```
 *
 * ```sh
 * pnpm add yjs y-codemirror.next @codemirror/state @codemirror/view @codemirror/lang-markdown
 * ```
 *
 * The surfaces bind CodeMirror 6 to the document's ONE shared `Y.Text`
 * (`"content"`) via `yCollab`, hydrate from `GET /content` (the binary Y
 * state), consume the update journal through `useDocStream` (socket where
 * the deployment serves one, the `?since=` poll everywhere), and batch local
 * updates through `POST /updates` under the journal's own
 * `client_id`/`client_seq` dedup. On a resync order the fresh state MERGES
 * into the live doc — unsent local edits survive and flush.
 *
 * No presence/cursors/awareness in this slice: 0.7.0 ships no awareness
 * transport, and this surface does not fake one.
 *
 * With the peers absent the surface renders a sentence and stays read-only —
 * deliberately NO textarea fallback here, because a snapshot save over a
 * crdt body is refused by the write door
 * (`error.400.docs_invalid_crdt_payload`).
 */
export {
  createCollabDocEditor,
} from "./CollabEditor.js";
export type { CollabDocEditorOptions, CollabStatus } from "./CollabEditor.js";
export {
  COLLAB_DEFAULT_HINTS,
  registerCollabDocEditors,
} from "./register.js";
export type { RegisterCollabOptions } from "./register.js";
export {
  COLLAB_APPEND_DEBOUNCE_MS,
  CONTENT_KEY,
  REMOTE_ORIGIN,
  createYDocSession,
  decodeUpdate,
  encodeUpdate,
} from "./session.js";
export type {
  CollabAppendBatch,
  CollabRemoteUpdate,
  CollabSchedule,
  CollabTransport,
  YDocSession,
  YDocSessionOptions,
} from "./session.js";
export {
  COLLAB_PEERS,
  COLLAB_PEER_NAMES,
  collabPeersLookLoaded,
  loadCollabPeers,
} from "./yjsPeer.js";
export type {
  CollabPeerModules,
  CollabPeersLoader,
  YCodeMirrorModule,
  YDocLike,
  YTextLike,
  YjsModule,
} from "./yjsPeer.js";
