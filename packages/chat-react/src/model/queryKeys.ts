/**
 * Namespaced TanStack Query keys (frontend-standard §2 — namespaced keys).
 * Everything under the `"chat"` root so a host can invalidate the whole module
 * or match a single thread. Persist scope is per-user via core's query runtime
 * (`setPersistUser`). Explicit tuple return types satisfy
 * `--isolatedDeclarations`.
 */
const ROOT = "chat" as const;

/** The narrowing a conversation-list cache entry belongs to. */
export interface ChatConversationsKeyFilter {
  readonly search: string;
  readonly unreadOnly: boolean;
}

export const chatQueryKeys: {
  readonly all: readonly ["chat"];
  conversations(): readonly ["chat", "conversations"];
  conversationList(
    filter: ChatConversationsKeyFilter
  ): readonly ["chat", "conversations", ChatConversationsKeyFilter];
  conversation(conversationId: string): readonly ["chat", "conversation", string];
  thread(conversationId: string): readonly ["chat", "thread", string];
  readMarker(conversationId: string): readonly ["chat", "read-marker", string];
} = {
  all: [ROOT],
  // The infinite list shares one root key across pages (its pages live under
  // a single cache entry).
  //
  // THIS IS THE PREFIX, NOT A CACHE ENTRY. Since stapel-chat 0.8.2 the list
  // is filtered SERVER-SIDE, so a filtered list is a different list — a
  // different first page, a different anchor chain — and it gets its own
  // entry under `conversationList`. Everything that means "the inbox moved"
  // (a sent message, a read marker, an inbox frame) still invalidates through
  // this two-element prefix and therefore reaches every filter variant at
  // once, which is the reason the filter is a THIRD segment rather than part
  // of the second.
  conversations: () => [ROOT, "conversations"],
  // One entry per narrowing. The filter is normalized by the caller
  // (`useSettledInboxFilter`) so that "no search" is one key and not one per
  // whitespace arrangement.
  conversationList: (filter) => [ROOT, "conversations", filter],
  conversation: (conversationId) => [ROOT, "conversation", conversationId],
  // The thread is ONE cache entry holding a merged, seq-ordered window — not
  // a page list. Its query function reads this entry to decide what to ask
  // for next (a tail by seq, not a blind re-read), which is what makes a
  // plain `refetch()` mean "poll by seq" and lets the transport seam stay a
  // signal → refetch bridge.
  thread: (conversationId) => [ROOT, "thread", conversationId],
  // Not a server read: the highest `upto_seq` this client has already
  // reported. Lives in the query cache so it survives a remount and is wiped
  // at logout with everything else (frontend-core-architecture-v2 §43.3).
  readMarker: (conversationId) => [ROOT, "read-marker", conversationId],
};
