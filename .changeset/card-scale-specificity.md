---
"@stapel/listings-react": patch
---

The card type scale outranks antd's runtime sheet instead of racing it.

0.36.0 declared the scale on a single class and shipped inert. antd generates
a per-theme class carrying Typography's own `font-size`, injects it into
`<head>` at RUNTIME — after this package's static sheet — at the same (0,1,0)
specificity a single class has, so it won on order. Measured on a live
storefront: the class was on the element, the card's container was 1062px, the
`@container` rule was in the sheet, and the computed size was still antd's
16px. A `@container` wrapper adds no specificity of its own.

Worse than no change, because 0.36.0 also removed the inline `fontSize` the
SERP card used to carry: the inline style was the one thing that did outrank
antd, so the card lost its size entirely rather than converging on the shared
one.

The selectors are doubled now, which is (0,2,0) against antd's (0,1,0) and
wins on specificity rather than on order — the only thing that is stable
against a sheet injected after yours.
