---
"@stapel/chat-react": minor
---

One sentence, fourteen buttons: `<StartChatButton refusal>` decides where the
"why is this off" line goes.

Measured on the host's phone results page: fourteen cards, fourteen copies of
"Sign in to message the seller" down one column — the same sentence, about the
same session, printed once per listing. The rule this control has always
followed ("a switched-off control says why") is right for ONE control and wrong
for a list of them. The reason had not changed; only the number of places it was
printed had.

Every arm keeps the sentence reachable:

- **`"inline"`** — the default, and what the control has always drawn: the
  sentence beside this button, with the sign-in door on it. Right for a listing
  page, where there is one of them. Nothing already on screen moves.
- **`"pooled"`** — the button is drawn through `GatedButton`, so its reason is
  registered with the enclosing `PaneGate` and printed ONCE for the pane while
  every button's `aria-describedby` keeps pointing at that single copy. A screen
  reader still reads the reason WITH the control it belongs to: the sentence
  moves, it does not disappear, which is the difference between pooling and
  hiding. Outside a `PaneGate` it behaves exactly like the inline arm, so a host
  that asks for pooling and forgets the scope loses nothing.
- **`"none"`** — this control says nothing because the HOST has said it (a
  banner over the list, its own sign-in bar). The one arm that can leave a
  switched-off control unexplained, which is why it is opt-in and named for what
  the caller is taking on. The gate itself is untouched; what is dropped is the
  copy.

`StartChatRefusal` is exported. The pooled arm goes through the skin's
`GatedButton` rather than hand-wiring a `GatedControl` binding, so the blocked
paint and the reason's placement stay one decision made in `tokens-antd`.
