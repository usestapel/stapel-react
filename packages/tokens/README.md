# @stapel/tokens

Neutral colour-role design tokens for the Stapel frontend pipeline (§68;
frontend-standard §1 + frontend-guardrails §1). **`theme.default.json` is the
single source of truth**; everything under `src/generated/` — CSS custom
properties, typed token names, the raw-ramp module, and the Tailwind
adapters — is emitted by the package's own `stapel-tokens` bin
(`pnpm gen:tokens`) and drift-gated (`pnpm gen:tokens:check`). **No components
live here.**

## The dictionary

```
L1  ramps (raw hex)   gray.50 … gray.950, brand.500   ← hex is born ONLY here
    └─ standard ramps baked into the package (ramps.standard.json);
       custom host ramps in the theme's `ramps` section. NOT emitted to CSS —
       there is no `--stapel-raw-*` to reference (bypass closed by absence).
role (semantic)       surface, text, brand, success-bg, border-subtle, …
    └─ each = EXACTLY a {light,dark} pair of `<ramp>.<step>` refs. Unpaired,
       or a hex, or a dangling step ⇒ BUILD ERROR (teaching message).
    └─ emitted as `--stapel-<role>`: `:root` (light) + `[data-theme="dark"]` (dark).
```

A role name IS the CSS var suffix — there is no separate component tier: a
design-system bridge (`@stapel/tokens-antd`, `@stapel/tokens-mui`) or a
Tailwind adapter translates roles straight into its own theme fields.

**Full dictionary** (§68 — `surface`/`surface-raised`/`surface-sunken`/
`surface-overlay`; `text`/`text-muted`/`text-subtle`/`text-on-accent`;
`border`/`border-subtle`/`focus-ring`; `brand`/`brand-hover`/`brand-active`/
`brand-subtle`; `link`/`link-hover`; and `success`/`warning`/`error`/`info`
× `{base, -bg, -border, -on}`) — extend by adding a new 4-role type block
(e.g. a project-specific `live`/`attention`) without touching any emitter.

## The generator ships AS the package — no forking

`@stapel/tokens` exposes its generator as a bin, `stapel-tokens`, so a host
never vendors or forks the engine:

```sh
npx stapel-tokens --theme ./stapel.theme.json --out ./src/stapel-tokens
```

The host's `stapel.theme.json` deep-merges OVER `theme.default.json` (the
host wins on every leaf it defines — touching only `ramps.brand` still gets
every other role from the default). The bin always emits the **stable core**
(`tokens.css` — plain `--stapel-<role>` vars, version-independent) plus
whichever adapters you ask for via `--targets` (default: `core,tailwind@4,tailwind@3`).

## Usage — the one right way

```html
<!-- Tailwind v4 (default adapter, vanilla static utilities). Import once: -->
<!-- app.css:  @import "tailwindcss"; @import "@stapel/tokens/tailwind.css"; -->
<div class="bg-surface text-text border-border">
  <button class="bg-brand text-text-on-accent">Buy</button>
</div>
```

```ts
import "@stapel/tokens/tokens.css"; // the CSS custom properties (stable core)
import { cssVar, breakpoints } from "@stapel/tokens";

cssVar("brand"); // "var(--stapel-brand)" — typed; typos fail to compile
breakpoints.tablet; // 768
```

Dark theme: set `data-theme="dark"` on `<html>` (or any subtree root). Theme
switching never touches the JS runtime.

### Tailwind v3 (legacy)

Still on Tailwind 3? Import the legacy adapter instead of `tailwind.css`:

```js
// tailwind.config.js
const stapelColors = require("@stapel/tokens/tailwind-v3.config.cjs").colors;
module.exports = { theme: { extend: { colors: stapelColors } } };
```

```css
@import "@stapel/tokens/tailwind-v3.css"; /* the RGB-triplet vars the config reads */
```

## Never

- **hex/rgb/hsl literals in components** — hex is born only in ramps.
- **raw ramps in components** (`gray.500`, `@stapel/tokens/raw`) — that subpath
  is for theme-config + the design-system showcase only (lint-guarded, G2).
- **Tailwind arbitrary values with interpolation** (`` `bg-[${x}]` ``) — the JIT
  cannot see them ("works in dev, breaks in prod"). Use a token utility.

## Package surface

- `@stapel/tokens` — `cssVar`, `colors`, the scales (`spacing`/`radii`/
  `elevation`/`fontSize`/…), `breakpoints` + helpers, and the typed name union
  (`CoreTokenName`/`TokenName`/`StapelVar`).
- `@stapel/tokens/tokens.css` — the generated stable-core stylesheet.
- `@stapel/tokens/tailwind.css` — the Tailwind v4 `@theme` adapter (default).
- `@stapel/tokens/tailwind-v3.css` + `@stapel/tokens/tailwind-v3.config.cjs` —
  the legacy Tailwind v3 adapter (RGB triplets + JS config).
- `@stapel/tokens/raw` — L1 ramps (theme-config / showcase only).
- `@stapel/tokens/theme.default.json` — the source, for hosts to copy + edit.
- `bin/stapel-tokens.mjs` (`stapel-tokens` on PATH once installed) — the generator.
- `manifest.json` / `llms.txt` — machine- and LLM-readable self-description.

## Notes

- Standalone-buildable; the npm tarball ships `src/` + `bin/` + the generated
  artifacts (frontend-standard §7). `build` is just `tsc` (the bin/generator
  are plain ESM, not compiled) — generated files are committed.
- Regenerate after editing `theme.default.json`: `pnpm gen:tokens`
  (drift gate: `pnpm gen:tokens:check`).
