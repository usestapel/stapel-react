import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type { Conversation, ConversationPage } from "../api/types.js";
import { useChatApi } from "./context.js";
import { chatQueryKeys } from "./queryKeys.js";
import {
  mergeNewerPage,
  threadLastSeq,
  threadWindowFromPage,
} from "./threadWindow.js";
import type { ChatThreadWindow } from "./threadWindow.js";

/**
 * Read hooks over the chat API. Staleness follows core's query defaults;
 * freshness is driven by the transport seam (`flows/freshness.ts`), never by
 * a `refetchInterval` sprinkled on a call site.
 *
 * Every hook is gated on {@link useActiveSessionReady}: chat is a member
 * surface with no natural `enabled` condition of its own, and a top-level
 * read that races a still-bootstrapping session reports "loaded, nothing
 * here" for the length of the bootstrap.
 */

/** Default page size for the conversation list. */
const CONVERSATIONS_PAGE = 20;
/** Default window size for a thread — one screenful of history and change. */
export const THREAD_PAGE = 50;

/** One conversation (participant-only; 403 otherwise). */
export function useConversation(
  conversationId: string
): UseQueryResult<Conversation, StapelApiError> {
  const api = useChatApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: chatQueryKeys.conversation(conversationId),
    queryFn: () => api.conversation(conversationId),
    enabled: sessionReady && conversationId.length > 0,
  });
}

/**
 * The caller's conversations as an infinite (load-more) list, anchored on
 * `updated_at`. `unread_count` is computed server-side per conversation, so
 * the badge needs no second request.
 */
export function useConversations(
  limit: number = CONVERSATIONS_PAGE
): UseInfiniteQueryResult<
  InfiniteData<ConversationPage, string | undefined>,
  StapelApiError
> {
  const api = useChatApi();
  const sessionReady = useActiveSessionReady();
  return useInfiniteQuery({
    queryKey: chatQueryKeys.conversations(),
    queryFn: ({ pageParam }) =>
      api.conversations({
        direction: "next",
        limit,
        ...(pageParam !== undefined ? { anchor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.has_next ? (last.next_anchor ?? undefined) : undefined,
    enabled: sessionReady,
  });
}

/**
 * The thread — one cache entry holding a contiguous, seq-ordered window
 * (`threadWindow.ts`).
 *
 * ITS REFETCH IS THE POLL. The query function reads the window already in the
 * cache and asks only for what comes after it
 * (`direction=prev&anchor=<tip>`), so `refetch()` means "advance by seq", not
 * "read the newest page again". That is what lets the transport seam stay a
 * signal → refetch bridge: a socket frame and a polling tick take the exact
 * same code path, and the UI cannot tell which arrived.
 *
 * A tail that does not touch the tip (more messages than one page holds, or
 * the paginator's own truncation flag) is a hole. Rather than render a thread
 * with a hole, the window is rebuilt from the newest page — the REST twin of
 * the socket's `error{resync}`, and the reason correctness never depends on
 * delivery.
 */
export function useThread(
  conversationId: string,
  limit: number = THREAD_PAGE
): UseQueryResult<ChatThreadWindow, StapelApiError> {
  const api = useChatApi();
  const queryClient = useQueryClient();
  const sessionReady = useActiveSessionReady();
  const queryKey = chatQueryKeys.thread(conversationId);
  return useQuery({
    queryKey,
    queryFn: async () => {
      const previous = queryClient.getQueryData<ChatThreadWindow>(queryKey);
      const tip = previous ? threadLastSeq(previous) : 0;
      if (!previous || tip === 0) {
        return threadWindowFromPage(await api.messages(conversationId, { limit }));
      }
      const tail = await api.messages(conversationId, {
        direction: "prev",
        anchor: String(tip),
        limit,
      });
      const merged = mergeNewerPage(previous, tail);
      if (!merged.gap) return merged.window;
      return threadWindowFromPage(await api.messages(conversationId, { limit }));
    },
    enabled: sessionReady && conversationId.length > 0,
  });
}
