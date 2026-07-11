---
"@stapel/tokens-antd": minor
---

New package: **`@stapel/tokens-antd`** — the Ant Design leg of the token bridge
(frontend-guidelines §2.4; owner decision §38 T3). `toAntdTheme(mode)` projects
`@stapel/tokens` L2 core tokens onto an antd `ConfigProvider` `theme.token`;
`toAntdThemeConfig(mode)` adds the light/dark algorithm so antd's derived
neutrals flip too. Pure functions reading the ONE shared role table in
`@stapel/tokens` (no colour decisions of its own), so it and `@stapel/tokens-mui`
cannot diverge. `antd` is a peer dependency. Mapping-table tests included.
