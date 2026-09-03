---
"@stapel/listings-react": minor
---

**The picture opens the listing, and the card looks like something you can open.**

Measured on a live 1440px grid: `<ListingCard>`'s anchor covered only the 267×104 text block. The 267×200 photograph — the largest and most obvious target on the card — sat outside it, with `cursor: auto`, and clicking it left the visitor exactly where they were. The card had no hover state of any kind: `box-shadow: none`, `transform: none`, the border unchanged.

- `<ListingPhotoStrip href linkComponent>` links each SLIDE. The strip itself stays a sibling of the reading anchor — a swipeable scroller is a control and a link may not contain one — but the picture inside it is now part of the card's target. The slide links are `aria-hidden` + `tabIndex={-1}`, so the card is still one tab stop with one accessible name: a second way to reach a destination, not a second destination.
- `<ListingCard>` passes its own `href` through and carries `CARD_HOVER_CLASS`, which raises the theme's own `boxShadowSecondary` and the focus colour on the border. antd's `hoverable` was not used: it hard-codes one shadow, cannot state a border, and cannot stand still for somebody who asked their system for less motion — this rule does, under `prefers-reduced-motion`.
- A surface that passes no `href` to the strip renders exactly as before. `<ListingSerpCard>` passes none: a horizontal swipe is a real gesture on a phone, and it is the gesture that rule was written for.
