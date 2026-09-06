---
"@stapel/shell-react": minor
---

shell: the pinned header paints its own seam, and holds its own layer (D458)

At a fractional scroll offset a **one-pixel row of the page showed above the
pinned header** — reproduced by the owner. It is not a layout fault: the
stand's frame-synced scan says the header does not move (`top` 0 and a constant
height at every integer step from 0 to 300, at 1570 and at 390). The sticky box
and the content under it snap to device pixels *independently*, so at 0.5px
there is a device row belonging to neither.

Both halves of the answer are paint, and paint belongs with the declaration
that causes it. `publicShellCss()` now carries them, gated on
`[data-sticky="true"]` — a new attribute the header writes for the width it is
actually drawn at, beside `data-phone-chrome`:

- a `::before` at `inset-block-start: -1px`, `block-size: 1px`,
  `background: inherit` — the header's own resolved background, so there is no
  second colour to go wrong on the day a skin changes, on either theme or
  brand. Absolutely positioned and out of flow, so it is not a flex item of the
  header's row and costs `--stapel-header-height` nothing (a filter rail, a
  results toolbar, a chip row and a condensed top bar all pin against that
  number);
- `transition: box-shadow 120ms ease-out`, with `transition: none` under
  `prefers-reduced-motion: reduce`. The shadow itself is still the host's — this
  transitions whatever a brand hung on `data-scrolled` and declares none.

**The compositing layer is a new prop, `headerLayer`, and it is OFF.**
`will-change: transform` is the other half of the textbook answer — it asks the
engine to pin the header at integer device pixels rather than re-rasterise it
against a fractional offset — and on the owner's own Chrome (headed, dark theme,
a listing page) a screenshot at ~30px of scroll shows the header **visually
absent** while the DOM says `top: 0`, height 56, opaque, `z-index: 1000`.
Reproduced three times; no headless probe ever saw it. A sticky element handed
its own layer, composited wrong by that build, is the suspect — and a header
that is not there is a worse defect than a hairline. The strip closes the seam
on its own; `headerLayer` writes `data-layer="true"` for a deployment that has
looked at it on the browsers it actually serves. `will-change` appears in the
sheet exactly once, behind that attribute.

The rules hang on `PUBLIC_HEADER_CLASS` (`stapel-public-shell-header`, exported
and now written on the header), not on the `data-testid` a host had to reach
for. The test id is unchanged.

**A host carrying these rules in its own sheet can delete them** — the `::before`
strip, the `transition` and its reduced-motion arm, and the `will-change`, which
a host should delete rather than move to the prop until it has a browser it can
reproduce the seam on and not the vanishing header.
`[data-testid="public-shell-header"][data-scrolled="true"] { box-shadow: … }`
stays: which edge a pinned header draws is still a brand decision.
