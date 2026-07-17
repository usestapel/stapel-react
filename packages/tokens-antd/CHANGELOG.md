# @stapel/tokens-antd

## 0.4.0

### Minor Changes

- a86ced9: §68 — colour tokens move to a neutral, design-system-agnostic role dictionary (`surface`/`surface-raised`/`surface-sunken`/`surface-overlay`, `text`/`text-muted`/`text-subtle`/`text-on-accent`, `border`/`border-subtle`/`focus-ring`, `brand`/`brand-hover`/`brand-active`/`brand-subtle`, `link`/`link-hover`, and `success`/`warning`/`error`/`info` × `{base, -bg, -border, -on}`). Breaking, shipped as minor per the postmortem versioning law (alpha, no stable consumers frozen on the old names yet):

  - **Old ad-hoc names are gone**: `accent`, `background-*-subtle`, `upperground-*`, `icon-*`, `text-invert`, `overlay`, and the whole L3 component-token tier (`button-primary-bg`, `card-bg`, `card-border`, `link-text`, ...) no longer exist. No compatibility alias layer — the dictionary is flat now: a role name IS the CSS var suffix (`--stapel-<role>`, no more `--stapel-color-<role>` + separate `--stapel-<component>`).
  - **The generator ships as a bin**: `@stapel/tokens` now exposes `stapel-tokens` (package.json `bin`), so a host runs it directly (`npx stapel-tokens --theme ./stapel.theme.json --out ./dir`) instead of vendoring/forking the engine. The engine itself moved from an unpublished `scripts/tokens-lib.mjs` into the published `src/gen/`.
  - **Merge-contract**: a host's `stapel.theme.json` deep-merges OVER `theme.default.json` (`mergeTheme`, unit-tested) — the host wins on every leaf it defines, everything else falls through to the default.
  - **Versioned Tailwind adapters** (owner follow-up, "Tailwind 5 won't break us"): the generator always emits a version-independent stable core (`tokens.css`, plain `--stapel-<role>` vars) plus addressable adapters — `tailwind@4` (default, `@theme`, no RGB) and `tailwind@3` (legacy, RGB triplets + a `theme.extend.colors` config snippet), both owned in the bin so a host never forks either. A future `tailwind@5` is one more adapter, additive.
  - **tokens-antd / tokens-mui** read the new roles directly (`colors["brand"]`, `colors["surface-raised"]`, ...) — the old `bridgeColorRoles` indirection table is gone since the neutral dictionary already speaks the bridges' vocabulary. `tokens-antd` keeps its live-CSS-var read (a host's brand colour flows through even to antd's seed-token derivation) and gains `colorTextTertiary`/`colorBgElevated` mappings (`text-subtle`, `surface-overlay`).

  Not published — versions bumped and changeset queued for the coordinator to publish after acceptance.

### Patch Changes

- Updated dependencies [a86ced9]
  - @stapel/tokens@0.5.0

## 0.3.0

### Minor Changes

- 6ef6c44: Fixed the theme-bridge root cause behind a live report: a deployment's
  customized brand colour never showed up in any default skin, which kept
  rendering Stapel's own stock colour (`#4657d9`) regardless of what the host
  configured.

  `toAntdTheme`/`toAntdThemeConfig` used to resolve every colour role from
  `@stapel/tokens`' compiled-in `colors` snapshot — frozen at THIS package's
  own publish time to `@stapel/tokens`' OWN default theme. A host customizing
  its brand colour does so exactly as `@stapel/tokens`' README prescribes (copy
  `theme.default.json` → `stapel.theme.json`, edit the `ramps`, `pnpm
gen:tokens`) — which regenerates the HOST's own `tokens.css` custom
  properties, never this published package's compiled JS.

  `role()` now reads the live `--stapel-color-<role>` custom property off
  `document.documentElement` at call time (the exact value the host's
  regenerated `tokens.css` sets, already resolved through whichever
  `data-theme` is active) and falls back to the compiled-in default only where
  there is no DOM to read (SSR, tests, a host that never loaded `tokens.css`).
  No API change — same `toAntdTheme(mode)`/`toAntdThemeConfig(mode)` signature;
  every default skin that already wraps itself in
  `<ConfigProvider theme={toAntdThemeConfig(mode)}>` (or a host that does) now
  actually reflects the host's brand colour with zero code changes on their
  end.

## 0.2.0

### Minor Changes

- 48188d9: New package: **`@stapel/tokens-antd`** — the Ant Design leg of the token bridge
  (frontend-guidelines §2.4; owner decision §38 T3). `toAntdTheme(mode)` projects
  `@stapel/tokens` L2 core tokens onto an antd `ConfigProvider` `theme.token`;
  `toAntdThemeConfig(mode)` adds the light/dark algorithm so antd's derived
  neutrals flip too. Pure functions reading the ONE shared role table in
  `@stapel/tokens` (no colour decisions of its own), so it and `@stapel/tokens-mui`
  cannot diverge. `antd` is a peer dependency. Mapping-table tests included.

### Patch Changes

- Updated dependencies [48188d9]
- Updated dependencies [2c22f06]
  - @stapel/tokens@0.4.0
