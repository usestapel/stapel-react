/**
 * WHAT WAS LAST SAID, for a row of the inbox — read from what this client
 * already holds, and asked for from nobody.
 *
 * ── The gap this works around, named ──────────────────────────────────────
 *
 * `ConversationResponse` carries no last message: not a body, not a sender,
 * not a snippet (`stapel_chat/serializers.py` at the 0.6.2 contract — the
 * fields are `last_seq`, `unread_count`, `updated_at`, `subject`,
 * `participants`). So a preview cannot be READ off the list endpoint, and the
 * only two ways to invent one are both wrong: a `GET /messages?limit=1` per
 * row turns one screen into twenty-one requests, and a made-up line is worse
 * than a blank one.
 *
 * What a client DOES hold is the thread window of every conversation it has
 * opened this session — one cache entry per thread, kept current by the same
 * transport seam the open thread uses. This hook reads those entries and
 * fetches NOTHING (`skipToken` — the query is a subscription to the cache,
 * never a request), so a row shows its last line when the client honestly
 * knows it and shows none when it does not.
 *
 * NAMED UPSTREAM GAP: a `last_message` projection on the conversation
 * serializer would let every row show a preview on first paint. It is a
 * contract change in stapel-chat, not something a skin can paper over.
 */
import { skipToken, useQueries } from "@tanstack/react-query";
import type { ChatMessage } from "../api/types.js";
import { chatQueryKeys } from "./queryKeys.js";
import { threadLastMessage } from "./threadWindow.js";
import type { ChatThreadWindow } from "./threadWindow.js";

/** `conversationId` → its newest message, for the ones this client holds. */
export type ChatPreviews = (conversationId: string) => ChatMessage | undefined;

/**
 * The last message of each named conversation, as far as this client knows.
 *
 * The ids are used as given (no sort, no de-duplication): they come from one
 * page of the list, which is already unique and already in the order the rows
 * are drawn in.
 */
export function useThreadPreviews(
  conversationIds: readonly string[]
): ChatPreviews {
  const results = useQueries({
    queries: conversationIds.map((id) => ({
      queryKey: chatQueryKeys.thread(id),
      // Not a read. `skipToken` makes this a subscription to an entry another
      // surface owns: present → its data, absent → nothing, ever.
      queryFn: skipToken,
    })),
  });
  const byId = new Map<string, ChatMessage>();
  conversationIds.forEach((id, index) => {
    const window = results[index]?.data as ChatThreadWindow | undefined;
    const message = window === undefined ? undefined : threadLastMessage(window);
    if (message !== undefined) byId.set(id, message);
  });
  return (conversationId) => byId.get(conversationId);
}
