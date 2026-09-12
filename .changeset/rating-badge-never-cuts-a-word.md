---
"@stapel/reviews-react": patch
---

`RatingBadge` never truncates a word — it drops whole facts instead

0.8.1 made the badge one line by letting the review count shrink with a
`text-overflow: ellipsis`. On a narrow card that produced a count cut in the
middle of a word ("6 revi…"), which reads as a rendering failure rather than as
a shorter sentence.

The count no longer shrinks and carries no ellipsis. The badge measures its own
box (`useElementWidth`, the fleet's one element-width measurement) and walks a
stated order of sacrifice, each rung a form somebody would write by hand:

1. `full` — `***** 4.3 out of 5 · 6 reviews`
2. `no-scale` — drops "out of 5"; a five-star row already says what the scale is
3. `one-star` — collapses the row to the single glyph that means "this is a rating"
4. `short-count` — a real abbreviation from the dictionary (`reviews.rating.count_short`, "6 rev.")
5. `score-only` — the number, which is the last fact to go

New i18n: `reviews.rating.value_bare` (the score without its scale, so a locale
owns its decimal mark) and the `reviews.rating.count_short` plural family, in
en/ru/es.

Every fact the ladder takes off the screen stays in the accessibility tree: the
visible parts are `aria-hidden` and the row carries one visually-hidden sentence
with both numbers in full, so a collapsed badge never announces "1 star".

`pickRatingFit`, `estimateRatingWidth`, `ratingFitShape`, `RATING_FIT_LADDER`
and `RATING_FIT_METRICS` are exported from `/default` for hosts that compose
their own rating line and want it to degrade the same way.
