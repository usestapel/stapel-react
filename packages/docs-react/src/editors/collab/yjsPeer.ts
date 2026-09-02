/**
 * The sliver of yjs / y-codemirror.next this subpath touches — structural
 * types plus the dynamic loader, the `CodeMirrorEditor.tsx` convention for
 * the same reason: the packages are OPTIONAL peers, so the build must
 * typecheck on a machine that never installed them, and nothing may land in
 * the importing chunk (`importOptionalPeer` keeps the specifier dynamic to
 * the compiler and to every bundler).
 *
 * Version notes: `pycrdt` on the server is the y-crdt Rust binding, so the
 * wire is Yjs-compatible with any yjs >=13.6 (the floor y-codemirror.next
 * itself declares is ^13.5.6). One `Y.Text` named `"content"` is the
 * canonical shape (`stapel_docs/crdt.py::CONTENT_KEY`) — a type with a
 * different shape is a different codec, not a parameter here.
 */
import { importOptionalPeer } from "../optionalPeer.js";

/** The optional peers this surface loads (the CodeMirror trio rides the
 * existing `loadCodeMirror` seam and is named there). */
export const COLLAB_PEERS: {
  readonly yjs: "yjs";
  readonly yCodeMirror: "y-codemirror.next";
} = {
  yjs: "yjs",
  yCodeMirror: "y-codemirror.next",
};

/** Every specifier this surface may fail to resolve — what the "is it just
 * not installed?" check matches against. */
export const COLLAB_PEER_NAMES: readonly string[] = [
  COLLAB_PEERS.yjs,
  COLLAB_PEERS.yCodeMirror,
];

// ── the sliver of yjs this module touches ───────────────────────────────────

/** The shared text a yjs-codec document carries its body in. */
export interface YTextLike {
  readonly length: number;
  toString(): string;
  insert(index: number, text: string): void;
  delete(index: number, length: number): void;
}

/** A Y.Doc, structurally. `on("update")` fires once per transaction with the
 * incremental update and the transaction's ORIGIN — the tag that keeps a
 * remote application from echoing back out through the append door. */
export interface YDocLike {
  getText(name: string): YTextLike;
  transact(fn: () => void, origin?: unknown): void;
  on(event: "update", handler: (update: Uint8Array, origin: unknown) => void): void;
  off(event: "update", handler: (update: Uint8Array, origin: unknown) => void): void;
  destroy(): void;
}

/** The module surface of `yjs` this subpath calls. */
export interface YjsModule {
  readonly Doc: new () => YDocLike;
  applyUpdate(doc: YDocLike, update: Uint8Array, origin?: unknown): void;
  encodeStateAsUpdate(doc: YDocLike): Uint8Array;
}

/** The module surface of `y-codemirror.next`: the one extension factory.
 * Called with (ytext, awareness, options?) — awareness is passed as
 * `undefined` in this slice, deliberately: stapel-docs 0.7.0 ships NO
 * presence/awareness transport, and the binding renders no remote cursors
 * without one instead of faking any. */
export interface YCodeMirrorModule {
  readonly yCollab: (...args: unknown[]) => unknown;
}

/** What {@link CollabPeersLoader} must resolve to. */
export interface CollabPeerModules {
  readonly yjs: YjsModule;
  readonly yCodeMirror: YCodeMirrorModule;
}

/** Load the optional peers. Injectable so a test — and a demo — drives every
 * arm, including the one where the packages are not installed. */
export type CollabPeersLoader = () => Promise<CollabPeerModules>;

/** The real loader: two dynamic imports, no static reference anywhere. */
export const loadCollabPeers: CollabPeersLoader = async (): Promise<CollabPeerModules> => {
  const [yjs, yCodeMirror] = await Promise.all([
    importOptionalPeer(COLLAB_PEERS.yjs),
    importOptionalPeer(COLLAB_PEERS.yCodeMirror),
  ]);
  return { yjs, yCodeMirror } as CollabPeerModules;
};

/** A module namespace that resolved but carries none of the symbols is the
 * same fact as "not installed" (a stub, a wrong major, a broken mirror). */
export function collabPeersLookLoaded(
  modules: CollabPeerModules | undefined
): boolean {
  const loose = modules as
    | {
        yjs?: { Doc?: unknown; applyUpdate?: unknown };
        yCodeMirror?: { yCollab?: unknown };
      }
    | undefined;
  return (
    typeof loose?.yjs?.Doc === "function" &&
    typeof loose.yjs.applyUpdate === "function" &&
    typeof loose.yCodeMirror?.yCollab === "function"
  );
}
