---
"@stapel/shell-react": patch
---

`<ThemeModeControl/>` (both the compact header button and the settings variant's segments) now draws the shell's own `:focus-visible` ring (`--stapel-focus-ring`, 2px, `outline-offset:2px`) instead of the engine's default outline — it was the one header stop still showing Chromium's default blue ring while every other control in the chrome drew the token one. A single hoisted stylesheet (React 19's `<style href precedence>` dedup, the same mechanism `NavDock` already uses) carries the rule so an inline `style` object can still express everything else; a host's own `className` rides alongside it rather than replacing it. No visual change on a mouse click — the rule gates on `:focus-visible` only.
