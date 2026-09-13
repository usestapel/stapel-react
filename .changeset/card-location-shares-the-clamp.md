---
"@stapel/listings-react": patch
---

A card's LOCATION line is cut by the same rule as its title — after a whole
word, never inside one.

Measured on the live storefront at 390px, where the grid card is tiled two
across: the place came out as a city, a comma, and the district name that
follows it chopped four letters in, on cards for two different Russian cities.
The title one row above it had already been fixed to wrap and clamp. So the
card was answering "how do I cut text" two different ways on two adjacent
rows, which is the thing `titleClamp.ts` was written to stop.

All three cards were wrong, each in its own way — the grid card and the tile
card on antd's `<Typography.Text ellipsis>`, the list card on no rule at all,
so a two-part place name simply wrapped and made the row ragged beside its
neighbours.

**The line count is now a parameter of the one rule, not the excuse for a
second one.** `titleClamp.ts` emits one sheet, under one href, with one arm per
count: `TITLE_CLAMP_LINES` is 2 and `LOCATION_CLAMP_LINES` is 1. Both arms
carry the same `-webkit-box` clamp, the same doubled-class specificity, and the
same `overflow-wrap: normal`.

One line for the place, and the reason is in the source: the place is a
subtitle, which city it is reads from the first words, and a card's height has
to be a property of the GRID rather than of how long this particular
neighbourhood happens to be called (D185 — a wrapped place name grew the text
block 104 → 128px and left the two cards beside it standing 24px shorter). One
line was always the intended count; the bug was only the cut.

Why swapping `ellipsis` for the clamp fixes it, given both draw one line: antd's
`ellipsis` is `white-space: nowrap`, so the line has no word boundary to break
at and the cut falls at whatever pixel the column ends — inside a word, always.
A one-line `-webkit-box` still wraps: the browser breaks at the last whole word
that fits, hides the rest, and puts the ellipsis after it. Verified in headless
Chromium at a 186px column, old rule beside new.

Two smaller consequences, both improvements:

- `ellipsis` truncated in JavaScript and offered the remainder back as a
  hover-only tooltip, which is nothing at all on the phone this was measured
  on. The clamp hides the overflow in CSS, so the whole place name stays in the
  DOM — selectable, findable by find-in-page, and read out in full by a screen
  reader.
- Renamed inside the package, no public API: `titleClampCss` →
  `cardClampCss`, `TITLE_CLAMP_STYLE_HREF` → `CARD_CLAMP_STYLE_HREF`. The
  emitted class names and the stylesheet href are unchanged, so a host
  stylesheet reaching for either still matches.
