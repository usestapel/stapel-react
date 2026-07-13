# @stapel/tokens-mui

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
