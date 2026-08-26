/**
 * THE TRANSPORT SEAM. One hook, two transports, and no screen that knows
 * which one is running.
 *
 * ── What changed since the spec ─────────────────────────────────────────────
 *
 * The storefront spec §3.6 ruled polling-by-seq for chat v1,
 * and it was right about the fleet it surveyed: stapel-chat had the resumable
 * consumer but `routing.py` exported nothing, so no host could mount it.
 * stapel-chat 0.2.2 ships that mount (`ws/chat/<uuid:conversation_id>`) and
 * the client fleet runs it. So the pair carries BOTH transports and picks at
 * runtime — a deployment without sockets (WSGI, no channel layer, a
 * misconfigured proxy) is not a broken chat, it is a chat that refreshes on a
 * timer.
 *
 * ── The shape, and why it is this shape ─────────────────────────────────────
 *
 * `useChatFreshness(streamKey, mapToQueryKeys, { fallbackRefetchInterval })`
 * is deliberately the signature §3.6 specified and the realtime substrate
 * spec (§7) reserves for `useSignalInvalidate`: a signal maps to query keys,
 * the keys are refetched, and the fallback interval turns the same interface
 * into polling. Both halves therefore end in the same place — a refetch of
 * the thread query, whose query function advances the window BY SEQ
 * (`model/queries.ts`). A socket frame does not carry its payload into the
 * cache; it says "there is something after your tip", and the store goes and
 * gets it. That is resync-by-refetch as a first-class construction, and it is
 * why the tests below hold for both transports without a branch.
 *
 * ── The replacement criterion, stated up front ──────────────────────────────
 *
 * When `@stapel/realtime` phase 1 lands, THIS FILE is the migration: `createChatSocket`
 * goes away, `useSignalInvalidate` takes its place, and the pair's tests must
 * stay green with no edits. Nothing above this file imports `realtime/`, so
 * the blast radius is checkable rather than promised. There is no
 * "TODO: replace with sockets" comment anywhere in this package — there is a
 * seam with one consumer and a written criterion.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useChatRuntime } from "../model/context.js";
import { chatQueryKeys } from "../model/queryKeys.js";
import { threadLastSeq } from "../model/threadWindow.js";
import type { ChatThreadWindow } from "../model/threadWindow.js";
import { createChatSocket } from "../realtime/chatSocket.js";
import type {
  ChatConnectionState,
  ChatSocketRefusal,
  ChatSocketStatus,
} from "../realtime/chatSocket.js";
import { CHAT_WS_RESYNC } from "../realtime/frames.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { chatSocketUrl } from "../realtime/streams.js";
import type { ChatStreamKey } from "../realtime/streams.js";

/**
 * What a transport reports upward. One vocabulary for both, so the mapping
 * function does not care where the news came from:
 *
 *  - `message` — a specific message landed (socket only),
 *  - `resync` — the stream gave up on incremental delivery; re-read the
 *    journal (socket `error{resync}`),
 *  - `tick` — a scheduled "check for news" (polling), or a catch-up after a
 *    reconnect.
 */
export type ChatSignal =
  | { readonly kind: "message"; readonly conversationId: string; readonly seq: number }
  | { readonly kind: "resync"; readonly conversationId: string }
  | { readonly kind: "tick" };

/** Signal → the query keys it makes stale. The whole contract with the UI. */
export type ChatSignalKeyMap = (signal: ChatSignal) => readonly QueryKey[];

/** Which transport is actually carrying freshness right now. */
export type ChatTransport = "socket" | "polling" | "idle";

/**
 * Why the socket is NOT carrying this stream. One name per situation, and
 * every one of them reaches the UI.
 *
 * This type is the fix for the defect that produced this pair's worst bug.
 * `transport: "polling"` was true and useless: it read the same whether the
 * deployment has no sockets, the credential was refused, or the retry budget
 * ran out. A person saw "Refreshing every few seconds" and read it as a
 * design decision, and so did everyone reporting that "the websockets are
 * done". A degraded mode that cannot say why is indistinguishable from a
 * working product, which is exactly how it survives.
 *
 *  - `reconnecting` — the socket dropped; a retry is scheduled. Transient.
 *  - `renewing_credential` — the handshake was refused (4401) and the host's
 *    renewal seam is being asked for a fresh credential. Transient.
 *  - `sign_in_required` — the credential was refused and could not be
 *    renewed. The person has to do something; say so.
 *  - `forbidden` — this account may not read this stream (4403 / 4404 /
 *    4410, including a cookie handshake from an origin the deployment does
 *    not allow-list). Nothing the client does changes it.
 *  - `unsupported` — the server rejected this build's frames (4400). A
 *    deploy fixes it; a retry does not.
 *  - `unreachable` — the retry budget is spent. The socket is down and this
 *    stream is on a timer until something changes.
 *  - `no_socket` — this build has no socket for this stream at all: an
 *    explicit `socketUrl: null`, an origin that cannot be resolved, or a
 *    stream the pair mounts no socket for. Legitimate, and still named:
 *    "always polling" must be a fact someone can read, not a silence.
 */
