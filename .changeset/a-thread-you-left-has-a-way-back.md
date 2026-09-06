---
"@stapel/chat-react": minor
---

chat: the threads you left have a listing, and a way back

Pin → **stapel-chat v0.8.6** (commit `e6486cd`, the commit the tag is cut from
— `13ad78b` is the annotated tag OBJECT, which is not what a pin names).
Contract range `>=0.8 <0.9` is unchanged; `docs/errors.json` is
BYTE-IDENTICAL across 0.8.5..0.8.6 — the one refusal already existed — so
`gen:errors` regenerates unchanged and no locale bundle shifts.
`docs/schema.json` is what moves, and with it this pair's generated client,
its query layer and its inbox.

**What the backend did.** 0.8.5 gave a person a way out of a thread and no way
back into it: it was off `inbox_of`, out of the counts and out of `?search=`,
and deliberately not destroyed — so it existed, in full, somewhere nothing
would ever list it, and somebody who pressed «Покинуть диалог» by mistake could
reach it only by a URL they had kept. That was this pair's one open upstream
ask, and it is closed:

- `GET /conversations?left=true` — the **exact complement** of the default
  list. `services.left_of` is written as the negation of `services.inbox_of`,
  so every thread a person is party to is on one of the two and never on both,
  and none can fall between them. Ordered by **when the caller left**, newest
  departure first, so `anchor` on this list is a `left_at` where the inbox's is
  an `updated_at`; `search`, `unread` and the paging trio compose exactly as
  they do on the inbox.
- `POST /conversations/{id}/rejoin` → **204**, idempotent. It clears the
  caller's `left_at` and that is the entire verb: read markers untouched (the
  thread returns with the badge it had) and `updated_at` untouched (it returns
  where the departure left it, not at the top of the inbox). No participant row
  is created — a non-party gets `error.403.chat_not_participant`, the same key
  `GET` and `DELETE` on that thread already give them.
- `ConversationResponse.left_at` — the requesting user's own departure, at the
  top level, nullable and absent from the schema's `required` list, so a body
  from a 0.8.5 server reads as "nobody has left" rather than as a broken
  contract.

**Two lists, two cache entries, and that is the whole design.** The inbox pane
now carries a tab pair — «Диалоги» / «Оставленные» — rather than a "show left
ones too" switch, because a switch says the two can be seen together and the
endpoint cannot produce that answer. The left list takes its own query key and
its own page chain: it is ordered by a different column, so a `next_anchor`
taken from one list is a timestamp of a different thing on the other, and one
shared entry would let a «Показать ещё» pressed on one tab page the other with
the wrong cursor — a real question, answered, with a plausible wrong list
coming back rather than an error anybody would notice.

**A left row is a different row.** It draws the date the person walked out
(«покинут <дата>») off the row's own top-level `left_at`, which needs no
`viewerId` and is what the list is ordered by; and it carries «Вернуться в
диалог» instead of the overflow menu whose one entry was the exit already
taken. Both sit below the row control as its siblings — the row is one control
that opens the thread, so a button inside it would be a control inside a
control (D420). The way back asks **no** confirmation: leaving is the half of
that choice that needs a question, and a speed bump here is one aimed at the
recovery from the mistake rather than at the mistake.

On the `204` the row leaves every narrowing of the left list and the whole
`["chat","conversations"]` prefix is invalidated, so the inbox re-reads.
Nothing is spliced into the inbox by hand: `rejoin` touches neither the read
markers nor `updated_at`, so the position is the server's answer, and a client
that chose one would be re-sorting a person's list under their eyes a moment
before the server disagreed. `forgetConversationRow` therefore takes a side —
the two lists live under one prefix and every act moves a thread BETWEEN them,
so a helper that swept the prefix would delete the row from the list it had
just arrived on.

**One thing cannot be detected from a listing, and the pair says so.** A 0.8.5
server ignores the unknown `?left=` rather than refusing it, so the tab there
shows the inbox and looks like a good answer. The `404` on `…/rejoin` is the
only signal a deployment predates the verb, and it is recorded against the
DEPLOYMENT (`useRejoinSupported`) and not the row: every rejoin control on the
screen goes at once, because a control known not to work must not be offered
for a second press. It is hidden rather than disabled-with-a-sentence — there
is nothing a person can do about our release train, and chrome about it
standing in somebody's inbox is worse than no control.

**The search box promises less on the left tab, on purpose.** The server's rule
is identical on both lists, but a left thread's last line IS the departure
marker, an unlabelled marker draws nothing and is found by nothing — so the
placeholder there is «Имя или объявление» and not the inbox's «Имя, объявление
или сообщение». Keeping the third promise would send a person hunting for a
word they can genuinely remember reading.

New in the main entry: `useRejoinConversation`, `useRejoinSupported`,
`conversationLeftAt`, `ChatInboxView`, and `ConversationListParams.left` /
`<ConversationList view>`. New in `/default`:
`<RejoinConversationButton/>`, and `<ConversationListPanel/>` /
`<ConversationSplitPanel/>` gain `view` / `defaultView` / `onViewChange` /
`leftView` / `onRejoined`. en/ru/es all move together.
