import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  QueryClient,
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type { ChatMessage, Conversation } from "../api/types.js";
import { useChatApi } from "./context.js";
import { chatQueryKeys } from "./queryKeys.js";
import { nextReadMarker } from "./readMarker.js";
import { THREAD_PAGE } from "./queries.js";
import { mergeMessage, mergeOlderPage } from "./threadWindow.js";
import type { ChatThreadWindow } from "./threadWindow.js";

/**
 * Write hooks (frontend-standard §2 — mutations invalidate on success).
 *
 * Sending is REST, always: the socket's `send` frame refuses with a
 * socket-local code that has no i18n key and no remediation, while the HTTP
 * path answers with the persisted row and a real error envelope. See
 * `realtime/frames.ts`.
 */

/** Fold a freshly-known message into the cached window, or re-read on a hole. */
function absorbMessage(
  queryClient: QueryClient,
  conversationId: string,
  message: ChatMessage
): void {
  const key = chatQueryKeys.thread(conversationId);
  const window = queryClient.getQueryData<ChatThreadWindow>(key);
  if (!window) return;
  const merged = mergeMessage(window, message);
  if (merged.gap) {
    void queryClient.invalidateQueries({ queryKey: key });
    return;
  }
  queryClient.setQueryData(key, merged.window);
}

/** Variables for {@link useSendMessage}. */
export interface SendMessageVariables {
  readonly body: string;
  /** Quoted message id; must belong to this conversation. */
  readonly replyTo?: string;
}

/**
 * Append a message to a thread. On success the persisted row (with its `seq`)
 * is folded straight into the window, so the sender sees their own line
 * without waiting for a poll — and the socket's fan-out copy of the same row
 * is then a duplicate that `mergeMessage` drops.
 *
 * Attachments are NOT wired in this version (spec §4.5): the field exists on
 * the wire, but shipping it would mean shipping CDN upload rights into chat,
 * and a control that is visible but does nothing is worse than one that is
 * absent.
 */
export function useSendMessage(
  conversationId: string
): UseMutationResult<ChatMessage, StapelApiError, SendMessageVariables> {
  const api = useChatApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    ChatMessage,
    StapelApiError,
    SendMessageVariables
  > = {
    mutationFn: (vars) =>
      api.sendMessage(conversationId, {
        body: vars.body,
        ...(vars.replyTo !== undefined ? { reply_to: vars.replyTo } : {}),
      }),
    onSuccess: (message) => {
      absorbMessage(queryClient, conversationId, message);
      // The list orders by `updated_at` and carries the unread badge; both
      // just moved.
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversations(),
      });
    },
  };
  return useMutation(options);
}

/**
 * Advance the caller's read marker to `upto_seq`.
 *
 * Monotonic on the client as well as on the server: a candidate at or below
 * what this client already reported resolves without a request
 * (`nextReadMarker`). The reported value is remembered in the query cache —
 * see `readMarker.ts` for why it cannot be read back off the wire.
 */
export function useMarkRead(
  conversationId: string
): UseMutationResult<number | null, StapelApiError, number> {
  const api = useChatApi();
  const queryClient = useQueryClient();
  const markerKey = chatQueryKeys.readMarker(conversationId);
  const options: UseMutationOptions<number | null, StapelApiError, number> = {
    mutationFn: async (candidate) => {
      const known = queryClient.getQueryData<number>(markerKey);
      const seq = nextReadMarker(known, candidate);
      if (seq === null) return null;
      await api.markRead(conversationId, seq);
      return seq;
    },
    onSuccess: (seq) => {
      if (seq === null) return;
      queryClient.setQueryData(markerKey, seq);
      // The badge is server-computed; re-read it rather than guessing.
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversations(),
      });
    },
  };
  return useMutation(options);
}

/** Variables for {@link useStartDirectChat}. */
export interface StartDirectChatVariables {
  /** The other person — the seller, on a listing page. */
  readonly userId: string;
}

/**
 * Open the direct thread with someone, creating it only if it does not exist.
 *
 * The idempotency is the module's, not ours: a direct thread is keyed by an
 * order-independent `direct_key` over the participant pair (namespaced by
 * scope) under a unique constraint, and the create race is resolved by the
 * constraint — the loser gets the winner's row (`MODULE.md`, "Direct
 * idempotency"). So "message the seller" is safe to press twice, from two
 * tabs, on two listings.
 *
 * TWO PEOPLE, ONE THREAD — INCLUDING ACROSS LISTINGS. The key is the pair,
 * not the listing: a buyer who writes to the same seller about a second item
 * lands in the same conversation. `CreateConversationRequest.scope_key` does
 * not change that (the server ignores the field and resolves the scope
 * itself — `api/extensions.ts`), so a host that wants the listing named must
 * name it in the first message.
 */
export function useStartDirectChat(): UseMutationResult<
  Conversation,
  StapelApiError,
  StartDirectChatVariables
> {
  const api = useChatApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    Conversation,
    StapelApiError,
    StartDirectChatVariables
  > = {
    mutationFn: (vars) => api.createConversation("direct", [vars.userId]),
    onSuccess: (conversation) => {
      queryClient.setQueryData(
        chatQueryKeys.conversation(conversation.id),
        conversation
      );
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversations(),
      });
    },
  };
  return useMutation(options);
}

/**
 * Backfill one page of older history onto the front of the window
 * (`direction=next` from the window's oldest seq — "next" is OLDER here,
 * because the history is ordered `-seq`).
 *
 * A mutation rather than a second query: it is an action a person takes
 * ("show me more"), it must not re-run on focus, and its result belongs in
 * the ONE thread cache entry rather than in a second one that would then have
 * to be reconciled with it.
 */
export function useLoadOlderMessages(
  conversationId: string,
  limit: number = THREAD_PAGE
): UseMutationResult<ChatThreadWindow | null, StapelApiError, void> {
  const api = useChatApi();
  const queryClient = useQueryClient();
  const key = chatQueryKeys.thread(conversationId);
  const options: UseMutationOptions<
    ChatThreadWindow | null,
    StapelApiError,
    void
  > = {
    mutationFn: async () => {
      const window = queryClient.getQueryData<ChatThreadWindow>(key);
      if (!window || !window.hasOlder || window.olderAnchor === null) return null;
      const page = await api.messages(conversationId, {
        direction: "next",
        anchor: window.olderAnchor,
        limit,
      });
      return mergeOlderPage(window, page);
    },
    onSuccess: (window) => {
      if (window === null) return;
      queryClient.setQueryData(key, window);
    },
  };
  return useMutation(options);
}
