---
"@stapel/reviews-react": patch
---

`<ReviewListPanel emptyState>` — the empty arm is a slot, and `null` is one of its answers

"No reviews yet" is right for a reviews page and wrong inside a card that has
already said the same thing in its own words. Measured on a live storefront:
two empty states forty pixels apart, hidden by a host stylesheet rule aimed at
our test id. `emptyState` now takes a node, or an explicit `null` to render
nothing; absent keeps the pair's own state, so nothing changes for existing
hosts. The three cases are distinguished by identity rather than truthiness —
a nullish slot would have fallen back to the substrate's default.
