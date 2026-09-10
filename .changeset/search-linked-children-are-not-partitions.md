---
"@stapel/search-react": minor
---

A pointer is not a section of this template.

From the owner's read of 0.38.0 on the stand: the storefront's car page drew
`All | New 0 | Used 3 | Car rental 0`. Two of those zeroes were a section's
real emptiness. The third was a count of a wholly different branch of the
catalogue, under a chip that would have filtered this page by an id path into
that branch.

A partition is one template split by a value its children's names express —
new / used / for rent. A POINTER (`CategoryChild.linked`, stapel-categories
0.22.0) is another category an operator drew among these children so a person
can reach it from here. It does not narrow this feed and it has no count of its
own.

`PartitionChild` gains `linked?: boolean` and `href?: string`, and
`<PartitionChips>` splits its items ONCE, above everything that reads them: the
cells, the roving stop, the value lookup and the arrow keys see only the
SECTIONS. So a linked child can never be a radio, never draws a count (even
when a host maps its rows mechanically and hands one over), and never matches
`value` — a stale address naming a pointer leaves the row on its parent chip
instead of lighting a pointer up as the chosen section.

`<PartitionChips linkedChildren>` decides what happens to the pointer itself:

- `"chip"` (default) draws it AFTER the partitions, in its own row outside the
  radiogroup — a `role="radiogroup"` containing a link announces a choice with
  an option nobody can choose. It is an outlined pill (a hairline, no fill: it
  is a way out of this page, not one of the choices on it) carrying the
  target's name and a trailing arrow, and it is a real `<a href>`, so a
  middle-click or a ctrl/cmd-click opens the target in a new tab and nothing on
  this page changes. A linked entry with no `href` is not drawn at all — a link
  with no address is not a link — and is still out of the partition either way.
- `"none"` omits it here, for a page whose TILE STAGE already shows the same
  destination as a tile: one destination offered twice, a row apart, is a
  person wondering what the difference is.

A row with no pointers renders exactly what it rendered before, with no extra
box around it.

The `default` size budget goes 32.75 → 33.25 KB, measured and written into the
entry's own note (32539 → 32779 B, dependencies held constant): 29 B over the
old line, and a ceiling that fails on 29 B of a shipped defect fix is a gate
proving nothing.
