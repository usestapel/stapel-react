/**
 * THE TRANSPORT SEAM of the crdt discipline — one hook, two transports, one
 * downstream shape.
 *
 * stapel-docs 0.7.0 put the update journal on the fleet's realtime substrate:
 * `docs:doc:<document_id>` on `ws/docs/<document_id>`, resumable by the
 * journal's own seq, READ-ONLY (writes stay REST — the design settles it,
 * §5.3 p.6; chat is the fleet's documented exception and docs is not one).
 * Serving the socket is an optional extra, and polling `?since=` stays
 * first-class forever — so a consumer must work well BOTH ways, and this hook
 * is the one place that decides which way is running:
 *
 * ```
 * useDocStream(documentId, { onEvents, onResync })
 *     ├── socket  → @stapel/realtime useStream(docs:doc:<id>) — replay/live
 *     │             frames resumed by seq; the address comes off the document
 *     │             row's own `socket_path` (the chat canon: the envelope
 *     │             carries its own live path, nothing here guesses routing)
 *     └── polling → the existing useDocUpdates ?since= poll, at
 *                   `fallbackRefetchInterval`, taken up AT THE SOCKET'S
 *                   CURSOR when the row says null, the host mounted no
 *                   <RealtimeProvider>, or the socket closed terminally
 * ```
 *
 * Both ends hand out the SAME thing: ordered {@link DocStreamEvent}s — the
 * journal row's seq, the base64 update, who wrote it — plus a resync signal.
 * The payloads stay opaque: no CRDT library is imported here (the main entry
 * carries no engine; the Y.Doc session lives behind `./editors/collab`).
 *
 * Everything socket-shaped (reconnect, resume, heartbeat, the close-code
 * table, the 4401 session refresh) is `@stapel/realtime`'s — this file owns
 * only the module facts: the stream key, the socket path, and what an update
 * frame means. `stapel/no-adhoc-socket` makes writing a second socket an
 * error, and this pair does not want one.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStream } from "@stapel/realtime/react";
import type { NoProviderStatus } from "@stapel/realtime/react";
import type { RealtimeFrame, RealtimeStreamStatus } from "@stapel/realtime";
import type { StapelApiError } from "@stapel/core";
import type { DocUpdate } from "../api/types.js";
import { useDocsApi } from "./context.js";
import { useDocument } from "./queries.js";
import { docsQueryKeys } from "./queryKeys.js";
import { DOC_UPDATES_INTERVAL_MS, useDocUpdates } from "./updates.js";

/** Stream-key module segment (`stapel_docs.realtime.STREAM_MODULE`). */
export const DOCS_STREAM_MODULE = "docs";

/** `docs:doc:<id>` — the resumable journal stream of one document
 * (`stapel_docs.realtime.doc_stream`). What the server stamps on every
 * frame's envelope, so it has to be the same string on both sides. */
export function docStreamKey(documentId: string): string {
  return `${DOCS_STREAM_MODULE}:doc:${documentId}`;
}

/** `ws/docs/<id>` — where the document's socket is mounted
 * (`stapel_docs.realtime.socket_path`). The row's own `socket_path` wins over
 * anything derived here: a client that recomputes what the envelope already
 * answers is a second, staler answer. */
export function docSocketPath(documentId: string): string {
  return `ws/docs/${encodeURIComponent(documentId)}`;
}

/**
 * Derive the socket ORIGIN from the REST base URL: `wss://host`, no path.
 * The path is the row's (`ws/docs/<id>`) and the mount sits at the host
 * root, not under the module's API prefix — the fleet convention
 * `/ws/<mod>/…`, and `stapel_docs.routing` verbatim.
 *
 * `null` means "this build cannot resolve a socket origin" (a relative
 * `baseUrl` with no `origin`: SSR, a node test). Not a failure — a fact the
 * seam names, and the poll then carries the stream.
 */
