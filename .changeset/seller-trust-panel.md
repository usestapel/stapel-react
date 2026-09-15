---
"@stapel/listings-react": minor
---

`<ListingSerpCard trustPanel>` — the seller-trust column the reference draws,
as slots, without the claims.

Measured on the reference's 980px results row: a fixed 220px column on the
card's trailing edge carrying the seller's name, a one-line rating, two badges
and both verbs. Fixed rather than a flexible remainder, because a remainder
makes the panel's width a function of the title's length and the verbs then
change size row to row. Applied in the ROW arm only — below the row threshold
the card is a stacked tile, and a 220px column beside a 260px card is not a
layout.

THE BADGES ARE SLOTS AND NOTHING ELSE, and that is the point rather than a
detail. The reference's badge wording asserts facts about a seller —
documents checked, a reliability grade — which a given deployment may not
hold. A badge is drawn only where the host can name the fact behind it from
its own data, so this pair ships the shape and never the claim: pass no
badges and the panel draws none, with no placeholder and no reserved box
suggesting a verification is coming. An empty array draws nothing too.

The whole panel is absent when nothing is passed, so a host with only a seller
name gets a seller name.
