# @stapel/chat-react

Headless React pair for **stapel-chat** (frontend-standard §2). Business +
state only in the main entry, zero visual opinion — any design layers on top.
Built on `@stapel/core` (typed client + `StapelApiError` envelope, token
refresh, verification-403 interception, i18n engine, analytics seam, TanStack
Query).

Its backend delivers the same journal two ways — the REST history and two
WebSocket streams on the `stapel-realtime` wire — and this pair wires **both,
behind one seam**, so a deployment with sockets and one without run the same
screens. The socket half is `@stapel/realtime`: one reconnect/resume runtime
for the whole fleet, and a required peer here. See `MODULE.md` for the layer
map and the two streams.

## Install

```
pnpm add @stapel/chat-react @stapel/core @stapel/realtime @tanstack/react-query react
```

## Wire the app once

```tsx
import { createI18n, StapelProvider } from "@stapel/core";
import { ChatProvider, createChatRuntime, registerChatI18n } from "@stapel/chat-react";

const runtime = createChatRuntime({
  baseUrl: "/chat/api/v1",
  // The socket ORIGIN is derived from baseUrl; the paths are the streams'
  // (`ws/chat/<id>`, `ws/chat/inbox`). On a deployment that has no sockets,
  // say so — it polls, and the screens SAY they are polling:
  //   realtime: { socketUrl: null },
  //
  // The handshake carries the browser's httpOnly cookie, because a page
  // cannot put a header on `new WebSocket()`. A non-browser host passes
  // `protocols: bearerSubprotocols(token)` instead. A 4401 goes to core's
  // single-flight `SessionManager.refresh()` and reconnects once.
});
const i18n = createI18n({ locale: "en" });
registerChatI18n(i18n);

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <StapelProvider client={runtime.client} i18n={i18n} cacheVersion="0.1.0">
      <ChatProvider runtime={runtime}>{children}</ChatProvider>
    </StapelProvider>
  );
}
```

## The inbox

```tsx
import { ConversationList } from "@stapel/chat-react";
import { matchList } from "@stapel/core";

// `viewerId` is what turns the inbox socket on: the stream is
// `chat:user:<id>` and the server derives that key from the session, so it
// cannot be guessed. Without it the list polls — and says so.
<ConversationList viewerId={me.id}>
  {({ state }) =>
    matchList(state, {
      loading: () => <Spinner />,
      failed: (error) => <ErrorPanel error={error} />,
      empty: () => <p>{t("chat.list.empty")}</p>,
      ready: (rows) => <List rows={rows} />, // rows carry `unread_count`
    })
  }
</ConversationList>;
```

## A thread

```tsx
import { ConversationThread, MessageComposer } from "@stapel/chat-react";

<ConversationThread conversationId={id}>
  {({ state, hasOlder, loadOlder, transport, degraded }) => (
    /* `transport` is "socket" | "polling" | "idle" — a LABEL. Nothing about
       the thread's behaviour depends on it; that is the seam's whole point.
       `degraded` is the other half, and the one that matters: when the socket
       is not carrying the thread it carries the NAMED reason and its i18n key
       (`never_connected`, `reconnecting_long`, `sign_in_required`,
       `origin_not_allowed`, `forbidden`, `revoked`, `unsupported`,
       `no_socket`). "Refreshing every few seconds", with no reason beside it,
       is what let a broken handshake read as a product decision for months. */
    ...
  )}
</ConversationThread>;

<MessageComposer conversationId={id}>
  {({ value, setValue, availability, visibleAvailability, send }) => (
    /* Two readings of one verdict. `availability` is what the SEND control
       obeys — blocked-with-a-reason or available, never a dead disabled
       button. `visibleAvailability` is what a skin PRINTS: the same block,
       withheld until the person has typed or pressed send, because an
       untouched box (and a box one tick after a successful send) has failed
       nothing. */
    ...
  )}
</MessageComposer>;
```

The thread replays, then stays live; the read marker advances to the tip while
it is mounted and never moves backwards. Sending is REST — the persisted row
comes back with its `seq` and is folded into the window.

Chat is also the substrate's ONE documented socket-write exception. The bag's
`socket` (`ChatSocketWrites`) emits `send`/`edit`/`delete`/`read`/`delivered`/
`activity` with a `client_msg_id`, so a host that wants Enter to travel on the
same wire as the messages it produces can have that. It is not the default:
the REST twins answer with the persisted row and a localized error envelope,
while a socket refusal is a protocol code with no i18n key.

## The three seams a chat cannot fill by itself

A `ConversationResponse` names nobody (it carries participant **ids**), a
subject card belongs to whoever owns that subject type, and "report" and
"block" live in `@stapel/moderation-react` and `@stapel/profiles-react` — all
three of them **peers** of this pair, which never imports a peer. So they
arrive as host-supplied slots on the runtime, exactly like `resolveImage` in
`@stapel/listings-react`:

