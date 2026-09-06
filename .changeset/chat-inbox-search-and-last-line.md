---
"@stapel/chat-react": minor
---

chat: the inbox is searched by the server, and a row carries the line it draws

Contract pin bumped to **stapel-chat v0.8.3** (from v0.8.0), which closes the
two NAMED UPSTREAM GAPS this pair had been carrying — one in
`src/default/inboxFilter.ts`, one in `src/model/previews.ts` — and turns both
of them from workarounds into wire.

**`?search=` and `?unread=true` (0.8.2).** The toolbar shipped in 0.11.0 could
only narrow the rows this client had already loaded: a search box that reads
one page of twenty and answers "nothing found" over an inbox of three hundred.
Both controls are now the endpoint's own parameters, matching the three things
a row DRAWS (counterpart's display name, subject card's title, last line) and
filtering BEFORE the page is taken.

- The filter is **in the query key** (`chatQueryKeys.conversationList`), so a
  search has its own cache entry and its own pages; the two-element
  `conversations()` key stays the invalidation PREFIX, so a sent message, a
  read marker and an inbox frame still reach every variant at once.
- **Paging restarts** on any change — a new key is a new entry — and a "load
  more" pressed under a search walks the FILTERED list, anchor and all.
- **Typing is debounced 300 ms** (`INBOX_SEARCH_DEBOUNCE_MS`, overridable per
  panel with `searchDebounceMs`, `0` to disable), in the query layer rather
  than at a call site, so every consumer of `useConversations` gets the same
  pause. The chip is not debounced; the field itself never lags, only the
  query does.
- **The client predicate is gone, and not as an optimisation.** Re-applying it
  over a server-filtered page is a DOUBLE filter: the server matches on the
  counterpart's name (which lives behind the host's people seam and may still
  be pending) and on the subject card's title (matched at fields only that
  subject type knows), so a local predicate reads those absences as "no match"
  and blinks a correctly-returned row out of the list for the length of the
  debounce and the round trip. `matchesInboxFilter` and `previewSearchText`
  are removed; `inboxFilterActive` and `InboxRowText` moved to the main entry
  (`model/inboxQuery.ts`) and are still re-exported from `/default`.
- The **"among the conversations loaded so far" line is removed** from all
  three locales (`chat.list.filter.scope`): it described a scope that no
  longer exists, and a caveat that is no longer true is worse than none.
- The toolbar is **hoisted out of the list's state machine**. A search is a
  new query, so the list passes back through `loading`; a toolbar drawn inside
  that arm would be torn down by the very keystroke that moved it, taking the
  focus and the caret with it. The two empty answers stay two sentences, and
  the filtered one keeps the toolbar — it is the way back out.

**`last_message` (0.8.3).** `ConversationResponse` now carries the row's own
line — `{seq, kind, sender_id, created_at, body_preview}`, annotated for the
whole page inside the query the list already runs. A row paints its preview on
FIRST load; nobody spends a `GET /messages?limit=1` per row. `useThreadPreviews`
/ `ChatPreviews` are **removed** rather than kept as a fallback (a second
source for one line is a second answer to disagree with), and `inboxPreviewLine`
replaces them.

- `last_message: null` → the row draws no line (a thread nobody has written in
  is not a message that could not be shown).
- The reader's own line is prefixed, "You: …", comparing `sender_id` as a
  string.
- `body_preview: null` with kind `system` → "System message" (an unlabelled
  marker like `video.call.ended:188` is machine vocabulary, not a sentence);
  otherwise → "Attachment".
- **Follow-up, named:** that second null is ambiguous. `services.drawn_last_line`
  collapses a tombstone and an attachment-only message into one absent string,
  so the row cannot say "Message deleted" any more — the key stays in the
  catalogue, dormant, until the projection says WHY it is null.

New: `LastMessage` type, `ChatInboxFilter`, `ChatConversationsKeyFilter`,
`INBOX_SEARCH_DEBOUNCE_MS`, `normalizeInboxSearch`, `useDebouncedValue`,
`useSettledInboxFilter`, `inboxPreviewLine`; `<ConversationList>` takes
`search` / `unreadOnly` / `searchDebounceMs` and `<ConversationListPanel>`
forwards them.
