---
"@stapel/listings-react": patch
---

A card title is two lines, and the cut is never inside a word

`ListingFeedCard` (the tile) clamped its title to two lines. `ListingCard` (the
grid card) used antd's `<Typography.Text ellipsis>`, which is ONE line and puts
the cut wherever the line happens to end — in the middle of a word for any real
title. On a live storefront's home grid that drew job titles cut mid-word,
while the tile beside it wrapped the same string over two lines.

Two cards, two different answers to one question, and the wrong one was on the
busiest surface. The answer now lives once, in `titleClamp.ts`, and both cards
read it: `-webkit-line-clamp: 2` (so the browser puts its own ellipsis at the
end of the second line) plus `overflow-wrap: normal` (so a long word moves to
the next line whole instead of being broken to fill the current one — the same
defect one level down).

It stays a hoisted stylesheet rather than a style object, because
`-webkit-line-clamp` and `-webkit-box-orient` are dropped silently by every
style serializer outside a browser: a card written that way clamps in Chrome,
does not clamp in a test, and nothing says which.

`FEED_TITLE_CLASS`, `FEED_CARD_STYLE_HREF` and `feedCardCss` remain as aliases.
Both cards now emit the sheet under the same `href`, so React hoists one copy
for a page showing both card shapes.
