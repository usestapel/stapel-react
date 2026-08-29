---
"@stapel/chat-react": minor
---

The thread header stops calling the reader's own socket "the other person".

The tag beside the seller's name read "Live" ("На связи") whenever THIS
browser's websocket was up. Everyone using the product read it as "the seller
is online". It never meant that — it meant the reader's network could still
reach the server, wearing somebody else's name.

Against stapel-chat 0.7.0 (pin bumped), three things replace it:

- **`<PresenceLine/>`** under the counterparty's name — "Online", or "Last
  seen 5 minutes ago" on core's own relative-time ladder (`useFormat`), from
  `participants[].online` / `.last_seen_at`. It takes no transport argument
  and cannot be built from one. It renders only for a single counterparty: in
  a group "online" names nobody, and an adjective about four people would be
  the same overreach.
- **`chat.presence.changed`** — `readChatPresenceFrame` and a `presence`
  signal kind. `applyConversationPresence` writes the flip straight into the
  cached conversation rather than invalidating it: the frame carries both
  fields the header renders, so a refetch buys nothing and several peers
  arriving at once would be a refetch storm for a line of text.
- **`<TransportTag/>` says nothing while the socket is healthy.** Every named
  degradation is untouched — that is the whole reason the control exists — but
  the expected state gets no chrome. A permanent label in a thread header is
  read as a fact about the person named next to it, which is how this began.

`participantPresence` degrades to offline-with-nothing-to-say for a server too
old to send the fields, for a participant not on the thread, and for a frame
whose `online` is anything other than literally `true`. A false "online" is
the defect, so that is the direction it fails in.

**Notifications, on the shared permission substrate.**
`<ChatNotificationsPrompt/>` asks via core's `usePermission("notifications")`
and `PermissionSheet` from `@stapel/tokens-antd/skin` — no second permission
component. It asks at the first message exchanged in the open thread, never
on page load: `denied` is terminal, so an early prompt does not merely annoy,
it spends the only chance the browser gives. "Not now" is a dismissal that
never reaches the browser.

`useChatNotifications` spends a granted permission and asks for nothing:
one notification only while the tab is hidden, never for your own message,
never for a tombstone or a system line, one `tag` per thread so a burst is one
line of news rather than twenty alerts.

`<ConversationThread onSignal>` is the new observer seam these use — every
signal, already applied, for the facts a query cache cannot hold.
