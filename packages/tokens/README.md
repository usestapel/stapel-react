# @stapel/tokens

Three-tier design tokens for the Stapel frontend pipeline (L0; frontend-standard
§1 + frontend-guardrails §1). **`theme.default.json` is the single source of
truth**; everything under `src/generated/` — CSS custom properties, typed token
names, the raw-ramp module, and the Tailwind bridge — is emitted by
`pnpm gen:tokens` and drift-gated (`pnpm gen:tokens:check`). **No components
live here.**

## The three levels

```
L1  ramps (raw hex)   gray.50 … gray.950, brand.500   ← hex is born ONLY here
    └─ standard ramps baked into the package (ramps.standard.json);
       custom host ramps in the theme's `ramps` section. NOT emitted to CSS —
       there is no `--stapel-raw-*` to reference (bypass closed by absence).
L2  core (semantic)   background-primary, text-primary, accent, …
    └─ each = EXACTLY a {light,dark} pair of `<ramp>.<step>` refs. Unpaired,
       or a hex, or a dangling step ⇒ BUILD ERROR (teaching message).
    └─ emitted: `:root` (light) + `[data-theme="dark"]` (dark).
L3  component         button-primary-bg, card-border, …
    └─ each = EXACTLY one core-token ref. Emitted as a `var()` reference, so
       light/dark ends at L2 — a theme-dependent component token is impossible.
```

## Usage — the one right way

```html
<!-- Tailwind (canonical, vanilla static utilities). Import the bridge once: -->
<!-- app.css:  @import "tailwindcss"; @import "@stapel/tokens/tailwind.css"; -->
<div class="bg-background-primary text-text-primary border-border-primary">
  <button class="bg-button-primary-bg text-button-primary-text">Buy</button>
</div>
```

```ts
import "@stapel/tokens/tokens.css"; // the CSS custom properties
import { cssVar, breakpoints } from "@stapel/tokens";

cssVar("color-accent"); // "var(--stapel-color-accent)" — typed; typos fail to compile
breakpoints.tablet;     // 768
```

Dark theme: set `data-theme="dark"` on `<html>` (or any subtree root). Theme
switching never touches the JS runtime.

## Never

- **hex/rgb/hsl literals in components** — hex is born only in ramps.
- **raw ramps in components** (`gray.500`, `@stapel/tokens/raw`) — that subpath
  is for theme-config + the design-system showcase only (lint-guarded, G2).
- **Tailwind arbitrary values with interpolation** (`` `bg-[${x}]` ``) — the JIT
  cannot see them ("works in dev, breaks in prod"). Use a token utility.

## Package surface

- `@stapel/tokens` — `cssVar`, `colors`, `componentTokens`, the scales
  (`spacing`/`radii`/`elevation`/`fontSize`/…), `breakpoints` + helpers, and the
  typed name unions (`CoreTokenName`, `ComponentTokenName`, `StapelVar`, …).
- `@stapel/tokens/tokens.css` — the generated stylesheet.
- `@stapel/tokens/tailwind.css` — the Tailwind v4 `@theme` bridge.
- `@stapel/tokens/raw` — L1 ramps (theme-config / showcase only).
- `@stapel/tokens/theme.default.json` — the source, for hosts to copy + edit.
- `manifest.json` / `llms.txt` — machine- and LLM-readable self-description.

## Notes

- Standalone-buildable; the npm tarball ships `src/` + the generated artifacts
  (frontend-standard §7). `build` is just `tsc` — generated files are committed.
- Regenerate after editing `theme.default.json`: `pnpm gen:tokens`
  (drift gate: `pnpm gen:tokens:check`).
