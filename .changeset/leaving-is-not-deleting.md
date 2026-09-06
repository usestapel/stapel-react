---
"@stapel/chat-react": minor
---

chat: a person can leave a conversation, and the screen says that is not a delete

Pin → **stapel-chat v0.8.5** (commit `f98201a`, the commit the tag is cut
from). Contract range `>=0.8 <0.9` is unchanged; `docs/errors.json` is
BYTE-IDENTICAL across 0.8.4..0.8.5, so `gen:errors` regenerates unchanged and
no locale bundle shifts. `docs/schema.json` is what moves, and with it this
pair's generated client.

**What the backend did.** `DELETE /chat/api/v1/conversations/{id}` answered
**405** — there was no way off a thread at all — and now answers **204**: the
caller's participant row is stamped `left_at`, the thread drops off *their*
list, unread counts and `?search=`, their live subscription is revoked, and a
`system` line records it as `chat.participant.left:<user_id>`. It deletes
nothing: every message stays, the other party keeps the thread untouched, the
leaver still reaches their own history by id, and any **authored** message from
the other side clears the marker and brings the thread back (a system line
resurfaces nobody). `DELETE` is idempotent, and a non-participant gets the
module's one membership refusal, `error.403.chat_not_participant`.

Two wire surfaces regenerate here: the new `delete` operation, and
`ParticipantResponse.left_at` — nullable, and absent from the schema's
`required` list, so a body from a 0.8.4 server reads as "nobody has left"
rather than as a broken contract.

**The confirmation is the feature.** The verb is `DELETE` and the act is not a
delete, and two people press this control meaning two different things — "tidy
my inbox" and "destroy this for both of us". So «Покинуть диалог» opens one
sentence that states both halves before anything is sent: **«Диалог исчезнет из
вашего списка. Собеседник сохранит переписку.»** The affirmative is «Покинуть»,
never «Удалить», in all three locales.

**Where it is offered, and why it is two components.** The thread's overflow
sheet — which now always exists, because leaving is this pair's own verb and
not a host slot, so the menu is never empty — and an **inbox row's own menu**,
because the inbox is where a person decides a thread is finished with. Both are
built from `LeaveConversationTrigger` + `LeaveConversationDialog` and never from
one nested component: a `SkinDialog` destroys its children when it hides, so a
confirmation rendered inside either menu would be unmounted by the press that
opened it. Each menu owns the flag, closes itself, and renders the dialog as its
sibling. The row's menu is likewise a **sibling of the row control**, not a
child — a button inside an anchor is the nesting D420 already moved the subject
strip out of.

**On the 204, not on the press.** `useLeaveConversation` takes the id as its
mutation VARIABLE (one hook serves a whole inbox) and, on the answer, removes
the row from **every** cached narrowing of the list through the
`["chat","conversations"]` prefix — the unfiltered entry, the unread chip's, and
one per search — then invalidates. It does **not** retry: the only refusal this
request has is `chat_not_participant`, a settled answer the confirmation stays
open to render rather than closing over an inbox that did not change.

**Nothing remembers "I left".** There is no client-side set of left ids, and
that is the design: an authored reply clears the marker for everyone, so the row
has to simply APPEAR on the next inbox frame. A client suppressing it would need
to be told to forget, by an event nobody sends. `test/leaveConversation.test.tsx`
drives that end to end over the inbox socket.

**The marker becomes a sentence.** `model/systemLines.ts` holds
`CHAT_SYSTEM_LINE_LABELS` — **stapel-chat's own markers and nothing else** —
and turns `chat.participant.left:<uuid>` into «<имя> покинул(а) диалог», with
the name resolved through the host people seam and «Собеседник» when nothing
can name them (a uuid at a reader is the machine vocabulary this contour exists
to keep off the screen). The host's `renderSystemMessage` still wins, and
another module's marker (`video.call.ended:188`) still falls through to it and
then to the body: a chat renderer carrying a table of other modules' event names
would be a copy going stale from the day it was written. The thread panel's
`PeopleScope` moved up to wrap the transcript as well as the header — one batch,
every participant, because the person a departure line names is the READER when
they open a thread they left by id.

**The header stops claiming presence for somebody who left.**
`<PresenceLine>` reads `participants[].left_at` and renders «покинул(а) диалог»
with `data-online="false"`, replacing the presence sentence rather than joining
it — "Online" about somebody who is not in the room is the same lie the old
transport tag told, one layer down, and "Last seen 5 minutes ago" invites a
reply to somebody who will not see it. Read off the conversation body, never off
a system line this session happened to receive.

**The screen showing the thread closes with it.**
`<ConversationThreadPanel onLeft>` is where a thread SCREEN navigates back;
`<ConversationSplitPanel>` needs no wiring at all — it owns which thread its
right pane shows and empties it, from either door (the thread's menu or the
row's), while still calling `onLeft` because `selectedId` is usually the host's
route.

New exports — main entry: `useLeaveConversation`, `participantHasLeft`,
`participantLeftAt`, `CHAT_SYSTEM_LINE_LABELS`, `CHAT_MARKER_PARTICIPANT_LEFT`,
`readSystemMarker`, `systemLineText`, `ChatSystemMarker`. `/default`:
`LeaveConversationDialog`, `LeaveConversationTrigger`,
`LeaveConversationDialogProps`, `ThreadActionsMenuProps.onLeft`,
`ConversationThreadPanelProps.onLeft`, `ConversationListPanelProps.onLeft`,
`ConversationSplitPanelProps.onLeft`. Seven new i18n keys in en/ru/es.

Measured on a clean dist with dependencies held constant, this package's src at
HEAD and then with the change: `dist/index` 11.219 → **11.631 KB** (limit 11.6 →
12), `dist/default` 16.990 → **18.068 KB** (17.3 → 18.5). `i18n/ru` 5.135 →
5.317 KB and `i18n/es` 4.236 → 4.399 KB both stay under their standing
ceilings.
