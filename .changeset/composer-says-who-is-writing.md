---
"@stapel/chat-react": minor
---

The composer says who is writing — a refusal for a visitor, a warning for a guest.

`<MessageComposer>` had no mandate gate at all, while every other control in
this pair has one. A walk of a listing page found the call control beside it
stating "Sign in to call." and the composer — live, enabled, one gesture from a
first message — saying nothing.

Two arms, because they are two different facts:

- `anonymous` is now BLOCKED with `chat.composer.blocked.sign_in`. `POST
  /conversations/{id}/messages/` is `IsAuthenticated`, so the press bought a 401
  delivered after the click — the same refusal `<StartDirectChat>` moved in
  front of the click for the same reason.
- `guest` is NOT blocked. An issued anonymous identity is authenticated and the
  send goes through; refusing it would overrule the server, and on a host that
  mints a guest to open the thread it would strand the person in a room they
  were let into. `MessageComposerBag.signInHint` carries
  `chat.composer.sign_in` instead — the account is browser-local, so the
  conversation is reachable from this device and no other until they sign in.
  The default skin renders it beside the send control, before the gesture rather
  than after it.

`member`, `asking` and `unavailable` are unchanged: the last stays available
because "we could not ask" is not "you may not". Both sentences ship in en, ru
and es.
