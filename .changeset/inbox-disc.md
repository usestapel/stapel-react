---
"@stapel/chat-react": patch
---

The inbox's faces wear the same disc as every other surface.

`<CounterpartyAvatar>` is this package's own avatar — the other three surfaces a
classified draws a person on go through `@stapel/profiles-react`'s
`<PersonAvatar>`, and the two components may not import one another. Both now
read `useIdentityTint` from `@stapel/tokens-antd/skin`, so one person is one
colour across the inbox, the seller page, the listing page's seller block and a
result card's seller line. Keyed on the counterparty's id, so a rename does not
repaint them, and only where there is exactly one counterparty — the same
condition the initial itself is drawn under.

The background it replaced was `colorFillQuaternary`: a TRANSLUCENT fill, which
has no luminance of its own and therefore no contrast ratio that can honestly be
claimed for it — it is whatever is behind it. The disc is opaque by
construction, which is what makes the number below a number. Measured in
headless Chromium with both operands read as computed styles off the rendered
nodes: worst **8.40:1 in light and 10.33:1 in dark**, against a 4.5:1 bar.

The UNKNOWN arm — a conversation whose people this deployment cannot name — is
deliberately left as it was, neutral and untinted: a colour is an identity, and
there is nobody to identify.

The `@stapel/tokens-antd` peer floor rises to `>=0.20.0`, the release that
carries `useIdentityTint`.
