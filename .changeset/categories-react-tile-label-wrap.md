---
"@stapel/categories-react": patch
---

The tile grid's label wraps instead of clipping. Measured on a live 390px
classified catalogue: the tile's inner column is ~105px, one root name is a
single 12-letter unbreakable word wider than that — the two-line clamp
ellipsized it on its FIRST line — and the longest root name is three lines of
text in a two-line box. The label now hyphenates under the document's `lang`
(`hyphens: auto`, with `overflow-wrap: anywhere` as the dictionary-less
floor), takes a third clamped line, and sits on a slightly tighter line so
the art corner keeps its room.
