/**
 * The Y.Doc session — hydration, remote application, the batched append
 * door, and the resync rebase. Framework-free: the React surface
 * (`CollabEditor.tsx`) owns lifecycles, this module owns the CRDT
 * discipline, and a test drives it with the real yjs and a fake journal.
 *
 * The five rules, each of which is a pinned test:
 *
 * 1. **Origin tagging.** Every remote application is transacted under
 *    {@link REMOTE_ORIGIN}; the local `doc.on("update")` listener ignores
 *    that origin, so nothing a peer wrote echoes back out through POST.
 * 2. **Batched, debounced appends** under ONE `client_id` and a monotonic
 *    `client_seq` — the journal's own dedup handle
 *    (`POST /documents/:id/updates`, `UpdatesAppend`).
 * 3. **A failed batch retries AS-IS under its own `client_seq`.** The server
 *    dedups `(client_id, client_seq)`, so a batch that actually landed while
 *    the response was lost is dropped on retry — which is also why updates
 *    made meanwhile must go to the NEXT batch, never be folded into the
 *    retried one (the dedup would silently discard them).
 * 4. **Resync is a merge, not a loss.** The fresh `/content` state (a full Y
 *    state update) is APPLIED to the live doc: Y updates are commutative and
 *    idempotent, so this folds the server's truth in while every unsent
 *    local operation stays put — and then flushes. No doc swap, no rebinding,
 *    no dropped keystrokes.
 * 5. **Applying an echo is harmless.** The fan-out delivers the author's own
 *    rows back; the session skips them by `client_id` as an optimization,
 *    and correctness never depends on the skip (idempotency again) — which
 *    matters because the polling feed carries no `client_id` at all.
 */
import type { YDocLike, YjsModule, YTextLike } from "./yjsPeer.js";

/** The shared text every yjs-codec document carries
 * (`stapel_docs.crdt.CONTENT_KEY`). */
export const CONTENT_KEY = "content";

/** The transaction origin of every remote/hydration application. */
export const REMOTE_ORIGIN: unique symbol = Symbol("stapel-docs-remote");

/** Default local-edit debounce before a batch goes out. */
export const COLLAB_APPEND_DEBOUNCE_MS = 400;

// ── base64, both ways (the wire is JSON; the update is bytes) ───────────────

export function encodeUpdate(update: Uint8Array): string {
  let raw = "";
  const chunk = 0x2000;
  for (let i = 0; i < update.length; i += chunk) {
    raw += String.fromCharCode(...update.subarray(i, i + chunk));
  }
  return btoa(raw);
}

