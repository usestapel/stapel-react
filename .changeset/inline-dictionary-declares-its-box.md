---
"@stapel/search-react": patch
---

The rail's open dictionary declares the box it actually draws.

0.47.0 made `"inline"` the column layout's default dictionary face and left
`facetGroupReservedHeight` stating one field's height for every dictionary —
which was true of the closed face and ~280px under the open one. A floor that
low is not a hole (a low floor is a no-op the moment content exists), but it is
no protection either, and protecting the FIRST MOUNT is the only reason that
function exists: on a category leaf the schema is a second read, so the rail
draws once from the answer and again when the schema lands, and every group
under a dictionary moved by the difference.

`facetGroupReservedHeight` now takes the dictionary's face and reserves the box
plus its rows plus its fold for the inline one — 308px for a heading, eight
rows and a "Show all", against 310 measured in headless Chromium on the real
component in a 280px column. The closed faces reserve the field alone and no
longer add a fold link they never draw (84 → 58px).

The rows it counts are the BODY's own capped list rather than the outer fold's
slice, which for a dictionary is every option the answer carried.