```tsx
import { useProfilesBatch, profileBatchEntry } from "@stapel/profiles-react";
import { ReportButton } from "@stapel/moderation-react/default";
import { useBlock, useUnblock, useRelationship } from "@stapel/profiles-react";
import type { ChatPeopleSlot, ChatThreadActionSlot } from "@stapel/chat-react";

// WHO. Mounted ONCE per screen with every id it is about to draw, so an
// inbox of twenty rows is one request.
const People: ChatPeopleSlot = ({ userIds, children }) => {
  const batch = useProfilesBatch(userIds);
  return children({
    pending: batch.isPending,
    lookup: (userId) => {
      const entry = profileBatchEntry(batch.data, userId);
      return entry.status === "found"
        ? {
            userId,
            displayName: entry.profile.display_name,
            avatarUrl: entry.profile.avatar_url,
          }
        : null;
    },
  });
};

// REPORT / BLOCK. Rendered inside the thread's overflow menu — a bottom sheet
// on a phone, a modal above it. `close()` dismisses that menu when your own
// control takes the screen over.
//
// The `null` arms below are now unreachable from the shipped menu, which does
// not draw a host entry until it HAS a counterparty — not on the first paint,
// while the conversation is still being read, and not in a group, where there
// is no single other person. They stay in the type (and in this example)
// because a host may mount `<ThreadActionsMenu>` itself.
const Report: ChatThreadActionSlot = ({ conversationId, counterpartyId, close }) =>
  counterpartyId === null ? null : (
    <ReportButton
      targetType="chat_message"
      targetKey={conversationId}
      block
      onOpened={close}
    />
  );

const Block: ChatThreadActionSlot = ({ counterpartyId }) =>
  counterpartyId === null ? null : <MyBlockControl userId={counterpartyId} />;

const runtime = createChatRuntime({
  baseUrl: "/chat/api/v1",
  slots: { people: People, report: Report, block: Block },
  // `subjectCard` is the fourth: supply it only if your card is not shaped
  // like `classified.subject_cards` (title / price / currency / image / url /
  // state), which the default skin already renders.
});
```

**Every absence is stated, never silent.** With no `people` seam a row reads
"Name unavailable" — the failure, in words — rather than falling back to the
conversation's kind, which is what made ten different buyers look like ten
copies of "Direct message". With neither `report` nor `block` the overflow
menu still opens — leaving a conversation is this pair's own verb (stapel-chat
0.8.5), so the menu holds exactly one entry rather than nothing — and a host
entry is withheld while there is no counterparty for it to be about, because
"block" pointed at nobody is a promise as empty as a menu that opens onto
nothing.

**After a block the thread is not broken.** stapel-chat refuses to create a
thread for a blocked pair and refuses a send with `error.403.chat_send_refused`
while still serving the history — so the correspondence stays, the composer
answers with that code's own sentence, and nothing in this pair has to invent
a "you blocked them" state (it may not: the same code is returned in both
directions on purpose).

## "Message the seller"

```tsx
import { StartDirectChat } from "@stapel/chat-react";

<StartDirectChat
  sellerId={listing.seller_id}
  viewerId={me?.id}
  subjectType="listing"
  subjectKey={listing.id}
  onOpened={(c) => navigate(`/account/chat/${c.id}`)}
>
  {({ availability, start }) => ...}
</StartDirectChat>;
```

Get-or-create: a direct thread is keyed by the participant pair under a unique
constraint, so pressing twice lands in the same conversation.

### What the thread is about

Without a subject, the key is the pair of people — so a buyer asking about a
second listing lands in the same thread and neither side can tell which item
"still available?" meant. `subjectType`/`subjectKey` widen the key to
`(scope, {both user ids}, subject_type, subject_key)`: one thread per listing,
and the thread carries that listing's card pinned at its top. Both halves
travel together or neither does (upstream refuses half a pair), the deployment
must register the type (`STAPEL_CHAT["SUBJECT_TYPES"]`), and a thread with no
subject behaves exactly as it always did.

**Known cost, accepted:** the first contact *with* a subject opens a NEW
thread beside any subjectless one the two already have — nothing can key the
old ones retroactively, because they were never told what they were about. The
skin does not hide it: a subject thread shows its card and its empty state
says the conversation is about that one thing.

### Who may press it, and where a visitor goes

`POST /conversations/` is `IsAuthenticated`, so the first gate is the mandate
axis, read through core's `MandateSource` seam. A visitor is told to sign in
BEFORE the click instead of collecting a 401 after it — and the sentence comes
with the door:

```tsx
<StartChatButton sellerId={sellerId} signIn={{ href: `/login?next=${here}` }} />
<StartChatButton sellerId={sellerId} signIn={{ onSignIn: () => openModal() }} />
```

`signIn` is core's `SignInCta` — `{href}` **or** `{onSignIn}`, never both — and
it is the same prop `@stapel/reviews-react` and `@stapel/listings-react` take.
Omit it and the reason still renders, alone, which is what a host with no
sign-in route wants.

Outside a `<MandateProvider>` core answers `unresolved/unavailable`, and that
arm stays **available**: a host that never wired the axis keeps its button, and
"we could not ask" is not "you may not".

## The antd skin (opt-in)

```tsx
import {
  ConversationListPanel,
  ConversationThreadPanel,
  StartChatButton,
} from "@stapel/chat-react/default";
```

