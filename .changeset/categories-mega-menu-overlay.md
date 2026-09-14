---
"@stapel/categories-react": minor
---

The mega-menu is an overlay in its own right: its own scroll box, the page held still, a wider rail, and a hover

Owner's desktop read of the stand (2026-09-14): the wheel over the open «All
categories» panel scrolled the PAGE, the root column was too narrow, and a
root row gave no hover. Measured at 1440 headless before the change: the
host's wrapper was the scroll box (`max-height: 796px; overflow-y: auto`),
the panel inside it was 468px tall, so the box had nothing to scroll and the
wheel chained to the document — 1500px of page in five turns, under a
`position: fixed` panel that then re-anchored to a header that had left the
screen. The rail was `minmax(180px, 1fr)` beside `3fr`: 338px of 1400.

**`<CategoryMegaMenu>` is its own scroll container.** The panel carries
`maxHeight` (default `MEGA_MENU_MAX_HEIGHT`, `calc(100dvh - 32px)`),
`overflow-y: auto` and `overscroll-behavior: contain` — probed on Chromium
153, `contain` stops the chain even on a box with nothing to scroll, so the
wheel over the panel never moves the page whether or not the panel is tall
enough to scroll. A host that stands the panel under a measured header passes
the room actually left (`maxHeight={\`calc(100dvh - ${top}px - 16px)\`}`) and
drops any scroll box of its own around it: two nested scroll containers give
the wheel to whichever has the taller content, which is the outer one exactly
when the panel fits.

**The document is held still while the panel is mounted** on a wide viewport
(`lockScroll`, default `true`): `overflow: hidden` on the root element with
`scrollbar-gutter: stable` beside it so a classic scrollbar's gutter stays and
the page does not widen under the panel; reference-counted, previous inline
values restored exactly. A host drawing the panel inline as a page region
passes `lockScroll={false}` — the showcase does. UPSTREAM ASK: this is the
lock `SkinDialog` keeps module-private; `@stapel/tokens-antd/skin` should
export it so the third copy is the last.

**The rail is wider, and a token.** `minmax(MEGA_MENU_RAIL_WIDTH, 1fr)`
beside `MEGA_MENU_PANE_FRACTION` fr — 360px at the floor, two sevenths of the
panel above it (386px of 1400), and `railWidth` moves the floor. The
reference's overlay could not be measured from this host (its edge refuses
the address), so the number is a floor a host can move, not a measurement.
Each root row ends in a chevron, the reference's row anatomy.

**A root row has a hover and a focus fill.** The fill leaves the style
attribute for a hoisted sheet (`megaMenuCss()`, deduped by
`MEGA_MENU_STYLE_HREF`): `MEGA_MENU_ROOT_CLASS` on every root,
`MEGA_MENU_ROOT_ACTIVE_CLASS` on the disclosed one, and `:hover`,
`:focus-visible` and the modifier all paint `surface-sunken` — the design
system's neutral tertiary fill, the same role the flat tile hovers with, and
not the `brand-subtle` the disclosed row drew before: a pointer resting on a
row is an answer about that row, and a brand tint there reads as a selection
nobody made. The disclosed row still says which it is by weight. Pane links
underline under the pointer.

The `/default` size line moves 19.5 → 20 KB (19154 → 19530 B measured with
dependencies held constant; the note in `package.json` carries the arithmetic).
