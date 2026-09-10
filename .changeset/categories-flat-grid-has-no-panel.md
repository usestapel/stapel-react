---
"@stapel/categories-react": minor
---

A flat tile grid has no panel behind it.

The tiles went flat in 0.27.0 and the box around them did not. `<SkinTheme>`
defaults to `surface="raised"`, which paints `colorBgContainer` over the whole
component — so the stand still showed a lighter strip the width of the grid on
the desktop catalogue page, and a full panel on the phone and behind the
landing's compact strip (owner's read of 0.29.0, dark). It is the same block
fill the tiles themselves had just lost, one box further out, and no rule in
this component could see it: the wrapper paints it, and everything the grid
draws — the wrap grid, the phone scroller, the reserve box — sits inside that
wrapper and paints nothing of its own. One gate is therefore all three, and
each of the three is tested rather than assumed.

With `tileSurface="flat"` (the default) the container is flat too: no
background, no border, no shadow. The tiles sit on the page.

Two details worth knowing:

- `surface="bare"` paints *nothing*, including the text colour `"raised"` would
  have written, so the flat arm states `color: var(--stapel-text)` instead —
  which is strictly better than what it replaces, because the custom property
  resolves per theme at paint time where `SkinTheme` froze the value of
  whichever side mounted first.
- the tiles' own hover fill (`surface-sunken`) is now the only fill in the box,
  which is what makes it read as a hover at all: over a `colorBgContainer`
  panel the two are one step apart and the highlight was nearly invisible in
  the dark theme.

`tileSurface="card"` keeps the panel — a grid of filled tiles was designed on
it. No new prop: the container follows the surface the tiles already take.

The `default` size budget holds at 19 KB (18846 → 18864 B, dependencies held
constant), recorded in the entry's own note — 136 B of room left.
