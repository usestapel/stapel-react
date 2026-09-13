---
"@stapel/tokens-antd": minor
---

`identityTint` / `useIdentityTint` — the disc a person with no photograph wears, decided once for the whole fleet.

Four surfaces draw a person on a classified deployment: a result card's seller
line, the seller page, the listing page's seller block and the chat inbox. They
are drawn by TWO packages — `@stapel/profiles-react`'s `<PersonAvatar>` and
`@stapel/chat-react`'s `<CounterpartyAvatar>` — and neither may import the
other. A tint decided inside one of them is the same person wearing two
different colours on one screen, which is worse than the flat grey both had. So
the decision lives here, in the package both already depend on.

The tint is DERIVED from a stable key the caller owns (a user id, a display name
only when there is no id) through a pinned FNV-1a hash — never from render
order, never from an index in a list, never from anything random: a face that
changes colour when a list re-sorts is not an identity.

**The disc and the ink are returned together by one call, and that is the
design.** A caller that could take the background from here and the text colour
from somewhere else is a caller that can pair a measured operand with an assumed
one — the exact shape of a contrast claim that passes a gate and fails on the
glass. There is one way to get a tint and it hands over both halves.

The colours are antd's own preset families, which the active algorithm
regenerates — so a dark page gets the dark palette without this module knowing
which page it is on. No hex is written. Initials against their own disc,
measured across all 13 families in both algorithms: **8.40:1 worst in light
(yellow), 10.33:1 worst in dark**, against a 4.5:1 bar, with no family dropped
to clear it. The saturated construction every product reaches for first — a
shade-6 disc with light initials — is documented in the module because it was
measured and REFUSED at 1.36:1: the preset families differ enormously in
luminance at shade 6, so the only way to ship it would be to drop families until
the rest passed by accident.

What it does not buy is stated in the module rather than hidden: the disc
against the PAGE is 1.04:1 at its worst, because a pale tint on a pale ground
has almost no luminance contrast. The identity is carried by the initials; the
disc is a hue, and hue is not luminance. It is no worse than the translucent
`colorFillQuaternary` both packages drew before — which, being translucent, had
no fixed ratio to claim at all.
