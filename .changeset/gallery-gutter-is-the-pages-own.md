---
"@stapel/listings-react": minor
---

The listing gallery's gutter is the page's own, per breakpoint (D418).

Measured on the live listing page: `getComputedStyle(gallery).gap` answered
**`12px` at 1280 and `12px` at 390**, and the gaps between neighbouring photos
were 12 on both — while the page around it declares 4px on a phone and 24px on
a desktop. Neither declared number was ever on screen: the grid painted a flat
`spacing[3]`, so its tiles sat closer together than the page edge on a desktop
and three times further apart than it on a phone.

`--stapel-page-gutter` is a responsive token role (`@stapel/tokens`: 4 / 8 / 24
by breakpoint, declared once with its own media arms), and the gap reads it as
a VAR rather than as a number picked in JS — a computed value is applied at
render, so a window resized between renders keeps the gutter it was drawn with,
where a var reflows. Written through `cssVar` so a renamed role fails to
compile instead of resolving to nothing, with the old flat step as the fallback
for a host that loads no token stylesheet. Exported as `DETAIL_GALLERY_GUTTER`
for a container laying out against the same edge.