export function decodeUpdate(encoded: string): Uint8Array {
  const raw = atob(encoded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

// ── the seams ───────────────────────────────────────────────────────────────

/** One remote journal row, as `useDocStream` hands them out. */
export interface CollabRemoteUpdate {
  readonly seq: number;
  /** base64 */
  readonly update: string;
  readonly authorId: string | null;
  readonly clientId: string | null;
}

/** One append, exactly as the wire takes it (`UpdatesAppend`). */
export interface CollabAppendBatch {
  readonly updates: readonly string[];
  readonly client_id: string;
  readonly client_seq: number;
}

/** Where the session reads and writes — bound to the pair's api by the
 * editor surface, to a fake journal by a test. */
export interface CollabTransport {
  /** `GET /documents/:id/content` — the binary Y state + its head seq. */
  hydrate(): Promise<{ readonly state: Uint8Array; readonly headSeq: number }>;
  /** `POST /documents/:id/updates`. */
  append(batch: CollabAppendBatch): Promise<{ readonly head_seq: number }>;
}

/** Injectable timer (the `@stapel/realtime` Schedule shape). */
export type CollabSchedule = (fn: () => void, delayMs: number) => () => void;

export interface YDocSessionOptions {
  /** The loaded yjs module (see `yjsPeer.ts` — an optional peer, so the
   * session never imports it itself). */
  readonly yjs: YjsModule;
  readonly transport: CollabTransport;
  /** The dedup identity. Default: a generated `web-…` id, unique per
   * session — NOT per document, so two tabs never dedup each other. */
  readonly clientId?: string;
  readonly debounceMs?: number;
  readonly schedule?: CollabSchedule;
  /** A flush that failed (it stays queued and will retry). */
  readonly onFlushError?: (thrown: unknown) => void;
}

export interface YDocSession {
  readonly doc: YDocLike;
  readonly clientId: string;
  /** The `"content"` Y.Text — what an editor binding binds. */
  text(): YTextLike;
  /** Hydrate from the transport; returns the head seq the state is at. */
  start(): Promise<number>;
  /** Apply remote rows (own echoes are skipped; the rest is transacted
   * under {@link REMOTE_ORIGIN}). */
  applyRemote(events: readonly CollabRemoteUpdate[]): void;
  /** Re-hydrate after a resync order — the MERGE rebase (rule 4). Returns
   * the fresh head seq. */
  resync(): Promise<number>;
  /** Seal and send everything pending now (the debounce is for typing). */
  flushNow(): Promise<void>;
  /** Resolves when no flush is in flight (test/teardown convenience). */
  settle(): Promise<void>;
  /** Updates not yet accepted by the server. */
  readonly pendingUpdates: number;
  destroy(): void;
}

function defaultSchedule(fn: () => void, delayMs: number): () => void {
  const handle = setTimeout(fn, delayMs);
  return () => {
    clearTimeout(handle);
  };
}

function generateClientId(): string {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${String(Date.now())}-${String(Math.floor(Math.random() * 1e9))}`;
  return `web-${rand}`.slice(0, 64);
}

interface SealedBatch {
  readonly updates: readonly string[];
  readonly clientSeq: number;
}

export function createYDocSession(options: YDocSessionOptions): YDocSession {
  const { yjs, transport } = options;
  const clientId = options.clientId ?? generateClientId();
  const debounceMs = options.debounceMs ?? COLLAB_APPEND_DEBOUNCE_MS;
  const schedule = options.schedule ?? defaultSchedule;

  const doc = new yjs.Doc();

  let open: string[] = [];
  const queue: SealedBatch[] = [];
  let nextClientSeq = 1;
  let inFlight: Promise<void> | null = null;
  let cancelTimer: (() => void) | null = null;
  let destroyed = false;

  const onLocalUpdate = (update: Uint8Array, origin: unknown): void => {
    if (destroyed || origin === REMOTE_ORIGIN) return;
    open.push(encodeUpdate(update));
    arm();
  };
  doc.on("update", onLocalUpdate);

  function arm(): void {
    if (cancelTimer !== null || destroyed) return;
    cancelTimer = schedule(() => {
      cancelTimer = null;
      void flush();
    }, debounceMs);
  }

  function seal(): void {
    if (open.length === 0) return;
    queue.push({ updates: open, clientSeq: nextClientSeq });
    nextClientSeq += 1;
    open = [];
  }

  function flush(): Promise<void> {
    if (inFlight !== null) return inFlight;
    seal();
    if (queue.length === 0) return Promise.resolve();
    inFlight = (async (): Promise<void> => {
      try {
        while (queue.length > 0 && !destroyed) {
          const batch = queue[0];
          if (batch === undefined) break;
          // The batch goes out EXACTLY as sealed — same rows, same
          // client_seq — however many attempts it takes (rule 3).
          await transport.append({
            updates: batch.updates,
            client_id: clientId,
            client_seq: batch.clientSeq,
          });
          queue.shift();
          seal();
        }
      } catch (thrown) {
        options.onFlushError?.(thrown);
        if (!destroyed) arm();
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  async function hydrate(): Promise<number> {
    const { state, headSeq } = await transport.hydrate();
    if (state.length > 0 && !destroyed) {
      yjs.applyUpdate(doc, state, REMOTE_ORIGIN);
    }
    return headSeq;
  }

  return {
    doc,
    clientId,
    text: () => doc.getText(CONTENT_KEY),
    start: () => hydrate(),
    applyRemote: (events) => {
      if (destroyed) return;
      for (const event of events) {
        // Our own row, journaled and fanned back. Applying it would be a
        // no-op (idempotency) — skipping it is just cheaper.
        if (event.clientId !== null && event.clientId === clientId) continue;
        try {
          yjs.applyUpdate(doc, decodeUpdate(event.update), REMOTE_ORIGIN);
        } catch {
          // A row this build cannot decode must not kill the session; the
          // write door validated it server-side, so this is a local decode
          // fault and the next resync re-hydrates past it.
        }
      }
    },
    resync: async () => {
      // The MERGE rebase: fold the server's fresh full state INTO the live
      // doc. Commutativity does the rebase; unsent local ops stay put and
      // go out on the next flush (rule 4).
      const headSeq = await hydrate();
      if (open.length > 0 || queue.length > 0) arm();
      return headSeq;
    },
    flushNow: () => flush(),
    settle: () => inFlight ?? Promise.resolve(),
    get pendingUpdates(): number {
      return (
        open.length +
        queue.reduce((total, batch) => total + batch.updates.length, 0)
      );
    },
    destroy: () => {
      destroyed = true;
      if (cancelTimer !== null) {
        cancelTimer();
        cancelTimer = null;
      }
      doc.off("update", onLocalUpdate);
      doc.destroy();
    },
  };
}
