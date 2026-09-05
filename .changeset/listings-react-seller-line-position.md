---
"@stapel/listings-react": patch
---

A result card can say who is selling it LAST.

`<ListingSerpCard sellerSlotPosition="below">` puts the seller line under the
place instead of over it. The bottom of a result card reads as one descending
line of provenance — what it is, then where it is, then who is selling it — and
this card had the seller between the specs and the place, where it reads as
part of the description rather than as the answer to "who am I buying from".
The reference classified, and the host measured against it, put it last.

A prop and not a change of mind, because the order is a surface's decision: a
seller's OWN page, where every card carries the same seller, wants that line
out of the way at the bottom, and a cross-seller feed leads with it. `"above"`
stays the default, so nothing already on screen moves.

Both arms render from one array rather than two branches, so they cannot drift
into two different pairs of nodes, and a card with no `location_label` still
draws the seller — the order spans two lines, one of which may not exist.
