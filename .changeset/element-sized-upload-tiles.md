---
"@stapel/cdn-react": minor
---

An upload tile asks for the tier its own box needs, not for the smallest file
on the ladder.

Both upload skins rendered a raw `<img>` into a hardcoded 96x96 frame with
`smallestVariantUrl(image)` as its source — the bottom rung, chosen with no
reference to the frame at all. On a 2x or 3x phone that frame wants 192-288
device pixels, so the smallest tier is guaranteed to be under-resolution, and
every thumbnail in the fleet's upload grids was soft on exactly the screens
that show it most.

The new `<CdnThumbnail>` (exported from `/default`) routes the CDN case through
`@stapel/image`'s `<Image>`, which measures the element's own rendered box,
multiplies by the live device pixel ratio and picks the smallest tier that does
not upscale. The local pick stays a plain `<img>`: an object URL has no ladder,
and the whole point of it is that it paints before any request is made.
`smallestVariantUrl` remains exported — it is still the right answer for a
caller that genuinely wants the cheapest byte — it is just no longer what a
rendered tile uses.
