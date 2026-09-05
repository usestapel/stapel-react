---
"@stapel/listings-react": patch
---

The favourites empty-state hint (`listings.favorites.empty_hint`) said "tap
the heart" in every locale, but the control it describes is a text button
labelled by `listings.card.favorite_add`. Rewrote the hint in all three
bundles (en, ru, es) to quote that label's own wording instead of naming an
imaginary heart-tap gesture.
