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
  /**
   * WHICH OF THE TWO LISTS this entry holds — the inbox (`false`) or the
   * threads the caller has LEFT (`true`, stapel-chat 0.8.6).
   *
   * IT IS IN THE KEY BECAUSE THE ANCHOR MEANS SOMETHING ELSE ON EACH. The
   * inbox is ordered by `updated_at` and the left list by `left_at`, so a
   * `next_anchor` taken from one is a timestamp of a different thing on the
   * other: one shared entry would let a "load more" pressed on one tab walk
   * into pages the other tab's cursor selected, and the rows would be a
   * plausible, wrong list. Separate entries, separate first pages, separate
   * chains — the same reason `search` is in here.
   *
   * It is still the THIRD segment, under the shared `conversations()` prefix,
   * so "the inbox moved" (a sent message, a read marker, a departure, a
   * return) invalidates both lists at once. It has to: the two are exact
   * complements, and every event that adds a thread to one takes it off the
   * other.
   */
  readonly left: boolean;
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
  rejoinSupported(): readonly ["chat", "rejoin-supported"];
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
  // Not a server read either: does THIS deployment have
  // `POST /conversations/{id}/rejoin` at all (stapel-chat 0.8.6)? A 0.8.5
  // server answers `404` to it, which is the only signal there is — an
  // unknown `?left=` query parameter is silently ignored rather than refused,
  // so the LISTING cannot tell the two servers apart and the way back can.
  // Cached rather than held in a module variable so it is per-runtime, wiped
  // at logout with everything else, and readable by every row at once instead
  // of once per row.
  rejoinSupported: () => [ROOT, "rejoin-supported"],
};
