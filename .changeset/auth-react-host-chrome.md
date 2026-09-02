---
"@stapel/auth-react": minor
---

Host chrome opt-out for `AuthPanel` (owner ruling: pair visuals must never
force themselves on a host).

`<AuthPanel/>` gains `chrome?: "card" | "bare"`. The default `"card"` is the
existing behaviour, unchanged: the panel paints its own page ground
(`surface="base"`) and floats its own raised card — a working sign-in screen
out of the box. `"bare"` renders NO page surface and NO card of its own:
zones A–D land directly in the host's frame, so the host keeps its exact
pre-0.17 look — its own branded card, width, padding and background — instead
of a card-in-card squeezed into that card's padding with truncated tab
labels. The antd token algorithm still applies (`SkinTheme surface="bare"`
themes without painting), and the brand/legal slots render only when passed:
no dev-build `SlotPlaceholder` box, because a host that owns the chrome
already states its identity outside the panel.