export type ChatDegradedReason =
  | "reconnecting"
  | "renewing_credential"
  | "sign_in_required"
  | "forbidden"
  | "unsupported"
  | "unreachable"
  | "no_socket";

/** The named degradation the UI renders. `null` means the socket is live. */
export interface ChatDegraded {
  readonly reason: ChatDegradedReason;
  /** Consecutive failed connects — 0 when the socket never got to try. */
  readonly attempt: number;
  /**
   * The i18n key for this degradation, carried in the bag so a skin cannot
   * accidentally render a degraded transport as an unlabelled one. A skin may
   * of course use `reason` and its own copy instead.
   */
  readonly messageKey: string;
}

const DEGRADED_KEYS: Readonly<Record<ChatDegradedReason, string>> = {
  reconnecting: CHAT_I18N_KEYS.transportReconnecting,
  renewing_credential: CHAT_I18N_KEYS.transportRenewing,
  sign_in_required: CHAT_I18N_KEYS.transportSignInRequired,
  forbidden: CHAT_I18N_KEYS.transportForbidden,
  unsupported: CHAT_I18N_KEYS.transportUnsupported,
  unreachable: CHAT_I18N_KEYS.transportUnreachable,
  no_socket: CHAT_I18N_KEYS.transportNoSocket,
};

function degraded(reason: ChatDegradedReason, attempt: number): ChatDegraded {
  return { reason, attempt, messageKey: DEGRADED_KEYS[reason] };
}

/** The refusal a stopped socket ended on → what a person is told. */
function refusalDegradation(
  refusal: ChatSocketRefusal,
  attempt: number
): ChatDegraded {
  switch (refusal) {
    case "unauthenticated":
      return degraded("sign_in_required", attempt);
    case "forbidden":
    case "unknown_stream":
    case "revoked":
      return degraded("forbidden", attempt);
    case "protocol":
      return degraded("unsupported", attempt);
    default:
      return degraded("unreachable", attempt);
  }
}

/**
 * The whole "is this stream live, and if not why not" question, in one pure
 * function so both the hook and its tests read the same answer.
 *
 * `attempted` is false while the socket is deliberately held back (the thread
 * window has not loaded yet — see `socketEnabled`): nothing has failed, so
 * nothing is degraded.
 */
export function chatDegradation(
  status: ChatSocketStatus,
  options: { readonly hasSocket: boolean; readonly attempted: boolean }
): ChatDegraded | null {
  if (!options.attempted) return null;
  if (!options.hasSocket) return degraded("no_socket", 0);
  switch (status.state) {
    case "open":
      return null;
    case "connecting":
      // A first connect has no close reason behind it; a reconnect does.
      if (status.reason === undefined) return null;
      return status.reason === "credential_rejected"
        ? degraded("renewing_credential", status.attempt)
        : degraded("reconnecting", status.attempt);
    case "degraded":
      return degraded("reconnecting", status.attempt);
    default:
      return status.refusal === undefined
        ? null
        : refusalDegradation(status.refusal, status.attempt);
  }
}

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
   * `hello{last_seq: 0}` asks the server to replay the whole thread over the
   * socket, which the store would then discard and re-read by REST. So
   * `<ConversationThread>` holds the socket back until the window is loaded,
   * while polling stays on — polling is also how a FAILED first read
   * recovers, and switching that off with the socket would leave a broken
   * thread broken until someone pressed something.
   *
   * The substrate is expected to subsume this: a stream that owns its own
   * cursor knows when it has one.
   */
  readonly socketEnabled?: boolean;
}

