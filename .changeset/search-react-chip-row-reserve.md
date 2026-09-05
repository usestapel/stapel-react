---
"@stapel/search-react": patch
---

The chip row holds its own box open, so the results do not drop 68px when it
settles.

Measured on the host's phone SERP (`after-avtomobili-390-light`, 2026-09-05):
an intermittent 0.045 CLS on a leaf. `<FilterChips>` rendered nothing until the
answer landed — which is the right thing to render for a search that will have
no chips — and then appeared and pushed the first card down the page under the
reader's eye.

It now reserves the row's block-size while the answer is IN FLIGHT **and** a row
is predictable: the surface was handed a category schema, or the address names a
category. Both mean the plan will come back with axes. A bare text query with no
category reserves nothing, because for that search the honest answer really is
"no row" and a box that opened and closed would be the same shift pointing the
other way. A settled answer with no chips renders nothing, exactly as before.

The reservation is `aria-hidden` scaffolding — new `CHIP_ROW_MIN_HEIGHT`
(exported), the 44px phone control floor the chips are sized to plus the row's
two bands of focus-ring room — and the real row takes the box over rather than
stacking on top of it.

Also regenerates the demo manifest for the `search.page → catalogue-leaf` and
`search.popular-values → responsive` variants that shipped with the one-panel
work.
