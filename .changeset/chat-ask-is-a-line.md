---
"@stapel/chat-react": patch
---

The notification ask stops taking the screen hostage (D64), and the whole
inbox row opens its thread (D65).

- `<ChatNotificationsPrompt>` renders in the thread's own flow instead of a
  modal sheet. As a modal it opened over the open thread a second after the
  first message and its mask swallowed every click outside its own box — the
  composer, the message list, the other conversation in the split; a walker
  run sat at the input for 30s and failed. Nothing is gated behind the ask, so
  refusing to answer it must cost nothing. Same moment, same copy, same
  `usePermission` state machine, plus a denied arm that says where the switch
  is; new copy keys `chat.notify.allow` / `chat.notify.not_now`.
- A conversation row is now one control rather than a 60×20 name button inside
  a 300×80 box: an `openHref` row is a real anchor over the whole row
  (right-clickable, in the browser's history), an `onOpen` row is a
  keyboard-operable button with the same hit area. Clicking the preview, the
  subject or the clock opens the thread.
