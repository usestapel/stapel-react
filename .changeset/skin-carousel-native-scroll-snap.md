---
"@stapel/tokens-antd": minor
---

`SkinCarousel` — the fleet's one swipe primitive, on native scroll-snap.

A horizontal photo strip is a design-system shape, not a listings feature: the
result card, the listing page, a category rail and a shop's promo row all want
the same strip, and the moment two of them hand-roll it a product has two
different swipe behaviours in it. It joins `SkinDialog` in the substrate for
the same reason that one is there — `@stapel/tokens-antd` is the package every
antd default skin already depends on.

There is no gesture code, and that is the design. The strip is a scroll
container with `scroll-snap-type: x mandatory` and slides on
`scroll-snap-align: start`, so momentum, the fling curve, the rubber-band at
both ends and the tap-that-must-not-become-a-drag are the platform's, tuned
per OS. What that buys for free: trackpad and shift-wheel scrolling on a
desktop, the browser's own scroll-into-view when Tab lands on a control inside
slide four, and a screen reader's normal reading order — the slides are IN the
document, never swapped by state.

- `peek` (default on, `SKIN_CAROUSEL_PEEK` = 8%, or a CSS length, or `false`)
  keeps the EDGE of the next slide on screen. That sliver is the only thing
  telling a visitor there is more, and it is what people swipe at.
- `aspectRatio` fixes the shape of one slide well, so a gallery does not change
  height as each image lands.
- `dots` draws a position indicator that is `aria-hidden` and holds no buttons:
  a tappable dot needs a name per dot, which is i18n copy the token bridge
  cannot invent, and the strip's list semantics already announce "item 3 of 12"
  in every locale with no key to register. The indicator follows the scroll on
  one rAF-coalesced measurement per frame and re-renders only when the index
  actually changes; a strip with neither `dots` nor `onSlideChange` attaches no
  scroll listener at all.
- `label` is a REQUIRED prop, the same contract `SkinDialog.dismissLabel`
  states — an unnamed scrollable region is announced as nothing.

The scrollbar is hidden (`SKIN_CAROUSEL_STYLE_HREF` / `skinCarouselCss()`, one
hoisted sheet per document), which is only safe because the strip itself is a
focusable scroll container: a keyboard reaches it and the arrow keys scroll it.
Colours are `cssVar()` role references carried in `--skin-carousel-*` custom
properties, so light and dark are correct by construction and one static sheet
serves a page full of carousels.

New from `/skin`: `SkinCarousel`, `SkinCarouselProps`, `SKIN_CAROUSEL_PEEK`,
`SKIN_CAROUSEL_STYLE_HREF`, `skinCarouselCss()`, and the four class-name
constants (`SKIN_CAROUSEL_CLASS`, `…_STRIP_CLASS`, `…_SLIDE_CLASS`,
`…_DOTS_CLASS`, `…_DOT_CLASS`).
