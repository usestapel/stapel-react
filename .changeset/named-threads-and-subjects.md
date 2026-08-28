---
"@stapel/chat-react": minor
---

The inbox names people, and a thread says what it is about.

A seller with ten conversations saw ten rows all titled "Личная переписка" —
the row title was the conversation KIND — distinguishable only by timestamp.
And a buyer writing "still available?" about one of five listings landed in
the same thread as every other subject, so neither party could tell which.

- Rows now carry the counterparty's avatar and name, the subject, a preview
  and an unread badge. Names come from a host seam on the runtime
  (`slots.people`), shaped like listings-react's `resolveImage`, because chat
  may not import profiles-react. It is a component rather than a function
  because the answer is a network read. `<PeopleScope>` resolves a whole
  screen in ONE batch, never per row, and the test counts the fetches rather
  than asserting the shape. With no seam wired a row reads "name unavailable"
  — never a fallback that looks deliberate.
- `StartChatButton` / `useStartDirectChat` take `subjectType`/`subjectKey`,
  and the thread pins a subject card above the messages. Both halves or
  neither: a half pair is dropped rather than sent, because upstream answers
  `chat_incomplete_subject`.
- The thread header gains report and block, both host slots, in a
  `SkinDialog` — a bottom sheet on a phone, a modal above it. With neither
  wired the control is not drawn.

Two honest limits, both recorded in MODULE.md rather than papered over. The
conversation contract carries no last message, so a row shows a preview only
for threads this client already holds — a `last_message` projection upstream
is what would let every row paint one on first load; a per-row
`GET /messages?limit=1` was refused and a fabricated line is worse than a
blank one. And widening `direct_key` means the first contact WITH a subject
opens a new thread beside a pair's existing subjectless one: the skin makes
the two visibly different rather than hiding it.
