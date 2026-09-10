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
it. No new prop on the grid: the container follows the surface the tiles
already take.

**`<CategoryCarouselStrip>` takes the same rule**, and it gains the prop —
`tileSurface?: "flat" | "card"`, default `"flat"`, the same word and the same
default the grid uses, because a landing that draws both rows must not be flat
in one and panelled in the next. It had BOTH fills: the `raised` wrapper behind
the row and an antd `Card` behind every entry inside it. Flat, the wrapper is
`bare` with the same token text colour, and there is no card at all — the LINK
carries the tile's box (the padding and radius the card was giving it) and the
two classes, so the whole tile is the pointer target and its hover fill comes
from `<CategoryTileGrid>`'s own published rule set, hoisted under the same
`href`. One sheet, one hover, no second definition to drift. `"card"` restores
the strip exactly as it was.

The `default` size budget goes 19 → 19.5 KB (18846 → 18967 B, dependencies held
constant), written into the entry's own note. The change fits under the old
line and would have left it with 33 B, which by that entry's own standard is
not a ceiling but a gate that fails on the next honest byte — raised here
rather than left as a red for the wave after this one.
