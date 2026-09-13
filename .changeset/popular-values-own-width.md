---
"@stapel/search-react": minor
---

The popular-values band uses the width it is given.

Measured on the live storefront's `/c/transport` at 1440 (headless Chromium):
the results column is 1088px and the band's columns box drew **377px** of it —
three columns of a make and its count — leaving 711px of white and stacking
twelve values four rows deep.

Two causes, compounding:

- `inline-size: fit-content` sized the box to its WORDS, so the pane's width
  was never used;
- the container-query ladder asked for `breakpoints.desktop` (1200px) before
  granting a fourth column, and this block is the window less a 280px rail less
  the gap — 1088px at 1440. **The top rung could never fire.** The rungs were
  window-scale numbers measuring a container that is never window-sized, which
  is the exact mistake the module's own doc argued a media query would make.

`columns="responsive"` is now native multicol over a column MEASURE — the same
mechanism the expanded band next door already uses. The element answers "how
many columns" from its own width, with no container query, no rungs and no
hoisted sheet.

`POPULAR_VALUE_COLUMN_WIDTH` is 150 (was 200), swept in a real browser over the
live twelve makes and a worst case of the longest make with a four-digit count:
200/170/160 all give 4 columns and 3 rows in that pane; 150 gives 6 and 2. The
used column is 155px there and never below 152px at any width swept, so nothing
wraps — the old claim that a value wraps under its own number below 200 does not
hold at the default type step.

Before and after, with the literal styles the component emits:

| pane   | before          | after           |
|--------|-----------------|-----------------|
| 1088px | 3 cols, 4 rows, 666px white | **6 cols, 2 rows, no white** |
| 840px  | 3 cols, 4 rows, 418px white | 4 cols, 3 rows, no white |
| 600px  | 3 cols, 4 rows, 178px white | 3 cols, 4 rows, no white |
| 380px  | 3 cols, 5 rows (cramped)    | 2 cols, 6 rows |

The columns box halves, 68px to 34px.

The numeric arm is untouched: a host that names a count still gets that many
words-wide columns, still clamped by `POPULAR_VALUES_MAX_COLUMNS`. That ceiling
now governs the numeric arm only — the responsive arm has no count to cap and
needs none, because the measure is the ceiling: no pane, however wide, can
produce a column narrower than a value and its count.

REMOVED, and nothing outside this package imported them: `popularValuesLadderCss`,
`POPULAR_VALUES_CLASS`, `POPULAR_VALUES_LADDER`, `POPULAR_VALUES_STYLE_HREF`.
ADDED: `POPULAR_VALUES_COLUMN_GAP`, half of the arithmetic that decides how many
columns a pane buys, so a host sizing a reservation for this block need not
re-measure it.
