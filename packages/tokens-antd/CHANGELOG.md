# @stapel/tokens-antd

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
