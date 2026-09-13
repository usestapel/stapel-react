---
"@stapel/listings-react": patch
---

The title clamp outranks a host's own selector on the same element

`-webkit-line-clamp` does nothing without `display: -webkit-box`, and that one
declaration was the easiest in the rule for a container to overwrite by
accident. A single class selector scores (0,1,0) — exactly what
`[data-testid="listings-serp-title"]` scores — so whichever sheet loaded last
won.

Measured on a live storefront: the host set `display: block` on its title
testids to stop two inline spans running together, that rule came second, and
every clamp in the app went inert. The class was on the element, the sheet was
in the head, `-webkit-line-clamp: 2` was in the computed style, and a
113-character title drew three lines — every check that could be made without
a browser passed.

The rule now repeats its own class, scoring (0,2,0). It cannot lose that tie,
and still loses to a host that really means it.
