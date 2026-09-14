---
"@stapel/search-react": patch
---

A range row is dropped when nothing in the answer carries the field

`withheldSlugs` is axis-discriminated on purpose — a `year` withheld as a
GROUP is still a slider — and that rule stands. Zero COVERAGE is a narrower
fact that cuts across it: no candidate in the result set carries the field at
all, so a from/to over it can only ever return nothing.

Measured on a live flats leaf: `living_space` came back `coverage: 0/34` and
was drawn as a from/to anyway. A row the reader has actually constrained is
still kept, because a constraint with no control to remove it is worse than a
dead control.

Also documents a KNOWN GAP found in the same read and deliberately not
patched here: `countedFacets` is specified as "the axes that already have a
bucket list on the rail" and is fed the SERVER's counted list, which is not
the same set. On that leaf `square` is counted with 30-odd bare integers, no
group is drawn for it, and the counted-wins rule then drops its range row too
— so the total-area filter exists in neither column. The fix is to pass the
DRAWN set, which `buildRangeGroups` cannot compute because it never sees the
groups. Two feature-level heuristics were tried and both were wrong; the
second was rejected by this package's own `year` fixture, which is a raw int
with no vocabulary exactly like `square` and whose bucket list IS wanted.
