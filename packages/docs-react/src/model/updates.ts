/**
 * The journal poll — the read half of the crdt discipline.
 *
 * A stapel-docs document type is either `snapshot` (whole states saved under
 * `If-Match`, which every v1 builtin is) or `crdt` (an append-only journal of
 * opaque encoded updates). The API client has carried `getUpdates` /
 * `postUpdate` since 0.1.0 and NOTHING consumed them, which is why
 * `DocSurface` can only say "no collaborative editor is registered" — the
 * pair had no way to deliver the rows an editor would replay. This hook is
 * that way.
 *
 * What it is not: a transport. There is no socket here and no CRDT library —
 * polling is the honest floor a browser can always reach, and the interval is
 * a seam (`intervalMs`) precisely so a host that HAS a socket can turn the
 * poll off (`enabled: false`) and feed the same buffer from the wire.
 *
 * Two facts about `GET …/updates?since=` shape the whole hook:
 *
 *   - it answers EITHER a feed (`{head_seq, updates}`) OR an order to resync
 *     (`{resync: true, head_seq, snapshot_seq}` — the requested sequence fell
 *     out of the retained journal). Discriminate with `isUpdatesResync`, never
 *     on the absence of `updates`;
 *   - a resync is not an error. It means "replaying is no longer possible,
 *     re-read the content" — so this hook invalidates the content and document
 *     reads, drops the buffer, and re-arms the cursor at the new head.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import { isUpdatesResync } from "../api/types.js";
import type {
  DocUpdate,
  DocUpdatesResponse,
  DocUpdatesResync,
} from "../api/types.js";
import { useDocsApi } from "./context.js";
import { docsQueryKeys } from "./queryKeys.js";

/** The default poll tempo. Fast enough to feel collaborative, slow enough that
 * a room full of editors does not become the reason the backend needs a queue;
 * a host with a socket passes `enabled: false` instead of tuning it. */
export const DOC_UPDATES_INTERVAL_MS = 2500;

/** Options of {@link useDocUpdates}. */
export interface DocUpdatesOptions {
  /**
   * Poll only while this is true. The caller's condition, not a guess: the
   * document is open AND `doc.collab === "crdt"` (the backend refuses journal
   * reads for a snapshot type — `error.400.docs_updates_not_crdt`), so a
   * snapshot document polled would be a 400 every tick.
   */
  readonly enabled?: boolean;
  /** Poll tempo in ms. Default {@link DOC_UPDATES_INTERVAL_MS}. */
  readonly intervalMs?: number;
  /** Where to start replaying. Default `0` (the whole retained journal); a
   * client that just read a snapshot at `head_seq` passes that instead. */
  readonly since?: number;
  /** Called with each batch of NEW rows, in wire order. The place an editor
   * binding applies them; the buffer below is for surfaces that would rather
   * read than subscribe. */
  readonly onUpdates?: (updates: readonly DocUpdate[]) => void;
  /** Called when the backend ordered a resync (after the invalidation). */
  readonly onResync?: (resync: DocUpdatesResync) => void;
}

/** What {@link useDocUpdates} returns. */
export interface DocUpdatesBag {
  /** Every row received since the last {@link DocUpdatesBag.clear} — in wire
   * order, deduplicated by `seq` against the cursor. */
  readonly updates: readonly DocUpdate[];
  /** The cursor the next poll sends as `?since=`. */
  readonly since: number;
  /** The journal head as of the last answer (`null` before the first). */
  readonly headSeq: number | null;
  /** How many times the backend has ordered a resync — a counter, not a flag,
   * so a surface can tell "it happened once" from "it is happening". */
  readonly resyncCount: number;
  /** The poll is armed (enabled, and the session is ready). */
  readonly isPolling: boolean;
  readonly error: StapelApiError | null;
  /** Drop the buffer (the rows were applied). Does NOT move the cursor. */
  clear(): void;
  /** Re-arm the cursor and drop the buffer — after applying a fresh snapshot. */
  reset(since: number): void;
}

