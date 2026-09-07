---
"@stapel/search-react": patch
---

search: two things stop moving when the answer lands late (D465, D466), and two levers a host could not reach

Both defects were measured by a desktop walker on a live stand, and both are the
same shape — chrome drawn from the ANSWER while the row or column around it is
still drawn from a HOLD, committed in one place and relocated when the hold ends.

- **D465, the rail's footer bar.** On 9 of 12 loads the answer arrives before the
  category schema. The panel holds its whole group list while the schema is in
  flight, but the footer bar reads the count and the active filters — which come
  from the answer — so it mounted under the loading box at
  `data-facets-schema="pending"` and travelled down the rail when the groups
  replaced it (CLS 0.0056 at 1280, 0.0018 at 1920, 0.0076 at 1100; schema-first
  loads drew the rail in one commit and shifted nothing). The bar is part of the
  settled rail, so it now waits for it: nothing mounts in the hold that the
  settled rail will move.
- **D466, the results toolbar.** The count renders nothing until the answer
  lands, so a row spaced by `space-between` held ONE item in the first frame and
  two in the second — moving the sort/view control from the leading edge to the
  trailing one as the number arrived (x 328→459 at 1280, 564→863 at 1920,
  312→796 at 1100, and the same jump on a seller's page). The row now always
  carries a leading box for the count, and it is the only half that grows: the
  control's trailing edge is the row's in every frame, whatever the count says
  or whether it says anything at all. A host reserving the count's width locally
  to work around this can delete that.

Two additions, because neither was reachable from outside the pair:

- **`<SearchPage footerBar>`** — the footer bar writes its own `display` inline,
  so a consumer stylesheet could only suppress it with an `!important`, and the
  page hard-coded `"static"` for the column and forwarded nothing. The per-layout
  defaults are unchanged (`"static"` in the column, none in the sheet); a host can
  now pass `false` to draw its own count under the rail, or `"sticky"` to pin it.
- **`PartitionChild.count`** — the chip draws a section's total itself, in the
  muted weight every other counted control on the page uses. A host with the
  number had exactly one string to put it in (`name`), so the count rendered in
  the same weight as the word beside it. Optional and additive: an absent count
  draws nothing, because an absent count is not a zero.

Size budget for the skin raised 32.25 → 32.5 KB by measurement (32.01 → 32.10 KB,
90 B for the two levers; the D465/D466 fixes are themselves a net 30 B smaller).
