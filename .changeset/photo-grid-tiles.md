---
"@stapel/cdn-react": patch
---

The photo gallery is a grid of square tiles.

It was a 96px thumbnail floating in a full-width dashed rectangle with three
stacked word buttons under it. Now: square cells filling their columns
(`object-fit: cover`, 96px as the floor), the column count read from the
CONTAINER's width through `useElementWidth` (three under 480, four under 768,
six above), the picker as one more cell of the same size carrying the only
dashed border, the whole grid as the drop target, and every badge and control
overlaid inside the picture — cover mark top-start, remove top-end, the move
arrows bottom-start, retry/cancel and the phase tag bottom-end. The controls
are icon-only with the existing labels on `aria-label`, always visible (a
phone has no hover) and still at the skin's 44px touch size; a switched-off
arrow is dimmed rather than removed. An item's error sentence joins the
dedupe note under the grid, where there is a line to put it on.
