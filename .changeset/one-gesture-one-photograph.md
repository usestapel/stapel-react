---
"@stapel/listings-react": patch
---

The listing strip commits on the owner's swipe rule, not the browser's.

The rule is 30% of a slide OR a flick, and one gesture moves exactly one
photograph however far it travels. The strip answered with native
scroll-snap, which can express neither half: there is no threshold to set,
because the browser snaps to the NEAREST point — 50% by construction, measured
on the stand as no commit at 45% of the hero's width and a commit at 48% — and
`scroll-snap-stop: always` governs a fling's momentum rather than a finger the
scroller is following, so a long continuous drag crossed as many slides as the
finger did and advanced two photographs.

The rule now runs where the finger is, through `swipeStep`: the same function
the card's strip and the desktop lightbox already commit on, which returns
`-1 | 0 | 1` and is therefore one photograph by construction. Two answers to
one question inside one package become one.

`touch-action: pan-y` is the other half — the browser stops panning the strip
sideways, so exactly one thing moves it and the two cannot disagree. A
diagonal thumb still scrolls the page.