/**
 * Poll a crdt document's journal and hand out the rows.
 *
 * ```tsx
 * const doc = useDocument(documentId);
 * const journal = useDocUpdates(documentId, {
 *   enabled: doc.data?.collab === "crdt",
 *   onUpdates: (rows) => { for (const row of rows) applyEncoded(row.payload); },
 * });
 * ```
 */
export function useDocUpdates(
  documentId: string,
  options: DocUpdatesOptions = {}
): DocUpdatesBag {
  const api = useDocsApi();
  const queryClient = useQueryClient();
  const sessionReady = useActiveSessionReady();

  const initialSince = options.since ?? 0;
  const intervalMs = options.intervalMs ?? DOC_UPDATES_INTERVAL_MS;
  const isPolling =
    sessionReady && documentId.length > 0 && (options.enabled ?? true);

  // The cursor is a REF, not state: the query function reads it at fetch time,
  // and a cursor in state would either restart the poll on every tick (as a
  // key) or be one render stale (as a dependency).
  const cursorRef = useRef(initialSince);
  const [since, setSince] = useState(initialSince);
  const [updates, setUpdates] = useState<readonly DocUpdate[]>([]);
  const [headSeq, setHeadSeq] = useState<number | null>(null);
  const [resyncCount, setResyncCount] = useState(0);
  const [syncedAt, setSyncedAt] = useState(0);

  // Callbacks are re-created by the caller on every render; the effect below
  // must reach the current ones without re-running because of them.
  const handlersRef = useRef(options);
  useEffect(() => {
    handlersRef.current = options;
  });

  const query = useQuery<DocUpdatesResponse, StapelApiError>({
    queryKey: docsQueryKeys.updates(documentId),
    queryFn: () => api.getUpdates(documentId, cursorRef.current),
    enabled: isPolling,
    refetchInterval: isPolling ? intervalMs : false,
    // A journal answer is a moment in time, never reusable: serving a cached
    // feed would replay rows the consumer already applied.
    staleTime: 0,
    gcTime: 0,
  });

  // Named `answer`, not `data`: what the journal route returns is a
  // DISCRIMINATED body (a feed or a resync order), and it is read only after
  // the query has succeeded — the optional `updates` field below is a fact
  // about that body, never a stand-in for "still loading".
  const { data: answer, dataUpdatedAt } = query;

  useEffect(() => {
    if (answer === undefined || dataUpdatedAt === syncedAt) return;
    setSyncedAt(dataUpdatedAt);

    if (isUpdatesResync(answer)) {
      // Not an error: the requested sequence aged out of the retained journal,
      // so replay is impossible and a full re-read is the only correct answer.
      cursorRef.current = answer.head_seq;
      setSince(answer.head_seq);
      setHeadSeq(answer.head_seq);
      setUpdates([]);
      setResyncCount((count) => count + 1);
      void queryClient.invalidateQueries({
        queryKey: docsQueryKeys.content(documentId),
      });
      void queryClient.invalidateQueries({
        queryKey: docsQueryKeys.document(documentId),
      });
      handlersRef.current.onResync?.(answer);
      return;
    }

    const cursor = cursorRef.current;
    // `?since=` is exclusive on the backend, but a client that re-armed its
    // cursor from a snapshot cannot prove that for rows already applied —
    // filtering here makes a double-delivered row impossible either way.
    const fresh = (answer.updates ?? []).filter((row) => row.seq > cursor);
    const highest = fresh.reduce((max, row) => Math.max(max, row.seq), cursor);
    const next = Math.max(highest, answer.head_seq);
    cursorRef.current = next;
    setSince(next);
    setHeadSeq(answer.head_seq);
    if (fresh.length > 0) {
      setUpdates((buffer) => [...buffer, ...fresh]);
      handlersRef.current.onUpdates?.(fresh);
    }
  }, [answer, dataUpdatedAt, syncedAt, documentId, queryClient]);

  const clear = useCallback((): void => {
    setUpdates([]);
  }, []);

  const reset = useCallback((next: number): void => {
    cursorRef.current = next;
    setSince(next);
    setUpdates([]);
  }, []);

  return {
    updates,
    since,
    headSeq,
    resyncCount,
    isPolling,
    error: query.error ?? null,
    clear,
    reset,
  };
}
