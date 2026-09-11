---
"@stapel/chat-react": minor
---

A row's subject line becomes a seam, and a thread can open on the question
somebody already chose.

Two rows of the closing-wave comparison inventory, and a third that is already
closed and is reported rather than rebuilt.

**`<ConversationListPanel renderSubject>` — the row's own line, drawn by the
host.** The strip under an inbox row already says WHAT the thread is about:
the subject card's thumbnail, its title (a link to the listing, D420) and its
price, read off the card stapel-chat inlines in the list response by asking the
subject type's registered `card_function`. That covers every deployment whose
provider serves the conventional fields, and it stops exactly where the card
does — a provider answering a different shape, or answering nothing and leaving
the envelope with the opaque `(subject_type, subject_key)` it always carries,
left the row saying only who it is with. There was no way in: `slots.subjectCard`
is the THREAD's pinned card and has never reached an inbox row.

`renderSubject(conversation)` is that row's half. A render-prop and not a slot
because a row is drawn for a CONVERSATION, not for a subject this pair could
resolve: a host holding the catalogue needs the key, and the key is on the
envelope. It is called for every row, including the ones with no card at all;
its answer replaces the default one and `null` is an ANSWER — "this thread has
nothing to show", never a quiet fall back to the card the host just declined.
The indent stays this pane's, because that half is layout: whatever comes back
sits in the row's text column as a SIBLING of the row control, since a link
inside a `role="button"` is a control inside a control. Forwarded through
`<ConversationSplitPanel/>` for the reason every other slot on it is — the
arrangement mounts the list panel itself, so one deployment would otherwise
draw two different rows for the same thread.

No backend ask. The conversation envelope already carries the whole card
inline, annotated for a page in the query the list already costs — a
`subject_title` / `subject_summary` pair would be a narrower copy of something
that is already there.

**`<MessageComposer initialValue>`, forwarded as `initialText` through
`<ConversationThreadPanel/>` and `<ConversationSplitPanel/>`.**
`@stapel/listings-react` 0.30.0 put four canned questions above a listing's
contact control and the press had nowhere to land: the text travelled in router
state, the thread opened on an empty composer, and the person retyped the
sentence they had just picked. This is the landing place.

Two things it is not. It is not a controlled value — it seeds the state ONCE,
at mount, and a later change is ignored, because a prop that kept writing into
the box would overwrite what had been typed since, on a parent re-render
nothing on screen caused. And it is not an INTERACTION: `pristine` stays true,
so a seeded composer is as neutral as an empty untouched one and prints no
refusal under words the product wrote. Nothing is sent — the person still reads
it, edits it and presses send.

**The unread/important chips: one is live, the other has no wire.** The inbox
toolbar has carried an "Unread" chip since 0.11.0 and it is the SERVER's own
`?unread=` (stapel-chat 0.8.2) rather than a client-side pass over
`unread_count > 0` — it narrows the whole inbox instead of the pages this
client happens to hold, so the chip and the badge on a row cannot disagree, and
it is controlled-or-not (`unreadOnly` / `defaultUnreadOnly` /
`onUnreadOnlyChange`) with copy in en/ru/es. Nothing was added for it. There is
no `important` flag anywhere on the wire — not on `ConversationResponse`, not
as a list parameter — so no chip was invented for one: a control that filters on
a field the server does not have is a control that can only ever be empty. The
upstream ask is a per-participant flag on the conversation envelope plus an
`?important=` list parameter, in the shape `unread` already has.
