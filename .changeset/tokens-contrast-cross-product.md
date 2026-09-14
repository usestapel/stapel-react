---
"@stapel/tokens": patch
---

Contrast gate is a cross product, and dark chrome is legible.

The gate checked a hand-picked list — `text`/`text-muted` on three surfaces, `link` and `focus-ring` on `surface` only, no `text-subtle`, and `border`/`border-subtle` exempted as "decorative". A live dark stand (video-react) measured what the list left out: tertiary text 4.11:1 and the input outline 1.70:1 / the divider 1.24:1 on `surface-raised`. Now every neutral text role (`text`, `text-muted`, `text-subtle`, `link`, `link-hover`) is checked at AA 4.5:1 on every fill text sits on (the four surfaces, `brand-subtle`, the four status tints), and every chrome role (`border`, `border-subtle`, `focus-ring`) at 3:1 on every surface, in both modes. `TEXT_ROLES`, `TEXT_FILL_ROLES`, `UI_ROLES`, `UI_FILL_ROLES` are exported beside `CONTRAST_PAIRS`.

Dark column, default theme: `text-subtle` gray.500 → new gray.450 `#959ca9` (4.11 → 5.7:1 on raised), `border` gray.700 → gray.500 `#7b828f` (1.70 → 4.1:1), `border-subtle` gray.800 → new gray.550 `#6b737f` (1.24 → 3.3:1). Two gray steps (450, 550) join the standard ramps. Light column byte-identical; the light pairs that fail the extended gate today (`text-subtle` 3.9:1, `border` 2.0:1, `border-subtle` 1.4:1 on white) are on record as reasoned `contrastExceptions` — surfaced as warnings on every build until the owner lifts the light values, at which point the stale-exception check deletes them.
