/**
 * THE TRANSPORT SEAM. One hook, two transports, and no screen that knows
 * which one is running.
 *
 * ── What this file is, after the cutover ────────────────────────────────────
 *
 * It is the ONLY place chat touches a socket, and it no longer contains one.
 * `@stapel/realtime` owns the wire — the v1 envelope, the resume handshake,
 * the heartbeat answer, the close-code table, the 4401 session refresh, the
 * backoff — and this file owns the two things a pair cannot delegate: which
 * STREAM a surface watches, and what its PAYLOADS mean to the store.
 *
 * ```
 * useChatFreshness(stream, mapToQueryKeys, { fallbackRefetchInterval })
 *     ├── socket  → useStream(chat:conv:<id>) → replay/live frames, resumed
 *     │              by rev_seq; resync → re-hydrate
 *     └── polling → a visibility-aware tick, exponential backoff on failures
 * ```
 *
 * Both ends do the same thing with what they learn: **refetch the thread
 * query**, whose query function advances the window BY SEQ
 * (`GET …/messages?direction=prev&anchor=<tip>`). A frame says "there is
 * something after your tip" and the store goes and gets it — which is also
 * why a live payload is not written into the cache as if it were a REST row:
 * the socket sends raw attachment descriptors where REST sends rendered ones
 * (`realtime/frames.ts`), and a cache holding both shapes under one type is a
 * renderer bug waiting for an attachment.
 *
 * The ONE exception is a revision. An edit or a tombstone re-arrives with its
 * existing `seq` and a new `rev_seq`, so a refetch anchored on the tip returns
 * nothing and the change would be invisible until the screen was rebuilt.
 * Those frames are applied in place, and only over the fields whose shape the
 * two transports agree on — body, the edit/delete marks, `rev_seq`. See
 * `model/threadWindow.ts#applyRevision`.
 *
 * ── The two sequences, one more time ────────────────────────────────────────
 *
 * The resume cursor handed back in `hello{last_seq}` is `rev_seq`
 * (`threadLastRevSeq`), NOT the thread's `seq`. The pre-substrate client sent
 * the thread seq, which asked the server to replay from a revision number
 * that had nothing to do with what the client held.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useStream, useRealtimeState } from "@stapel/realtime/react";
import { defaultSchedule } from "@stapel/realtime";
import type { RealtimeFrame, RealtimeStreamStatus } from "@stapel/realtime";
import type { NoProviderStatus } from "@stapel/realtime/react";
import { useChatRuntime } from "../model/context.js";
import { chatQueryKeys } from "../model/queryKeys.js";
import { applyRevision, threadLastRevSeq } from "../model/threadWindow.js";
import type { ChatThreadWindow } from "../model/threadWindow.js";
import {
  readChatActivityFrame,
  readChatInboxFrame,
  readChatMarkerFrame,
  readChatMessageFrame,
} from "../realtime/frames.js";
import type { ChatMessagePayload } from "../realtime/frames.js";
import {
  RENEWING_CREDENTIAL_DEBOUNCE_MS,
  chatDegradation,
  withRenewingCredential,
} from "../realtime/degradation.js";
import type { ChatDegraded } from "../realtime/degradation.js";
import { chatSocketUrl } from "../realtime/streams.js";
import type { ChatStream } from "../realtime/streams.js";

/**
 * What a transport reports upward. One vocabulary for both, so the mapping
 * function does not care where the news came from:
 *
 *  - `message` — a message landed on the journal (socket only). `revision`
 *    tells an edit or a tombstone apart from a new line.
 *  - `marker` — someone's read or delivery marker moved (socket only).
 *  - `activity` — someone is typing/recording/uploading. Ephemeral, expires
 *    on its own `ttlMs`; nothing to refetch, and it is delivered so a host
 *    that wants an indicator has one.
 *  - `inbox` — a conversation this user takes part in moved (inbox socket).
 *  - `resync` — the stream fell behind the replay window; re-read the
 *    journal.
 *  - `tick` — a scheduled "check for news" (polling), or a catch-up after an
 *    ephemeral stream reconnected and cannot replay what it missed.
 */
