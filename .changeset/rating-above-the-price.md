---
"@stapel/listings-react": minor
---

The list card reads its rating with the price, through a slot of its own

`<ListingSerpCard>` had one seller slot, drawn at the bottom with the place, so
a container with a rating to show had to put the stars there — three lines
below the price they qualify. The reference reads photo, stars, price, title.

`ratingSlot` is a second slot rather than a position for `sellerSlot`, because
the two answer different questions: a rating is a fact about the offer and is
read with the price, a seller's NAME is provenance and belongs with the place.
Both stay outside the anchor, for the reason the photo strip already lives by —
a rating usually links to the reviews it summarises, and a link inside a link
is neither valid nor operable.

The caveat is `sellerSlot`'s and is repeated on the new prop: `<RatingBadge>`
fetches, so a page of results reads every rating in ONE batched query keyed by
the distinct owners on the page and hands each card its answer.
