---
"@stapel/categories-react": patch
---

A tile with no art of its own can inherit its parent's

A walk of sixty category pages on a live classified found exactly one tile
drawing a monogram: a services row surfacing on the transport page whose
`catalog_icon` is empty, beside siblings that were all illustrated and under a
parent that carried art. A monogram is the honest answer for a catalogue with
no pictures at all; it is the wrong one for a single row inside an illustrated
branch, and nothing walked up.

`categoryTileEntry` takes an optional fallback icon and
`categoryChildTileEntries` an optional parent to derive it from. A parameter
rather than a lookup, because a tile entry is built from one row and that
module has no tree to climb — a caller threading its own parent's resolved icon
down gets a fallback that walks as far up as the caller does. A caller that
passes nothing keeps exactly the old behaviour, and the fallback never
overrides art a row actually has nor invents a reference where neither has one.
