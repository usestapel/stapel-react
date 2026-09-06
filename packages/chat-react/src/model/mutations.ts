import { useCallback, useSyncExternalStore } from "react";
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

/** Is this cache entry the LEFT list rather than the inbox? */
function keyIsLeftList(queryKey: readonly unknown[]): boolean {
  const filter = queryKey[2];
  return (
    typeof filter === "object" &&
    filter !== null &&
    (filter as { left?: unknown }).left === true
  );
}

/**
 * Take one row out of every cached narrowing of ONE of the two lists.
 *
 * The list is keyed by its filter since stapel-chat 0.8.2 (`queryKeys.ts`), so
 * "the conversation list" is a family of cache entries — the unfiltered one,
 * the unread chip's, and one per search a person has typed. A row removed from
 * the entry that happens to be on screen would still be sitting in the other
 * three, waiting to be drawn again by a chip press. So this writes through the
 * two-element PREFIX, which is what that prefix is for.
 *
 * WHICH OF THE TWO LISTS IS AN ARGUMENT, and it has to be (stapel-chat 0.8.6).
 * The inbox and the left list are exact complements under one prefix, so every
 * act that takes a row off one PUTS IT ON the other: leaving removes it from
 * the inbox and the left list is where it now belongs; returning removes it
 * from the left list and the inbox is where it now belongs. A helper that
 * swept the whole prefix would delete the row from the list it had just moved
 * to, and the person would watch it vanish out of both.
 *
 * `count` follows the row it lost: a paginator's total that disagrees with the
 * items beside it is the kind of number that later gets rendered.
 */
function forgetConversationRow(
  queryClient: QueryClient,
  conversationId: string,
  from: "inbox" | "left"
): void {
  queryClient.setQueriesData<InfiniteData<ConversationPage, string | undefined>>(
    {
      queryKey: chatQueryKeys.conversations(),
      predicate: (query) => keyIsLeftList(query.queryKey) === (from === "left"),
    },
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
 * ── And the row is not moved to the other list by hand ────────────────────
 *
 * The row is dropped from the INBOX narrowings only; nothing writes it into
 * the LEFT list's pages (stapel-chat 0.8.6). It belongs there now, but where
 * exactly is the server's answer: that list is ordered by `left_at`, an
 * instant this client does not have and must not invent, and the invalidation
 * below is what fetches it. Placing the row optimistically would put it at
 * whatever position the client guessed, and the guess would be corrected
 * under the person's eyes a moment later.
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
      forgetConversationRow(queryClient, conversationId, "inbox");
      // The server's own answer to "what is on this list" — and the path a
      // re-surfaced thread arrives back down. The prefix reaches BOTH lists,
      // which is the point: the thread has just moved from one to the other.
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversations(),
      });
    },
  };
  return useMutation(options);
}

/**
 * RETURN to a conversation this person left (stapel-chat 0.8.6) — the undo of
 * {@link useLeaveConversation}, and the reason the left list exists at all.
 *
 * The variable is the conversation id for the same reason leaving's is: this
 * is pressed from a ROW, and one hook serves the whole list rather than one
 * per row.
 *
 * ── What moves in the cache ───────────────────────────────────────────────
 *
 * The row is taken out of every cached narrowing of the LEFT list on the
 * `204`, so the view answers the press, and then the whole two-element prefix
 * is invalidated so the inbox re-reads. Nothing is written into the inbox
 * pages by hand: the thread comes back with the badge it had and at the
 * position its `updated_at` gives it — `services.rejoin_conversation` touches
 * neither — and a client that spliced the row in would be choosing that
 * position itself and re-sorting the person's list under their eyes when the
 * server disagreed a moment later.
 *
 * The THREAD's own cache entries are untouched, exactly as on the way out:
 * the leaver never lost their history and is not being given it back.
 *
 * ── The two refusals, and why one of them is a fact about the server ──────
 *
 * `403 error.403.chat_not_participant` is this request's own: an undo is not
 * a door into a conversation nobody put you in. It is settled — the same
 * answer every time — so `retry: false`, and the surface that made the press
 * renders it.
 *
 * `404` is not about this thread at all. `POST …/rejoin` does not exist on a
 * 0.8.5 server, and that is the ONLY way this pair can learn it: `?left=true`
 * is an unknown query parameter there, silently ignored rather than refused,
 * so the listing comes back looking like a perfectly good answer. The `404`
 * is therefore recorded against the DEPLOYMENT rather than the row
 * (`chatQueryKeys.rejoinSupported`), and every rejoin control on the screen
 * stops being offered at once — a control that cannot work must not be drawn
 * a second time for a person to press again.
 */
export function useRejoinConversation(): UseMutationResult<
  void,
  StapelApiError,
  string
> {
  const api = useChatApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (conversationId) => api.rejoinConversation(conversationId),
    retry: false,
    onError: (error) => {
      // A missing ENDPOINT, not a missing thread: this URL carries no
      // resource of its own to be absent, so the only thing a 404 on it can
      // mean is that the deployment predates the verb.
      if (error.status === 404) {
        queryClient.setQueryData(chatQueryKeys.rejoinSupported(), false);
      }
    },
    onSuccess: (_answer, conversationId) => {
      forgetConversationRow(queryClient, conversationId, "left");
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversations(),
      });
    },
  };
  return useMutation(options);
}

/**
 * Does this deployment have the way back at all?
 *
 * `true` until a `404` says otherwise — the honest default, because the pair
 * announces `>=0.8 <0.9` and every release in that range from 0.8.6 has it,
 * and because a control hidden on suspicion is a feature withheld from every
 * up-to-date deployment to spare one old one a refusal.
 *
 * Subscribed to the query cache rather than read out of it: the flag is set by
 * whichever row was pressed, and every OTHER row's control has to go at the
 * same moment. Reading `getQueryData` at render time would leave the rest of
 * the list offering a control that is known not to work until something else
 * happened to repaint it.
 */
export function useRejoinSupported(): boolean {
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (onChange: () => void) => queryClient.getQueryCache().subscribe(onChange),
    [queryClient]
  );
  const read = useCallback(
    () => queryClient.getQueryData<boolean>(chatQueryKeys.rejoinSupported()) ?? true,
    [queryClient]
  );
  // The server snapshot is the same default: nothing has been refused during
  // a render on the server, and an SSR pass that drew no control where the
  // client draws one would hydrate into a mismatch.
  return useSyncExternalStore(subscribe, read, () => true);
}
