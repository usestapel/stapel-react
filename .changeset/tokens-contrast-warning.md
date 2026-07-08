---
"@stapel/tokens": patch
---

WCAG contrast check for the core-token grid — WARNING only, not a build gate
(user decision Q10a, 2026-07-08): tighten to an error once ramps/host palettes
stabilise; this v1 must never break `pnpm gen:tokens` or CI.

- New `scripts/contrast.mjs`: pure WCAG relative-luminance / contrast-ratio
  calculator (`hexToRgb`, `relativeLuminance`, `contrastRatio`), plus an
  explicit, curated `CONTRAST_PAIRS` contract — the "intentional" fg/bg pairs
  implied by the L2 naming grid (background/upperground/text/icon/border ×
  role) that must stay legible: text-on-background pairs (AA normal text,
  4.5:1) and icon/border/focus-ring-on-background pairs (WCAG 1.4.11 non-text
  contrast, 3:1). `checkContrastPairs` skips any pair whose fg/bg token isn't
  defined on a given theme (custom/host themes needn't cover the whole grid)
  and any non-hex resolved value (e.g. the `scrim` ramp's rgba).
- `tokens-lib.mjs`'s `validateTheme` now runs `checkContrastPairs` against both
  themes' resolved core tokens and appends any hits to its existing `warnings`
  array (same convention as the grid-conformance warning) —
  `⚠ contrast: <fg> на <bg> (<theme>) = X.X:1 < <threshold> (WCAG AA)`. No new
  error path; `gen:tokens`/`gen:tokens:check` stay green.
- Fixed a latent crash in `resolveRef`: an unpaired/non-string core-token ref
  (already an `errors`-reported case) made it throw instead of resolving to
  `undefined`, which the new contrast pass would otherwise have hit for any
  theme with a structural error.
- Against the shipped default palette (`theme.default.json`), this surfaces 6
  warnings (both themes counted): `text-negative`/`background-negative-subtle`
  (light, borderline ~4.49:1), `text-on-accent`/`accent` (dark, 2.3:1), and
  `border-primary`/`background-primary` + `border-secondary`/
  `background-secondary` in both themes (borders are intentionally subtle
  today — flagged for a future palette pass, not fixed here).
- Tests: `test/contrast.test.ts` (calculator unit tests — white/black = 21:1,
  a colour against itself = 1:1, symmetry, non-hex → `null`, a known-failing
  pair, `checkContrastPairs` warn/no-warn/skip cases) and two new cases in
  `test/tokens-lib.test.ts` proving an intentionally-failing pair warns while
  `errors` stays empty (i.e. `gen:tokens` still exits 0).
