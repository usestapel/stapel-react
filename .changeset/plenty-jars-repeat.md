---
"@stapel/shell-react": minor
---

New `/theme` subpath: `<ThemeModeControl/>`, the three-state theme switch every
app in the fleet was about to write for itself.

Light / dark / follow-the-system, in the Django-admin idiom (sun, moon,
half-disc). `system` is a rule, not a colour: the mark stays on the half-disc
whatever it resolves to, and the half-disc's accessible name carries the
resolution (`"Match system (Dark)"`), so "following the system, currently dark"
never reads the same as "pinned to dark".

Plain DOM and inline `currentColor` SVG — no antd, no react-router, no CSS file
to import — because the two hosts that need it render nothing alike (one is
Tailwind + radix with no antd at all). 1.6 kB, isolated from the package root,
which stays pure for scaffold-time `resolveNav`.

`applyThemePreference()` is the single writer: `data-theme` (the canon
`@stapel/tokens-antd`'s `resolveThemeMode()` reads), the Tailwind `dark` class
and `color-scheme` in one call, so a host cannot end up half themed. It
persists nothing to a backend — the host keeps owning its profile field —
but does cache the choice under the published
`THEME_PREFERENCE_STORAGE_KEY` for a pre-paint boot script.