export function deriveDocsSocketOrigin(
  baseUrl: string,
  origin?: string | null
): string | null {
  try {
    const url = new URL(baseUrl, origin ?? undefined);
    const protocol =
      url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:";
    return `${protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** The socket URL for a mount path, or `null` when this build has no origin. */
export function docsSocketUrl(
  origin: string | null,
  socketPath: string
): string | null {
  if (origin === null) return null;
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  const path = socketPath.startsWith("/") ? socketPath.slice(1) : socketPath;
  return `${base}/${path}`;
}

/**
 * One journal update, transport-agnostic — the downstream shape both the
 * socket frames (`{update, author_id, client_id}`, seq in the envelope) and
 * the `?since=` rows (`{seq, payload, author_id}`) fold into.
 */
export interface DocStreamEvent {
  /** The row's journal seq — the resume cursor AND the ordering key here
   * (docs journals one fact per row; nothing re-arrives revised). */
  readonly seq: number;
  /** The opaque encoded update, base64 exactly as the wire carries it. */
  readonly update: string;
  readonly authorId: string | null;
  /** The appending client's own dedup handle. `null` when unknown — the
   * polling feed does not carry it, and the socket sends `""` for appends
   * made without one. A session uses it to skip its own echoes; skipping is
   * an optimization, never a correctness requirement (Y updates are
   * idempotent). */
  readonly clientId: string | null;
}

/** Which road updates are travelling to this tab. `idle` = the document row
 * has not answered yet (nothing to poll, nowhere to connect). */
export type DocStreamTransport = "socket" | "polling" | "idle";

/** Options of {@link useDocStream}. */
export interface DocStreamOptions {
  /** Consume only while true. The caller's condition, not a guess: the
   * document is open AND `doc.collab === "crdt"` (a snapshot type polled is
   * `error.400.docs_updates_not_crdt` every tick). Default true. */
  readonly enabled?: boolean;
  /** The seq the caller already holds (a client that just applied a snapshot
   * at `head_seq` passes it). Default 0 — replay everything retained. */
  readonly since?: number;
  /** Every batch of NEW rows, in wire order, deduplicated against the
   * cursor — the place a session applies them. Rows are not buffered here:
   * a live stream buffered forever is a leak, not a feature. */
  readonly onEvents?: (events: readonly DocStreamEvent[]) => void;
  /** The stream fell behind what either transport can replay. The hook has
   * already invalidated the content/document reads and re-armed its cursor
   * at the new tip; the caller re-hydrates its model (see the collab
   * session's rebase). */
  readonly onResync?: () => void;
  /** Poll tempo while the poll carries the stream.
   * Default {@link DOC_UPDATES_INTERVAL_MS}. */
  readonly fallbackRefetchInterval?: number;
  /** Override the socket address. `null` turns the socket OFF explicitly (a
   * host that knows its backend runs under WSGI says so instead of failing a
   * handshake first); omit to resolve the document row's `socket_path`
   * against the origin derived from the api base URL. */
  readonly socketUrl?: string | null;
}

/** What {@link useDocStream} returns. */
export interface DocStreamBag {
  readonly transport: DocStreamTransport;
  /** The cursor: the highest seq handed out (or accepted via {@link reset}). */
  readonly since: number;
  /** How many resync orders arrived, over either transport. */
  readonly resyncCount: number;
  /** The socket's own status (state/refusal/reason) — for a surface that
   * names its degradation instead of spinning. `no_provider` when the host
   * mounted no `<RealtimeProvider>`. */
  readonly socketStatus: RealtimeStreamStatus | NoProviderStatus;
  /** Polling-transport read failure, else null. */
  readonly error: StapelApiError | null;
  /** Re-arm the cursor (after applying a fresh snapshot at `headSeq`). */
  reset(since: number): void;
}

const TERMINAL_SOCKET_STATES: ReadonlySet<string> = new Set([
  "refused",
  "closed",
  "no_provider",
]);

function readEventPayload(
  seq: number,
  payload: Readonly<Record<string, unknown>>
): DocStreamEvent | null {
  const update = payload["update"];
  if (typeof update !== "string" || update === "") return null;
  const author = payload["author_id"];
  const client = payload["client_id"];
  return {
    seq,
    update,
    authorId: typeof author === "string" && author !== "" ? author : null,
    clientId: typeof client === "string" && client !== "" ? client : null,
  };
}

/**
 * Consume a crdt document's update journal over the best transport this
 * deployment serves — see the module docstring for the whole seam.
 *
 * ```tsx
 * const stream = useDocStream(documentId, {
 *   enabled: doc.data?.collab === "crdt",
 *   since: appliedHeadSeq,
 *   onEvents: (events) => session.applyRemote(events),
 *   onResync: () => void session.resync().then((seq) => stream.reset(seq)),
 * });
 * ```
 */
export function useDocStream(
  documentId: string,
  options: DocStreamOptions = {}
): DocStreamBag {
  const api = useDocsApi();
  const queryClient = useQueryClient();
  const enabled = options.enabled ?? true;
  const initialSince = options.since ?? 0;
  const intervalMs = options.fallbackRefetchInterval ?? DOC_UPDATES_INTERVAL_MS;

  const documentQuery = useDocument(documentId);
  const row = documentQuery.data;
  const rowKnown = row !== undefined;

  // The address: an explicit override wins; otherwise the row's own
  // socket_path against the origin the api base URL implies. `null` =
  // no socket in this deployment (or none knowable yet).
  const socketPath = row?.socket_path ?? null;
  const socketUrl =
    options.socketUrl !== undefined
      ? options.socketUrl
      : socketPath !== null
        ? docsSocketUrl(deriveDocsSocketOrigin(api.client.baseUrl), socketPath)
        : null;

  // The cursor is a REF (read at delivery/connect time) mirrored into state
  // (read by renders) — the useDocUpdates precedent, for the same reason.
  const cursorRef = useRef(initialSince);
  const [since, setSince] = useState(initialSince);
  const [resyncCount, setResyncCount] = useState(0);

  const handlersRef = useRef(options);
  useEffect(() => {
    handlersRef.current = options;
  });

  const advance = useCallback((next: number): void => {
    cursorRef.current = next;
    setSince(next);
  }, []);

  const orderResync = useCallback(
    (tip: number): void => {
      advance(tip);
      setResyncCount((count) => count + 1);
      void queryClient.invalidateQueries({
        queryKey: docsQueryKeys.content(documentId),
      });
      void queryClient.invalidateQueries({
        queryKey: docsQueryKeys.document(documentId),
      });
      handlersRef.current.onResync?.();
    },
    [advance, documentId, queryClient]
  );

  // ── the socket half ────────────────────────────────────────────────────────
  const socketOn = enabled && documentId.length > 0 && socketUrl !== null;

  const onFrame = useCallback(
    (frame: RealtimeFrame): void => {
      if (frame.type !== "replay" && frame.type !== "live") return;
      const seq = frame.envelopeSeq;
      if (seq === undefined || seq <= cursorRef.current) return;
      const event = readEventPayload(seq, frame.payload);
      if (event === null) return;
      advance(seq);
      handlersRef.current.onEvents?.([event]);
    },
    [advance]
  );

  const onState = useCallback(
    (status: RealtimeStreamStatus): void => {
      if (status.state !== "resync") return;
      // The gap is wider than the server's replay window: the truth is
      // behind REST now. Re-arm at the tip the server named — never at the
      // stale cursor, which would order a resync again on every reconnect.
      orderResync(status.serverSeq ?? cursorRef.current);
    },
    [orderResync]
  );

  const { status: socketStatus } = useStream(docStreamKey(documentId), {
    optional: true,
    enabled: socketOn,
    ...(socketUrl !== null && socketUrl !== undefined ? { url: socketUrl } : {}),
    lastSeq: () => cursorRef.current,
    onFrame,
    onState,
  });

  const socketTerminal = TERMINAL_SOCKET_STATES.has(socketStatus.state);

  // ── the polling half ───────────────────────────────────────────────────────
  //
  // Armed when the deployment serves no socket for this document (a null
  // socket_path, no derivable origin, no provider) — and when the socket was
  // ended by a VERDICT (refused/closed): a verdict is not a slow reconnect,
  // and the poll is the honest floor under it. A transient drop is NOT
  // handed over: the substrate reconnects and resumes by seq, which is
  // exactly what the journal exists for.
  const wantPolling = enabled && rowKnown && (!socketOn || socketTerminal);

  // The poll is armed only AFTER the handoff reset has run (the effect
  // below), so its very first request already carries the cursor the socket
  // — or the caller — got to, never a stale `since=0`.
  const [pollArmed, setPollArmed] = useState(false);
  const pollingOn = wantPolling && pollArmed;

  const journal = useDocUpdates(documentId, {
    enabled: pollingOn,
    intervalMs,
    since: initialSince,
    onUpdates: (rows: readonly DocUpdate[]) => {
      const fresh: DocStreamEvent[] = [];
      for (const rowUpdate of rows) {
        if (rowUpdate.seq <= cursorRef.current) continue;
        fresh.push({
          seq: rowUpdate.seq,
          update: rowUpdate.payload,
          authorId: rowUpdate.author_id ?? null,
          clientId: null,
        });
        cursorRef.current = rowUpdate.seq;
      }
      if (fresh.length === 0) return;
      setSince(cursorRef.current);
      handlersRef.current.onEvents?.(fresh);
    },
    onResync: (order) => {
      orderResync(order.head_seq);
    },
  });

  // The handoff: when the poll takes over it starts AT THE CURSOR — the seq
  // the socket (or the caller) got to — never from zero.
  const journalReset = journal.reset;
  useEffect(() => {
    if (!wantPolling) {
      setPollArmed(false);
      return;
    }
    journalReset(cursorRef.current);
    setPollArmed(true);
  }, [wantPolling, journalReset]);

  // An empty feed still advances the poll's cursor to head_seq; mirror it so
  // a later socket resume does not re-ask for rows the poll already covered.
  const journalSince = journal.since;
  useEffect(() => {
    if (!pollingOn || journalSince <= cursorRef.current) return;
    advance(journalSince);
  }, [pollingOn, journalSince, advance]);

  const reset = useCallback(
    (next: number): void => {
      advance(next);
      journalReset(next);
    },
    [advance, journalReset]
  );

  const transport: DocStreamTransport =
    socketOn && !socketTerminal ? "socket" : wantPolling ? "polling" : "idle";

  return {
    transport,
    since,
    resyncCount,
    socketStatus,
    error: journal.error,
    reset,
  };
}
