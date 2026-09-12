---
"@stapel/cdn-react": patch
---

The picture fills its square cell, whatever shape the photograph is.

`@stapel/image` puts the metadata's own `aspect-ratio` on the box a caller
styles, for layout-shift protection, and a `height: 100%` does not beat it:
against a parent whose height is itself an `aspect-ratio`, the percentage is
indefinite and the metadata ratio wins. A portrait photo therefore drew a
tall narrow strip inside the grid's square cell. The gallery's box is pinned
to the cell (`position: absolute; inset: 0`) with the reservation cancelled
(`aspect-ratio: auto`), which is a definite box in both axes for
`object-fit: cover` to crop into.
