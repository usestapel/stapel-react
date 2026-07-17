# @stapel/tokens-mui

## 0.3.0

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

## 0.2.0

### Minor Changes

- 48188d9: New package: **`@stapel/tokens-mui`** — the Material UI leg of the token bridge
  (frontend-guidelines §2.4; owner decision §38 T3). `toMuiTheme(mode)` projects
  `@stapel/tokens` L2 core tokens onto a MUI `Theme` (`palette`/`shape`/
  `typography`) via `createTheme`. The explicit Material alternative to
  `@stapel/tokens-antd` (§2.3), reading the SAME shared role table in
  `@stapel/tokens` so the two bridges cannot diverge. `@mui/material` (and its
  `@emotion/*` peers) are peer dependencies. Mapping-table tests included.

### Patch Changes

- Updated dependencies [48188d9]
- Updated dependencies [2c22f06]
  - @stapel/tokens@0.4.0
