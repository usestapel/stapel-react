---
"@stapel/listings-react": patch
---

The list card clamps its title too, so all three cards read one rule

`titleClamp.ts` was introduced to end two cards answering one question two
ways. It ended one of the two: `<ListingSerpCard>` — the card a live
storefront draws in its DEFAULT view, and therefore the one most people are
actually looking at — was still a bare `<Typography.Text>` with no clamp at
all. Not cut mid-word, because it had no ellipsis either; simply unbounded, so
a long title ran on for as many lines as it wanted and left the row ragged
beside its neighbours.

It now carries `TITLE_CLAMP_CLASS` and hoists the same sheet under the same
`href` as the grid card and the tile. The suite asserts the rule across all
three cards together rather than card by card, which is the shape of the
mistake it is there to catch: the first fix reached the tile and missed the
grid, the second reached the grid and missed the list.
