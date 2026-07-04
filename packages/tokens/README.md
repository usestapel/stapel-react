# @stapel/tokens

Semantic design tokens for the Stapel frontend pipeline (L0, frontend-standard
§1). TypeScript is the single source of truth; `tokens.css` (CSS custom
properties with `[data-theme="dark"]` overrides) is generated from it at build
time. **No components live here.**

## What's inside

- `colors` — semantic colors; **every token is a light/dark pair**
- `typography` — font families, size/line-height scale, weights
- `spacing` — spacing scale (px)
- `radii` — border radii
- `elevation` — box-shadow levels (light/dark pairs)
- `breakpoints` — exactly three: `phone` / `tablet` / `desktop` (min-width px)
- `generateTokensCss()` — deterministic (byte-stable) CSS generator
- `cssVar(name)` — helper returning `var(--stapel-…)` references

## Usage

```ts
import { colors, breakpoints, cssVar } from "@stapel/tokens";
import "@stapel/tokens/tokens.css";

colors.primary.light; // "#4657d9"
breakpoints.tablet;   // 768
cssVar("color-primary"); // "var(--stapel-color-primary)"
```

Dark theme: set `data-theme="dark"` on `<html>` (or any subtree root).

## Rules it exists to enforce

Raw hex/px values are banned outside this package (frontend-standard §4.1) —
consume `var(--stapel-*)` or the typed TS objects only.

## Notes

- Standalone-buildable; the npm tarball ships `src/` (frontend-standard §7).
- TODO: React Compiler precompile at publish is not applicable here (no
  components/hooks), tracked at the monorepo level for consistency.
