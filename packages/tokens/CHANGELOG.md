# @stapel/tokens

## 0.5.0

### Minor Changes

- a86ced9: §68 — colour tokens move to a neutral, design-system-agnostic role dictionary (`surface`/`surface-raised`/`surface-sunken`/`surface-overlay`, `text`/`text-muted`/`text-subtle`/`text-on-accent`, `border`/`border-subtle`/`focus-ring`, `brand`/`brand-hover`/`brand-active`/`brand-subtle`, `link`/`link-hover`, and `success`/`warning`/`error`/`info` × `{base, -bg, -border, -on}`). Breaking, shipped as minor per the postmortem versioning law (alpha, no stable consumers frozen on the old names yet):

  - **Old ad-hoc names are gone**: `accent`, `background-*-subtle`, `upperground-*`, `icon-*`, `text-invert`, `overlay`, and the whole L3 component-token tier (`button-primary-bg`, `card-bg`, `card-border`, `link-text`, ...) no longer exist. No compatibility alias layer — the dictionary is flat now: a role name IS the CSS var suffix (`--stapel-<role>`, no more `--stapel-color-<role>` + separate `--stapel-<component>`).
  - **The generator ships as a bin**: `@stapel/tokens` now exposes `stapel-tokens` (package.json `bin`), so a host runs it directly (`npx stapel-tokens --theme ./stapel.theme.json --out ./dir`) instead of vendoring/forking the engine. The engine itself moved from an unpublished `scripts/tokens-lib.mjs` into the published `src/gen/`.
  - **Merge-contract**: a host's `stapel.theme.json` deep-merges OVER `theme.default.json` (`mergeTheme`, unit-tested) — the host wins on every leaf it defines, everything else falls through to the default.
  - **Versioned Tailwind adapters** (owner follow-up, "Tailwind 5 won't break us"): the generator always emits a version-independent stable core (`tokens.css`, plain `--stapel-<role>` vars) plus addressable adapters — `tailwind@4` (default, `@theme`, no RGB) and `tailwind@3` (legacy, RGB triplets + a `theme.extend.colors` config snippet), both owned in the bin so a host never forks either. A future `tailwind@5` is one more adapter, additive.
  - **tokens-antd / tokens-mui** read the new roles directly (`colors["brand"]`, `colors["surface-raised"]`, ...) — the old `bridgeColorRoles` indirection table is gone since the neutral dictionary already speaks the bridges' vocabulary. `tokens-antd` keeps its live-CSS-var read (a host's brand colour flows through even to antd's seed-token derivation) and gains `colorTextTertiary`/`colorBgElevated` mappings (`text-subtle`, `surface-overlay`).

  Not published — versions bumped and changeset queued for the coordinator to publish after acceptance.

## 0.4.0

### Minor Changes

- 48188d9: Add the design-system **bridge role table** (`bridgeColorRoles`,
  `bridgeRadiusRole`, `bridgeFontSizeRole` + the `BridgeColorRole` type;
  frontend-guidelines §2.4). This is the SINGLE L2-core-token → neutral-role
  mapping that both `@stapel/tokens-antd` and `@stapel/tokens-mui` consume, so the
  two design-system theme bridges cannot drift. Hand-written (like the breakpoint
  helpers), not part of the generated surface; no token values change.

### Patch Changes

- 2c22f06: WCAG contrast check for the core-token grid — WARNING only, not a build gate
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

## 0.2.0

### Minor Changes

