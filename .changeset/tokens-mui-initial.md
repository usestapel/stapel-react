---
"@stapel/tokens-mui": minor
---

New package: **`@stapel/tokens-mui`** — the Material UI leg of the token bridge
(frontend-guidelines §2.4; owner decision §38 T3). `toMuiTheme(mode)` projects
`@stapel/tokens` L2 core tokens onto a MUI `Theme` (`palette`/`shape`/
`typography`) via `createTheme`. The explicit Material alternative to
`@stapel/tokens-antd` (§2.3), reading the SAME shared role table in
`@stapel/tokens` so the two bridges cannot diverge. `@mui/material` (and its
`@emotion/*` peers) are peer dependencies. Mapping-table tests included.
