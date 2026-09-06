import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  InfiniteData,
  QueryClient,
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  ChatMessage,
  Conversation,
  ConversationPage,
  SubjectRef,
} from "../api/types.js";
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
  /**
   * What the thread is ABOUT, by registered type (`listing`, …). Optional,
   * and both halves travel together or neither does — see {@link SubjectRef}.
   */
  readonly subject?: SubjectRef;
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
 * TWO PEOPLE, ONE THREAD — UNLESS THE THREAD HAS A SUBJECT. Without one the
 * key is the participant pair, so a buyer who writes to the same seller about
 * a second item lands in the same conversation, and neither party can tell
 * which item "still available?" was about. Pass `subject` and the key widens
 * to `(scope, {both user ids}, subject_type, subject_key)` — one thread per
 * listing, each able to show its own card.
 *
 * KNOWN CONSEQUENCE, ACCEPTED. The first contact WITH a subject opens a new
 * thread beside any subjectless one the two already have, which looks like a
 * duplicate to both of them. There is no migration that could avoid it: the
 * old threads were never told what they were about, so nothing can key them
 * retroactively. The skin's answer is not to hide it but to label it — a
 * thread with a subject carries the subject card at the top, and the one
 * without carries nothing, which is exactly the difference between them.
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
    mutationFn: (vars) =>
      api.createConversation("direct", [vars.userId], vars.subject),
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

/**
 * Take one row out of EVERY cached narrowing of the inbox.
 *
 * The list is keyed by its filter since stapel-chat 0.8.2 (`queryKeys.ts`), so
 * "the conversation list" is a family of cache entries — the unfiltered one,
 * the unread chip's, and one per search a person has typed. A row removed from
 * the entry that happens to be on screen would still be sitting in the other
 * three, waiting to be drawn again by a chip press. So this writes through the
 * two-element PREFIX, which is what that prefix is for.
 *
 * `count` follows the row it lost: a paginator's total that disagrees with the
 * items beside it is the kind of number that later gets rendered.
 */
function forgetConversationRow(
  queryClient: QueryClient,
  conversationId: string
): void {
  queryClient.setQueriesData<InfiniteData<ConversationPage, string | undefined>>(
    { queryKey: chatQueryKeys.conversations() },
    (data) => {
      if (data === undefined) return data;
      let removed = false;
      const pages = data.pages.map((page) => {
        const items = page.items.filter((row) => row.id !== conversationId);
        if (items.length === page.items.length) return page;
        removed = true;
        return {
          ...page,
          items,
          count: Math.max(0, page.count - (page.items.length - items.length)),
        };
      });
      return removed ? { ...data, pages } : data;
    }
  );
}

/**
 * LEAVE a conversation (stapel-chat 0.8.5) — the caller's own membership, and
 * nothing else.
 *
 * The variable is the conversation id rather than a hook argument, because
 * this is pressed from an inbox ROW as well as from inside a thread: one hook
 * serves a whole list instead of one per row.
 *
 * ── What moves in the cache, and what deliberately does not ───────────────
 *
 * The row is taken out of every cached list narrowing here, so the inbox
 * answers the press instead of blinking through a refetch — and then the list
 * is invalidated, because the server is the authority on what is on it.
 *
 * The THREAD's own cache entries are left alone. Leaving hides a thread; it
 * erases nothing, and the leaver still reaches their history by id — so a
 * client that dropped the window on the way out would be enforcing a rule the
 * contract does not have.
 *
 * ── No "I left" is remembered ─────────────────────────────────────────────
 *
 * There is no local set of left ids, on purpose (`model/membership.ts` states
 * it once). An AUTHORED message from the other side clears the marker for
 * everyone, so the row comes back on the next list read all by itself: it has
 * to simply APPEAR. A client suppressing it would need to be told to forget,
 * by an event nobody sends.
 *
 * ── The one refusal, and why it is not retried ────────────────────────────
 *
 * `DELETE` is idempotent — a second call is another `204` — so the only
 * failure that is really this request's is `error.403.chat_not_participant`,
 * which means the answer will be the same every time. `retry: false` says so
 * rather than spending three round trips on a settled question, and the row
 * is removed on the `204` and not on the press, so a refusal leaves the inbox
 * exactly as the person left it.
 */
export function useLeaveConversation(): UseMutationResult<
  void,
  StapelApiError,
  string
> {
  const api = useChatApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (conversationId) => api.leaveConversation(conversationId),
    retry: false,
    onSuccess: (_answer, conversationId) => {
      forgetConversationRow(queryClient, conversationId);
      // The server's own answer to "what is on this list" — and the path a
      // re-surfaced thread arrives back down.
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversations(),
      });
    },
  };
  return useMutation(options);
}
