---
"@stapel/cdn-react": patch
---

The uploaded photo tile carries badges, not paragraphs.

At 390px a settled tile printed its phase, its cover label and the dedupe
note as one unseparated run-on blob wrapped into a 96px column. They are
three different kinds of thing: the phase is now a small `StatusTag` in one
corner of the picture, the cover label the primary badge in the opposite
corner, and every outcome that is a sentence (the dedupe note, the variants
ladder) moved out of the tile into the grid's one-line `aria-live` notice,
beside the slot `settled` already owns. The tile holds no free text at all.