Importing the subpath is the opt-in; consumers who bring their own visuals
never pull `antd` into their bundle.

An inbox row carries the four things a chat row is made of — who it is with
(name + avatar), what it is about (the subject, and the last line the row
itself carries), when, and the unread badge. The thread pins the
subject card, names the counterparty in its header, and puts report/block
behind one overflow control. Dialogs go through `@stapel/tokens-antd/skin`'s
`SkinDialog`, so every one of them is a bottom sheet on a phone.

**Finding one conversation.** The list pane carries a toolbar: a search box
over the three things a row draws — the counterpart's name, the listing it is
about, and its last line — and an "Unread" chip over the server's own
`unread_count`. Both are controlled-or-not, and a storefront that passes
nothing gets a working toolbar:

```tsx
<ConversationListPanel viewerId={me.id} />                       {/* self-managing */}
<ConversationListPanel
  search={params.q ?? ""}                                        {/* host-owned  */}
  onSearchChange={(q) => setParams({ q })}
  unreadOnly={params.unread === "1"}
  onUnreadOnlyChange={(on) => setParams({ unread: on ? "1" : undefined })}
/>
```

`filters={false}` hides the controls and keeps the filter, for a host that
drives both from chrome of its own. `<ConversationSplitPanel/>` forwards all
of them.

**Both filters are the SERVER's** (stapel-chat 0.8.2 `?search=` / `?unread=`).
They narrow the whole inbox rather than the pages this client happens to hold,
they apply before the page is taken — so "load more" walks the filtered list —
and they live in the query key, which is why a new search starts its paging
over instead of resuming somebody else's anchor. Typing is debounced 300 ms
(`INBOX_SEARCH_DEBOUNCE_MS`; `searchDebounceMs` overrides it, `0` disables it);
the FIELD never lags, only the query does. No client-side predicate runs on top
of the answer — that would be a second, blinder filter over the same rows, and
it would hide rows the server matched on a field this client cannot see (see
`src/model/inboxQuery.ts`). The filtered-empty arm says "nothing found" rather
than borrowing the empty inbox's "no conversations yet", and it keeps the
toolbar, because the toolbar is the way back out.

**The last line comes with the row.** `ConversationResponse.last_message`
(stapel-chat 0.8.3) is a projection — `{seq, kind, sender_id, created_at,
body_preview, preview_reason}` — annotated for the whole page inside the query
the list already runs, so every row paints its line on FIRST load and no client
spends a `GET /messages?limit=1` per row. `null` is a thread nobody has written
in and the row draws no line at all; the reader's own line is prefixed
("You: …").

**Leaving a conversation.** `DELETE /conversations/{id}` (stapel-chat 0.8.5)
is the caller LEAVING, and the copy never says "delete", because nothing is
deleted: the thread drops off *their* list, counts and search while every
message, the other party's copy and the leaver's own access by id stay exactly
as they were — and an authored reply from the other side brings it back. The
control sits in the thread's overflow menu and in an inbox row's own menu, and
both open one confirmation that states both halves before anything is sent
(«Диалог исчезнет из вашего списка. Собеседник сохранит переписку.»).

```tsx
<ConversationThreadPanel conversationId={id} onLeft={() => router.push("/chat")} />
<ConversationSplitPanel selectedId={id} onLeft={() => router.push("/chat")} />
```

`onLeft` is for the host's ROUTE; the split arrangement empties its own right
pane without it. The row leaves every cached narrowing of the list on the
`204` and the request is not retried — its one refusal,
`error.403.chat_not_participant`, is a settled answer the confirmation stays
open to show. Nothing caches "I left": a thread that comes back simply appears
on the next inbox frame.

The departure is recorded in the transcript as `chat.participant.left:<uuid>`
and drawn as «<имя> покинул(а) диалог» (the name through the `people` seam,
«Собеседник» when nothing can name them). `participants[].left_at` carries the
durable half, so the thread header says they left instead of claiming they are
online. A marker belonging to another module — `video.call.ended:188` — is
still the host's to draw through `renderSystemMessage`.

**A line with no words says WHICH kind of no words it is.** `preview_reason`
(stapel-chat 0.8.4) is the discriminator: `deleted` → "Message deleted",
`attachment` → "Attachment", `system` → "System message", and `null` means the
line has words and the row draws them. Until that release the projection said
only that there were no words, so a tombstone and an attachment arrived as one
`null` with `kind: "text"` and the row printed "Attachment" over a message
somebody had deleted — right for the common case, and a lie about their words
for the other. `kind` decides nothing about this line any more; the only place
it is still read is the arm for a 0.8.3 server, which sends no reason at all
(see `src/model/previews.ts`).

## Locales

```tsx
import { registerChatI18nRu } from "@stapel/chat-react/i18n/ru";
import { registerChatI18nEs } from "@stapel/chat-react/i18n/es";
```

Opt-in subpaths, so a host that ships one language carries one language. Both
locales are complete over the pair's UI copy and over every backend error code
the module can raise — including the twelve stapel-chat owns and does not
localize upstream (see `MODULE.md`).
