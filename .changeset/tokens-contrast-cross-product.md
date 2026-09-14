---
"@stapel/tokens": patch
---

Contrast gate is a cross product, and dark chrome is legible.

The gate checked a hand-picked list — `text`/`text-muted` on three surfaces, `link` and `focus-ring` on `surface` only, no `text-subtle`, and `border`/`border-subtle` exempted as "decorative". A live dark stand (video-react) measured what the list left out: tertiary text 4.11:1 and the input outline 1.70:1 / the divider 1.24:1 on `surface-raised`. Now every neutral text role (`text`, `text-muted`, `text-subtle`, `link`, `link-hover`) is checked at AA 4.5:1 on every fill text sits on (the four surfaces, `brand-subtle`, the four status tints), `focus-ring` at 3:1 on every surface, and `border`/`border-subtle` at the same 3:1 on every surface as kind `decorative` (WCAG 1.4.11 exempts a boundary something else carries — a failing pair still needs a documented exception whose reason names that fill or shadow), in both modes. `TEXT_ROLES`, `TEXT_FILL_ROLES`, `UI_ROLES`, `DECORATIVE_ROLES`, `UI_FILL_ROLES` are exported beside `CONTRAST_PAIRS`.

Default theme. Dark: `text-subtle` gray.500 → new gray.450 `#959ca9` (4.11 → 5.7:1 on raised), `border` gray.700 → gray.500 `#7b828f` (1.70 → 4.1:1), `border-subtle` gray.800 → new gray.550 `#6b737f` (1.24 → 3.3:1). Light: `text-subtle` gray.500 → new gray.575 `#636b77` (3.9 → 5.4:1 on white, 3.4 → 4.8:1 on `brand-subtle`); `text-muted` stays above it. Three gray steps (450, 550, 575) join the standard ramps. Light `border`/`border-subtle` stay at the reference's light outlines by owner decision and are the only `contrastExceptions` left (each reason names what bounds the component instead).