- a6c34e2: Design-system showcase (frontend-guardrails §4, task G7): `defineDemo` + a
  generated viewer + the headless-coverage completeness gate.

  **New package `@stapel/showcase`** — the demo SOURCE format. `defineDemo({ id,
title, description, component, covers?, flow?, tokens?, decorator?, variants })`
  is a literal, statically-extractable registration (mirrors `defineEvent`), plus
  `renderDemoVariant`/`variantIds` for stories and smoke tests. Viewer-agnostic:
  one `defineDemo` feeds four projections that can't drift from the component.

  **Hybrid viewer** (user-approved deviation from the spec's self-rolled Vite
  shell): the format stays ours; the VIEWER is a commodity. `gen:demos` projects
  each demo into CSF, and a thin private **Ladle** app (`@stapel/showcase-viewer`,
  Vite) renders them — chosen over Storybook for a clean, light pnpm-monorepo fit.
  `pnpm showcase` serves the whole workspace; the theme toggle drives
  `data-theme`, so demos re-theme through the G1 tokens with no JS in the token
  layer. The viewer is introspection-only — not published, not in any prod bundle
  (§5).

  **`gen:demos` driver + drift gate + completeness gate.** From
  `demo/**/*.demo.tsx` it emits `demo/generated/demos.json` + CSF stories
  (byte-stable, `pnpm gen:demos:check`), and enforces §4.2: every headless
  component a pair exports must be covered by ≥1 demo, else CI is red. Demos embed
  into `manifest.demos` + `llms.txt` (canonical compiled/linted/rendered examples)
  via `gen:manifest`.

  **`@stapel/eslint-plugin`**: new rule `demo-literal-meta` (recommended preset) —
  keeps `defineDemo` meta literal so extraction stays possible, the analogue of
  `event-literal-meta`.

  **`@stapel/auth-react`**: 13 demos covering all 14 headless exports (OTP,
  passkey login/registration, QR are the rich pilots; the rest mount + show their
  bag state). Demos are first-class code — token-styled (`cssVar`), i18n labels,
  flow-instrumented clicks (`data-analytics="flow"`), typechecked, linted with the
  product ruleset, and smoke-rendered. The pair's completeness gate is green.

  **`@stapel/tokens`**: a `Token palette` auto-demo that enumerates the generated
  token surface (L1 ramps, L2 core live var-refs, L3 component, scales) — always
  reflects the catalog, never a hardcoded list.

- f23c7f3: Retrofit `@stapel/tokens` to the frontend-guardrails three-tier contract (§1).

  The source of truth is now **`theme.default.json`**, not TypeScript. A driver
  (`pnpm gen:tokens`, drift-gated by `pnpm gen:tokens:check`, same family as
  `gen:api`/`gen:flows`) resolves it into committed generated artifacts:
  `src/generated/tokens.css`, a typed `src/generated/tokens.ts` (name unions +
  typed `cssVar`), `src/generated/raw.ts` (the `@stapel/tokens/raw` subpath), and
  `src/generated/tailwind.css` (a Tailwind v4 `@theme` bridge), plus the package's
  `manifest.json`/`llms.txt`.

  Three levels, with the invariants enforced by construction:

  - **L1 raw ramps** carry hex and are **never emitted as CSS custom properties** —
    there is no `--stapel-raw-*` to reference (bypass closed by absence of API);
    hex is born only in ramps.
  - **L2 core tokens** are each **exactly a `{light,dark}` pair** of `<ramp>.<step>`
    refs — an unpaired token, a hex, or a dangling step is a **build error** with a
    teaching message. Emitted as `:root` + `[data-theme="dark"]`.
  - **L3 component tokens** are each **exactly one core-token ref**, emitted as a
    `var()` reference, so a theme-dependent component token is syntactically
    impossible (light/dark ends at L2).

  Public API (`colors`, `cssVar`, the scales, `breakpoints` + helpers) is
  preserved. Non-breaking for the only consumer (`@stapel/core` uses
  `breakpoints`). Internal-only additions/removals: adds typed unions
  (`CoreTokenName`, `ComponentTokenName`, `StapelVar`), `componentTokens`, and the
  `./raw` / `./tailwind.css` / `./theme.default.json` subpaths; removes the
  internal `generateTokensCss()` runtime helper (CSS is now a generated artifact).