export type ChatSignal =
  | {
      readonly kind: "message";
      readonly conversationId: string;
      /** Place in the thread — the sort key. */
      readonly seq: number;
      /** Place in the revision journal — the resume cursor. */
      readonly revSeq: number;
      /** An edit or a tombstone, rather than a new line. */
      readonly revision: boolean;
      readonly message: ChatMessagePayload;
    }
  | {
      readonly kind: "marker";
      readonly conversationId: string;
      readonly userId: string;
      readonly seq: number;
      readonly marker: "read" | "delivered";
    }
  | {
      readonly kind: "activity";
      readonly conversationId: string;
      readonly userId: string;
      readonly state: string;
      readonly ttlMs: number;
    }
  | {
      readonly kind: "inbox";
      readonly conversationId: string;
      readonly lastSeq: number;
    }
  | { readonly kind: "resync"; readonly conversationId: string | null }
  | { readonly kind: "tick" };

/** Signal → the query keys it makes stale. The whole contract with the UI. */
export type ChatSignalKeyMap = (signal: ChatSignal) => readonly QueryKey[];

/** Which transport is actually carrying freshness right now. */
export type ChatTransport = "socket" | "polling" | "idle";

export type { ChatDegraded, ChatDegradedReason } from "../realtime/degradation.js";

export interface ChatFreshnessOptions {
  /**
   * Polling period (ms) used whenever the socket is not carrying the stream.
   * `0` (the default) means no polling — a stream that is only ever live.
   * The storefront spec's periods: an open thread 3000, the inbox 15000.
   */
  readonly fallbackRefetchInterval?: number;
  /** Off entirely — an unauthenticated visitor, an unmounted screen. */
  readonly enabled?: boolean;
  /**
   * Whether the SOCKET half may open (default `true`). Polling is unaffected.
   *
   * A resumable stream must not be subscribed before its cursor exists:
   * `hello{last_seq: 0}` asks the server to replay the whole journal over the
   * socket, which the store would then discard and re-read by REST. So
   * `<ConversationThread>` holds the socket back until the window is loaded,
   * while polling stays on — polling is also how a FAILED first read
   * recovers, and switching that off with the socket would leave a broken
   * thread broken until someone pressed something.
   */
  readonly socketEnabled?: boolean;
}

export interface ChatFreshness {
  readonly transport: ChatTransport;
  /** The substrate's own per-stream state, unflattened. */
  readonly status: RealtimeStreamStatus | NoProviderStatus;
  /**
   * `null` while the socket is carrying this stream; otherwise the NAMED
   * reason it is not. Never silently absent — see {@link ChatDegraded}.
   */
  readonly degraded: ChatDegraded | null;
  /** Check for news right now (a pull-to-refresh, a regained focus). */
  pollNow(): void;
  /** Clear a refusal and reconnect — the button beside a visible refusal. */
  reconnect(): void;
  /**
   * Send a client frame on this stream — chat's documented socket-WRITE
   * exception (`send`/`edit`/`delete`/`read`/`delivered`/`activity`).
   * `false` when there is no open socket to write to, which is why every one
   * of them has a REST twin. See `model/socketWrites.ts`.
   */
  send(type: string, payload?: Readonly<Record<string, unknown>>): boolean;
}

/**
 * The polling periods the storefront spec fixes (§3.6): an open thread 3 s,
 * the inbox 15 s. They live here, beside the transport that uses them, rather
 * than in the components — the numbers are a property of the seam.
 */
export const THREAD_INTERVAL_MS = 3_000;
export const CONVERSATION_LIST_INTERVAL_MS = 15_000;

/** Frames arriving in a burst (a replay) collapse into one refetch. */
const FLUSH_DELAY_MS = 40;
/** Backoff ceiling: interval × 2^4 (3s → 48s) before it stops growing. */
const MAX_BACKOFF_STEPS = 4;

function documentVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

/** The resume cursor for a stream: the highest `rev_seq` the store holds. */
function threadCursor(queryClient: QueryClient, conversationId: string | undefined): number {
  if (conversationId === undefined) return 0;
  const window = queryClient.getQueryData<ChatThreadWindow>(
    chatQueryKeys.thread(conversationId)
  );
  return window ? threadLastRevSeq(window) : 0;
}

/**
 * Fold an edit or a tombstone into the cached window, where the anchored
 * refetch cannot reach it. A no-op for a thread nobody has read and for a
 * message outside the loaded window — an id we do not hold is not a hole.
 */
function applyThreadRevision(
  queryClient: QueryClient,
  message: ChatMessagePayload
): void {
  const key = chatQueryKeys.thread(message.conversation_id);
  const window = queryClient.getQueryData<ChatThreadWindow>(key);
  if (window === undefined) return;
  const next = applyRevision(window, message);
  if (next !== window) queryClient.setQueryData(key, next);
}

/**
 * `stream: null` means this SURFACE has no stream to watch — the inbox of a
 * list that was never told who is reading it. It is not "disabled": nothing
 * was switched off, there is simply no key, and the seam says `no_socket`
 * rather than pretending the socket is on its way.
 */
export function useChatFreshness(
  stream: ChatStream | null,
  mapToQueryKeys: ChatSignalKeyMap,
  options?: ChatFreshnessOptions
): ChatFreshness {
  const runtime = useChatRuntime();
  const queryClient = useQueryClient();
  const enabled = options?.enabled ?? true;
  const socketEnabled = options?.socketEnabled ?? true;
  const interval = options?.fallbackRefetchInterval ?? 0;

  // Plain values, compared by value in the dependency lists below — no memo
  // needed, and no memo to forget to update.
  const socketUrl =
    stream === null ? null : chatSocketUrl(runtime.realtime.socketOrigin, stream);
  // A key is required to call `useStream` at all; with no stream there is
  // nothing to subscribe to, so the hook runs disabled on a key that is never
  // sent anywhere.
  const streamKey = stream?.key ?? "chat:none";
  const conversationId = stream?.conversationId;
  const journal = stream?.journal ?? false;
  const hasSocket = socketUrl !== null;
  const socketOn = enabled && socketEnabled && hasSocket;

  // The mapping function is a call-site lambda; keeping it in a ref is what
  // stops every render from tearing the subscription down.
  const mapRef = useRef<ChatSignalKeyMap>(mapToQueryKeys);
  useEffect(() => {
    mapRef.current = mapToQueryKeys;
  });

  const failuresRef = useRef(0);
  const [visible, setVisible] = useState<boolean>(documentVisible);

  /** Refetch everything the signals touch. Resolves `true` if any read failed. */
  const refresh = useCallback(
    async (signals: readonly ChatSignal[]): Promise<boolean> => {
      const seen = new Set<string>();
      const keys: QueryKey[] = [];
      for (const signal of signals) {
        for (const key of mapRef.current(signal)) {
          const id = JSON.stringify(key);
          if (seen.has(id)) continue;
          seen.add(id);
          keys.push(key);
        }
      }
      if (keys.length === 0) return false;
      await Promise.all(
        keys.map((queryKey) => queryClient.refetchQueries({ queryKey, type: "active" }))
      );
      return keys.some((queryKey) =>
        queryClient
          .getQueryCache()
          .findAll({ queryKey })
          .some((query) => query.state.status === "error")
      );
    },
    [queryClient]
  );

  const pollNow = useCallback((): void => {
    void refresh([{ kind: "tick" }]);
  }, [refresh]);

  // ── the socket half ────────────────────────────────────────────────────────
  //
  // Frames arriving in a burst (a replay after a resume) are buffered and
  // flushed once: a catch-up of forty messages is one refetch, not forty.
  const buffered = useRef<ChatSignal[]>([]);
  const flushHandle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const push = useCallback(
    (signal: ChatSignal): void => {
      buffered.current.push(signal);
      if (flushHandle.current !== undefined) return;
      flushHandle.current = setTimeout(() => {
        const signals = buffered.current;
        buffered.current = [];
        flushHandle.current = undefined;
        void refresh(signals);
      }, FLUSH_DELAY_MS);
    },
    [refresh]
  );
  useEffect(
    () => () => {
      if (flushHandle.current !== undefined) clearTimeout(flushHandle.current);
      flushHandle.current = undefined;
    },
    []
  );

  const onFrame = useCallback(
    (frame: RealtimeFrame): void => {
      const message = readChatMessageFrame(frame);
      if (message !== null) {
        const revision = message.edited || message.deleted;
        // An edit or a tombstone keeps its `seq`, so no anchored refetch can
        // reach it — apply it where it lives. A new line is left to the REST
        // read, which is the only place attachments arrive rendered.
        if (revision) applyThreadRevision(queryClient, message);
        push({
          kind: "message",
          conversationId: message.conversation_id,
          seq: message.seq,
          revSeq: message.rev_seq,
          revision,
          message,
        });
        return;
      }
      const marker = readChatMarkerFrame(frame);
      if (marker !== null) {
        push({
          kind: "marker",
          conversationId: marker.conversation_id,
          userId: marker.user_id,
          seq: marker.seq,
          marker: frame.type === "chat.read" ? "read" : "delivered",
        });
        return;
      }
      const activity = readChatActivityFrame(frame);
      if (activity !== null) {
        push({
          kind: "activity",
          conversationId: activity.conversation_id,
          userId: activity.user_id,
          state: activity.state,
          ttlMs: activity.ttl_s * 1000,
        });
        return;
      }
      const inbox = readChatInboxFrame(frame);
      if (inbox !== null) {
        push({
          kind: "inbox",
          conversationId: inbox.conversation_id,
          lastSeq: inbox.last_seq,
        });
      }
      // `welcome`, `replay_done`, `ping`/`pong` and `kick` carry no news the
      // store needs: the substrate answers the heartbeat itself, and every
      // message they bracket arrives as its own frame.
    },
    [push, queryClient]
  );

  const wasLive = useRef(false);
  const onState = useCallback(
    (next: RealtimeStreamStatus): void => {
      if (next.state === "resync") {
        // The gap is wider than the server's replay window. The journal is
        // the truth; go and read it.
        push({ kind: "resync", conversationId: conversationId ?? null });
      }
      const live = next.state === "live";
      // An EPHEMERAL stream cannot replay what it missed while it was down —
      // that is the contract, not a defect — so coming back is the moment to
      // re-read. A journal stream needs no such nudge: its replay is the
      // catch-up.
      if (live && !wasLive.current && !journal) push({ kind: "tick" });
      wasLive.current = live;
    },
    [push, conversationId, journal]
  );

  const lastSeq = useCallback(
    (): number => (journal ? threadCursor(queryClient, conversationId) : 0),
    [journal, queryClient, conversationId]
  );

  const { status, send, reconnect } = useStream(streamKey, {
    optional: true,
    enabled: socketOn,
    ...(socketUrl !== null ? { url: socketUrl } : {}),
    lastSeq,
    onFrame,
    onState,
  });

  // Client-wide facts — `never_connected`, `reconnecting_long`, and a session
  // refresh in flight. Consulted only to sharpen a stream already known to be
  // down (see `chatDegradation` and `withRenewingCredential`).
  const clientState = useRealtimeState();

  // ── the credential question, debounced ─────────────────────────────────────
  //
  // `RealtimeState.refreshing` is what the cutover did not have: a 4401 is
  // inside core's single-flight refresh RIGHT NOW. Nothing else knows that.
  // The stream reads `reconnecting` here — the same word an ordinary network
  // blip gets — and a person whose credential is being renewed and a person
  // on a flaky train deserve different sentences.
  //
  // This timer is the whole debounce mechanism, and the only timer this hook
  // owns for the purpose: `refreshing.since` is a timestamp, and a timestamp
  // does not re-render, so a refresh that hangs would never cross its
  // threshold on screen without something waking the hook. It is armed for
  // exactly the moment it crosses and torn down the instant the refresh
  // lands, so nothing outlives the question — which is what lets
  // `withRenewingCredential` stay a pure read of the CURRENT state instead of
  // a latch that remembers a renewal and starts implying its outcome.
  const clock = runtime.realtime.client.now ?? Date.now;
  const schedule = runtime.realtime.client.schedule ?? defaultSchedule;
  const refreshingSince = clientState.refreshing?.since ?? null;
  const [, setDebounceTick] = useState(0);
  useEffect(() => {
    if (refreshingSince === null) return;
    const remaining = RENEWING_CREDENTIAL_DEBOUNCE_MS - (clock() - refreshingSince);
    if (remaining <= 0) return;
    return schedule(() => {
      setDebounceTick((tick) => tick + 1);
    }, remaining);
  }, [refreshingSince, clock, schedule]);

  // ── the polling half ───────────────────────────────────────────────────────
  //
  // Runs whenever the socket is NOT carrying the stream, and never while the
  // tab is in the background (nobody is reading; the catch-up happens on the
  // way back).
  const live = status.state === "live" || status.state === "replaying";
  const polling = enabled && interval > 0 && visible && !live;
  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    let handle: ReturnType<typeof setTimeout> | undefined;
    const arm = (delay: number): void => {
      handle = setTimeout(() => {
        void refresh([{ kind: "tick" }]).then((failed) => {
          if (cancelled) return;
          // Consecutive failures back off exponentially; one success resets
          // it. A backend that is down must not be asked twenty times a
          // minute by every open tab.
          failuresRef.current = failed
            ? Math.min(failuresRef.current + 1, MAX_BACKOFF_STEPS)
            : 0;
          arm(interval * 2 ** failuresRef.current);
        });
      }, delay);
    };
    arm(interval * 2 ** failuresRef.current);
    return () => {
      cancelled = true;
      if (handle !== undefined) clearTimeout(handle);
    };
  }, [polling, interval, refresh]);

  // ── visibility ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = (): void => {
      const nowVisible = document.visibilityState !== "hidden";
      setVisible(nowVisible);
      // Coming back is the moment the reader most wants the truth.
      if (nowVisible) void refresh([{ kind: "tick" }]);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const transport: ChatTransport = live ? "socket" : polling ? "polling" : "idle";

  // `transport` says WHAT is carrying the stream; this says why it is not the
  // socket. The pair is the whole point: "polling" alone is the label that
  // made a broken handshake look like a product decision.
  //
  // The refresh overlay goes on LAST and changes nothing but the name of a
  // silence that is already being reported. It cannot invent a degradation
  // where there was none, it cannot speak over a refusal, and it disappears
  // by itself when the field clears — the three landings below it are read
  // exactly as they were before it existed.
  const degradation = withRenewingCredential(
    chatDegradation(status, clientState.degradation, {
      hasSocket,
      attempted: enabled && socketEnabled,
    }),
    clientState.refreshing,
    clock()
  );
  const degradedReason = degradation?.reason ?? null;
  const degradedAttempt = degradation?.attempt ?? 0;
  const degradedSince = degradation?.since;
  const degradedKey = degradation?.messageKey ?? "";

  return useMemo(
    () => ({
      transport,
      status,
      degraded:
        degradedReason === null
          ? null
          : {
              reason: degradedReason,
              attempt: degradedAttempt,
              since: degradedSince,
              messageKey: degradedKey,
            },
      pollNow,
      reconnect,
      send,
    }),
    [
      transport,
      status,
      degradedReason,
      degradedAttempt,
      degradedSince,
      degradedKey,
      pollNow,
      reconnect,
      send,
    ]
  );
}
