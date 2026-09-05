---
"@stapel/tokens": minor
"@stapel/eslint-plugin": patch
---

`page-gutter` — the first scale role whose value changes with the viewport.

How far a page's content sits from the edge of the window cannot be one
number (24px on a 390px phone is a tenth of the screen spent on nothing) and
must not be each component's own guess, which is what it was: a shell, a
category page and a search page each picked a spacing step, and a page
composed of the three had three different left edges down one window.

The generator gains a `scales.responsive` section — roles authored as SPACING
STEP names (so they stay on the scale a theme retunes in one place) with one
value per breakpoint. It emits mobile-first: the narrowest value in the base
`:root` block, then one `@media (min-width: …)` arm per wider breakpoint,
outside the light/dark pair because a gutter is not a colour. `page-gutter`
ships as phone `space-1` / tablet `space-2` / desktop `space-5`, reachable as
`var(--stapel-page-gutter)`, `cssVar("page-gutter")` and the new `responsive`
export.

`@stapel/eslint-plugin`: `stapel/valid-token-name` reads the responsive roles
off the token manifest instead of calling `cssVar("page-gutter")` an unknown
colour role — a responsive role is the one scale namespace with no prefix on
the wire, and the skip list stays data-driven rather than hardcoded.
