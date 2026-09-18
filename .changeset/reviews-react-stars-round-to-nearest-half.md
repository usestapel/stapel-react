---
"@stapel/reviews-react": patch
---

`<RatingBadge>`'s stars round to the nearest half, never down.

A 4.8 rating drew four and a half stars: antd's `<Rate allowHalf>` floors to
the half beneath the value, so the fifth star was half filled under a number
that said 4.8. The badge was handing `<Rate>` the raw display average.

`starBreakdown` has always stated this module's own rule — a remainder of a
quarter or more is a half star, three quarters or more a whole one — and the
badge now quantises through it before antd sees the value. The number beside
the glyphs and the line a screen reader speaks are unchanged: the glyphs are
the approximation, never the number.
