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
import { useSettledInboxFilter } from "./inboxQuery.js";
import type { ChatInboxFilter } from "./inboxQuery.js";
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
 * the badge needs no second request, and every row carries the line it draws
 * (`last_message`, stapel-chat 0.8.3) so the first paint needs none either.
 *
 * THE FILTER IS THE SERVER'S (stapel-chat 0.8.2), which makes three things
 * true at once and all three are properties of the query, not of a skin:
 *
 *  · it is IN THE KEY, so a search has its own cache entry and its own pages
 *    — the answer to "bicycle" can never be stitched onto the answer to
 *    everything;
 *  · PAGING RESTARTS on any change, because a new key is a new entry whose
 *    `initialPageParam` is `undefined` — a "load more" pressed under one
 *    search cannot carry its anchor into the next;
 *  · the SEARCH IS DEBOUNCED here rather than at a call site
 *    (`useSettledInboxFilter`), so every consumer of this hook gets the same
 *    pause and no host has to remember to add one. The chip is not.
 *
 * ── THE OTHER LIST (stapel-chat 0.8.6) ────────────────────────────────────
 *
 * `filter.view === "left"` swaps the inbox for its exact complement: the
 * threads this person has LEFT, newest departure first. It is the same
 * endpoint with the same filter vocabulary, and it is nevertheless a
 * DIFFERENT LIST in every way a cache cares about — a different ordering, so
 * a different first page and a different anchor chain, and an `anchor` that
 * is a `left_at` where the inbox's is an `updated_at`. So it takes its own
 * cache entry (the `left` segment of the key) and its cursor is never handed
 * to the inbox. Sharing one entry would let a "load more" pressed on one tab
 * page the other with the wrong cursor, and produce a plausible wrong list
 * rather than an error.
 *
 * `search` narrows the left list exactly as it narrows the inbox, over the
 * same rule — with one consequence that looks like a bug and is not: a left
 * thread's last line IS the departure marker, an unlabelled marker draws
 * nothing and is found by nothing, so these rows are found by the
 * counterpart's name and the subject card's title and never by the last thing
 * said in them. The skin says so in the field's own placeholder.
 */
export function useConversations(
  limit: number = CONVERSATIONS_PAGE,
  filter?: ChatInboxFilter
): UseInfiniteQueryResult<
  InfiniteData<ConversationPage, string | undefined>,
  StapelApiError
> {
  const api = useChatApi();
  const sessionReady = useActiveSessionReady();
  const settled = useSettledInboxFilter(filter);
  return useInfiniteQuery({
    queryKey: chatQueryKeys.conversationList(settled),
    queryFn: ({ pageParam }) =>
      api.conversations({
        direction: "next",
        limit,
        ...(pageParam !== undefined ? { anchor: pageParam } : {}),
        // Omitted rather than sent empty — `conversationQuery` in the client
        // is where that rule lives, and it is the same rule the server
        // states: a blank search is no search.
        ...(settled.search !== "" ? { search: settled.search } : {}),
        ...(settled.unreadOnly ? { unread: true } : {}),
        ...(settled.left ? { left: true } : {}),
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
