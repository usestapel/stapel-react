---
"@stapel/chat-react": patch
---

The message composer no longer refuses a box nobody has touched.

Measured on a phone: the instant a message was sent, the now-empty "Write a
message…" field drew a validation refusal — "Write something first." under a
disabled send button — for something nobody had done. Same on first paint. The
composer derived its validation state from "the value is empty", and an empty
box is exactly what a freshly drawn and a just-sent composer both are.

Validation state now comes from "the person has addressed this field", not from
the value:

- `MessageComposerBag` gains **`visibleAvailability`** (the same verdict as
  `availability`, withheld until the person has typed or pressed send) and
  **`pristine`**. `availability` is unchanged and stays the ENFORCEMENT gate —
  a disabled send button is not an error state.
- `send()` over an empty box still posts nothing, and now marks the composer
  touched, so asking and being refused is what puts the reason on screen.
- A successful send resets to PRISTINE rather than to "empty and therefore
  invalid"; the caption goes with the message.
- `<ConversationThreadPanel>` draws its blocked caption from
  `visibleAvailability` and stamps `data-pristine` on the input, so neutrality
  is measurable rather than a colour. Enter over an empty draft sends nothing
  and now says why, exactly as pressing the button does.

A skin that renders `availability` keeps its old behaviour; the new field is
what a skin should print.
