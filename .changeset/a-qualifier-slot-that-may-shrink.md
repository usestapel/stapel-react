---
"@stapel/profiles-react": patch
---

`<PersonRow trailing>`: the qualifier slot may SHRINK.

The trailing slot was `flex-shrink: 0`, so whatever a host put in it kept its
widest measure and the ROW grew instead. A rating badge that wraps its own
stars, score and count was therefore never handed a width narrow enough to
wrap in: a six-width walk of a client storefront measured the seller line at
575 CSS px inside a 360px viewport, and a review count cut mid-word at 768.

The slot is now `flex: 0 1 auto` with `min-inline-size: 0` — it asks for its
content's width and gives it back under pressure, down to zero, with the lead
beside it keeping its own `min-width: 0`. What happens inside is the trailing
node's own business (wrap, ellipsis, clip), and it can only choose once it is
told how much room there is.
