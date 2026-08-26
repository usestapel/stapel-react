import { useCallback, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { isLoadReady, loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { RealtimeStreamStatus } from "@stapel/realtime";
import type { NoProviderStatus } from "@stapel/realtime/react";
import type { ChatMessage, Conversation } from "../api/types.js";
import { useThread } from "../model/queries.js";
import { useLoadOlderMessages, useMarkRead } from "../model/mutations.js";
import { chatQueryKeys } from "../model/queryKeys.js";
import { threadLastSeq } from "../model/threadWindow.js";
import { createChatSocketWrites } from "../model/socketWrites.js";
import type { ChatSocketWrites } from "../model/socketWrites.js";
import { THREAD_INTERVAL_MS, useChatFreshness } from "../flows/freshness.js";
import type { ChatDegraded, ChatSignal, ChatTransport } from "../flows/freshness.js";
import {
  chatConversationStream,
  chatStreamForConversation,
} from "../realtime/streams.js";

/** Render-prop bag for {@link ConversationThread}. */
export interface ConversationThreadBag {
  /**
   * The thread, ascending by `seq`, as a state a skin cannot flatten. The
   * messages are a contiguous run: a hole is never rendered, it is healed by
   * a re-read (see `model/threadWindow.ts`).
   */
  readonly state: LoadState<readonly ChatMessage[]>;
  /** Older history exists before the first loaded message. */
  readonly hasOlder: boolean;
  readonly isLoadingOlder: boolean;
  /** Page one window of older history onto the front. */
  loadOlder(): void;
  refetch(): void;
  /** The tip — the highest `seq` loaded. 0 for an empty or unloaded thread. */
  readonly lastSeq: number;
  /** Which transport is carrying this thread right now. */
  readonly transport: ChatTransport;
  /** The substrate's own stream state, unflattened. */
  readonly status: RealtimeStreamStatus | NoProviderStatus;
  /**
   * `null` while the socket is carrying this thread; otherwise the NAMED
   * reason it is not, with the i18n key to say so. A skin that renders
   * `transport` alone tells a person "Refreshing every few seconds" whether
   * the deployment has no sockets or their credential was just refused —
   * which is the exact silence this pair shipped for months.
   */
  readonly degraded: ChatDegraded | null;
  /** Clear a refusal and reconnect — the button beside a visible refusal. */
  reconnect(): void;
  /**
   * Chat's socket-WRITE seam (the substrate's one documented exception).
   * `available: false` when no socket is open — the REST twins
   * (`useSendMessage`, `useMarkRead`) are the default path and stay so.
   */
  readonly socket: ChatSocketWrites;
}

/**
 * Headless conversation thread: replay plus live tail, over whichever
 * transport this deployment has.
 *
 * The socket subscription starts only once the window is loaded, and that is
 * deliberate: `hello{last_seq}` with a cursor of 0 asks the server to replay
 * the entire revision journal over the socket, which the store would then
 * throw away and re-read by REST. Loading first makes the resume carry a real
 * cursor — and the cursor is `rev_seq`, not the thread's `seq`.
 *
 * The read marker advances automatically to the tip while the thread is
 * mounted (`autoMarkRead`, on by default): the person is looking at these
 * messages. It only ever moves forward — `useMarkRead` drops a candidate at
 * or below what was already reported, so a remount or a re-render costs
 * nothing.
 */
export function ConversationThread(props: {
  conversationId: string;
  /**
   * The conversation row, when the caller holds one. Its `stream_key` and
   * `socket_path` are the SERVER's own answer to where this thread lives, and
   * they win over anything derived from the id here.
   */
  conversation?: Conversation;
  limit?: number;
  /** Poll period in ms while the socket is not carrying this thread. */
  refreshIntervalMs?: number;
  /** Advance the read marker to the tip while mounted. Default `true`. */
  autoMarkRead?: boolean;
  children: (bag: ConversationThreadBag) => ReactNode;
}): ReactNode {
  const { conversationId, conversation } = props;
  const query = useThread(conversationId, props.limit);
  const older = useLoadOlderMessages(conversationId, props.limit);
  const markRead = useMarkRead(conversationId);

  const mapKeys = useCallback(
    (signal: ChatSignal) =>
      // "typing…" expires on its own hint; there is nothing on the server to
      // go and read, and refetching a thread on every keystroke of the other
      // party is how a courtesy frame becomes a load test.
      signal.kind === "activity"
        ? []
        : [
            chatQueryKeys.thread(conversationId),
            // A new message also moves this thread up the list and changes
            // its unread badge — one signal, two reads.
            chatQueryKeys.conversations(),
          ],
    [conversationId]
  );
  const windowState = loadStateFromQuery(query);
  const loaded = isLoadReady(windowState);
  const stream =
    conversation !== undefined
      ? chatStreamForConversation(conversation)
      : chatConversationStream(conversationId);
  const freshness = useChatFreshness(stream, mapKeys, {
    socketEnabled: loaded,
    fallbackRefetchInterval: props.refreshIntervalMs ?? THREAD_INTERVAL_MS,
  });

  const lastSeq = isLoadReady(windowState) ? threadLastSeq(windowState.data) : 0;
  const autoMarkRead = props.autoMarkRead ?? true;
  const markReadMutate = markRead.mutate;
  useEffect(() => {
    if (!autoMarkRead || lastSeq === 0) return;
    markReadMutate(lastSeq);
  }, [autoMarkRead, lastSeq, markReadMutate]);

  const socketSend = freshness.send;
  const socketLive = freshness.transport === "socket";
  const socket = useMemo(
    () => createChatSocketWrites(socketSend, socketLive),
    [socketSend, socketLive]
  );

  return props.children({
    state: mapLoad(windowState, (window) => window.messages),
    hasOlder: isLoadReady(windowState) ? windowState.data.hasOlder : false,
    isLoadingOlder: older.isPending,
    loadOlder: () => {
      older.mutate();
    },
    refetch: () => {
      void query.refetch();
    },
    lastSeq,
    transport: freshness.transport,
    status: freshness.status,
    degraded: freshness.degraded,
    reconnect: freshness.reconnect,
    socket,
  });
}
