---
"@stapel/search-react": minor
---

The phone SERP's location row is one compact line again, and stops overlapping itself.

Measured on a live 390×844 SERP, in both themes, on every result page — the
category listing, the text search and every filter slice:

```
{"kind":"clipped-left","t":"A chosen place on the map","x":-4}
{"kind":"overlap","a":"· Within 25 km","b":"Filters","px":43}
```

On screen that read as "…hosen place on the map · Within 25 kmlters", with the
red active-filter plaque floating in the top-right corner of the page attached
to nothing. At 1440 it was clean, which is why nothing before this caught it.

**Three causes, none of them the flex row itself.**

1. An antd `<Button>` CENTRES its content. `minWidth: 0` let the left half
   shrink and nothing clipped what was inside it, so the label overflowed its
   box symmetrically — off the left edge of the screen at `x = -4` and 43px
   across the word "Filters" at the other end. A shrunk box with no `overflow`
   is not a truncation, it is an overlap.
2. Nothing declared which end may shrink. Both were `1 1 auto`, so a long place
   name took width from a word that must never lose any.
3. The count was an antd `<Badge count>` — an absolutely positioned `sup` hung
   off the top-right CORNER of what it wraps. At the trailing edge of a
   full-width row that puts it outside the row entirely.

**Now:** `place · radius` left, `Filters` right, on one line. The left half is
the only one that grows or shrinks and it truncates with an ellipsis (`display:
block` on the label is load-bearing — `text-overflow` does nothing on a flex
box, which is how the first attempt cut the name mid-glyph); the right half is
`flex: 0 0 auto`; the count is a pill IN the flow beside the word it counts
for. The place and the radius now share ONE truncating label, so the radius can
no longer travel past the label's end on its own.

The rules that had to reach inside the button ship as a hoisted stylesheet
(`locationLineCss`, the pattern `<ListingCard>` and `<SkinCarousel>` use),
since a descendant rule is not expressible as an inline style.

`search-location-filters-badge` is now the trailing group rather than an antd
`<Badge>`; the count carries `data-testid="search-location-filters-count"`, and
the truncating label `data-testid="search-location-label"`.

A new skin demo variant, `long-place`, photographs the measured case: a place
name a geocoder really returns, at 390px, with a radius and a count on the same
line.