export interface ChatFreshness {
  readonly transport: ChatTransport;
  readonly connection: ChatConnectionState;
  /** Why the socket will not come back, when it will not. */
  readonly refusal: ChatSocketRefusal | undefined;
  /**
   * `null` while the socket is carrying this stream; otherwise the NAMED
   * reason it is not. Never silently absent — see {@link ChatDegradedReason}.
   */
  readonly degraded: ChatDegraded | null;
  /** Check for news right now (a pull-to-refresh, a regained focus). */
  pollNow(): void;
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

const IDLE_STATUS: ChatSocketStatus = {
  state: "closed",
  refusal: undefined,
  reason: undefined,
  attempt: 0,
};

function documentVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

export function useChatFreshness(
  stream: ChatStreamKey,
  mapToQueryKeys: ChatSignalKeyMap,
  options?: ChatFreshnessOptions
): ChatFreshness {
  const runtime = useChatRuntime();
  const queryClient = useQueryClient();
  const enabled = options?.enabled ?? true;
  const socketEnabled = options?.socketEnabled ?? true;
  const interval = options?.fallbackRefetchInterval ?? 0;

  // Both are plain values, compared by value in the dependency lists below —
  // no memo needed, and no memo to forget to update.
  const socketUrl = chatSocketUrl(runtime.realtime.socketBase, stream);
  const conversationId = stream.kind === "conversation" ? stream.conversationId : null;

  // The mapping function is a call-site lambda; keeping it in a ref is what
  // stops every render from tearing down the socket.
  const mapRef = useRef<ChatSignalKeyMap>(mapToQueryKeys);
  useEffect(() => {
    mapRef.current = mapToQueryKeys;
  });

  const failuresRef = useRef(0);
  const [status, setStatus] = useState<ChatSocketStatus>(IDLE_STATUS);
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
  const socketFactory = runtime.realtime.webSocket;
  const reconnect = runtime.realtime.reconnect;
  const credential = runtime.realtime.credential;
  const renewCredential = runtime.realtime.renewCredential;
  useEffect(() => {
    if (!enabled || !socketEnabled || socketUrl === null || conversationId === null) {
      setStatus(IDLE_STATUS);
      return;
    }
    let buffered: ChatSignal[] = [];
    let flushHandle: ReturnType<typeof setTimeout> | undefined;
    const flush = (): void => {
      const signals = buffered;
      buffered = [];
      flushHandle = undefined;
      void refresh(signals);
    };
    const push = (signal: ChatSignal): void => {
      buffered.push(signal);
      if (flushHandle === undefined) flushHandle = setTimeout(flush, FLUSH_DELAY_MS);
    };

    const socket = createChatSocket({
      url: socketUrl,
      // Read at every connect: the store keeps advancing by REST while the
      // socket is down, and resuming from a stale cursor is how a reconnect
      // turns into a duplicate storm.
      lastSeq: () => {
        const window = queryClient.getQueryData<ChatThreadWindow>(
          chatQueryKeys.thread(conversationId)
        );
        return window ? threadLastSeq(window) : 0;
      },
      onFrame: (frame) => {
        if (frame.type === "message") {
          push({ kind: "message", conversationId, seq: frame.seq });
          return;
        }
        if (frame.type === "error" && frame.code === CHAT_WS_RESYNC) {
          // The gap is wider than the replay window. The journal is the
          // truth; go and read it.
          push({ kind: "resync", conversationId });
        }
        // `welcome`, `replay_done` and `pong` carry no news the store needs:
        // every message they bracket arrives as its own frame.
      },
      onStatus: setStatus,
      // The credential channel. Absent, the handshake goes out on the cookie
      // the browser attaches by itself — which is a real channel, not the
      // absence of one, and is now named as such.
      ...(credential !== undefined ? { credential } : {}),
      ...(renewCredential !== undefined ? { renewCredential } : {}),
      ...(socketFactory !== undefined ? { webSocket: socketFactory } : {}),
      ...(reconnect !== undefined ? { reconnect } : {}),
    });

    return () => {
      if (flushHandle !== undefined) clearTimeout(flushHandle);
      socket.close();
    };
  }, [
    enabled,
    socketEnabled,
    socketUrl,
    conversationId,
    queryClient,
    refresh,
    socketFactory,
    reconnect,
    credential,
    renewCredential,
  ]);

  // ── the polling half ───────────────────────────────────────────────────────
  //
  // Runs whenever the socket is NOT carrying the stream — including the
  // inbox, which has no socket at all — and never while the tab is in the
  // background (nobody is reading; the catch-up happens on the way back).
  const polling = enabled && interval > 0 && visible && status.state !== "open";
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

  const transport: ChatTransport =
    status.state === "open" ? "socket" : polling ? "polling" : "idle";

  // `transport` says WHAT is carrying the stream; this says why it is not the
  // socket. The pair is the whole point: "polling" alone is the label that
  // made a broken handshake look like a product decision.
  const degradation = chatDegradation(status, {
    hasSocket: socketUrl !== null && conversationId !== null,
    attempted: enabled && socketEnabled,
  });
  const degradedReason = degradation?.reason ?? null;
  const degradedAttempt = degradation?.attempt ?? 0;

  return useMemo(
    () => ({
      transport,
      connection: status.state,
      refusal: status.refusal,
      degraded:
        degradedReason === null ? null : degraded(degradedReason, degradedAttempt),
      pollNow,
    }),
    [
      transport,
      status.state,
      status.refusal,
      degradedReason,
      degradedAttempt,
      pollNow,
    ]
  );
}
