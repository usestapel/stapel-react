# @stapel/tokens-antd

The Ant Design leg of the **token bridge** (frontend-guidelines §2.4; owner
decision §38 T3). It projects `@stapel/tokens` L2 core tokens onto an Ant Design
`ConfigProvider` theme — so integrating a `@stapel/*-react` pair's default skin
already carries the user's theme, light and dark.

There is exactly **one** L2 → design-system role mapping table, and it lives in
`@stapel/tokens` (`bridgeColorRoles` + the radius/font-size roles). This package
only renames those neutral roles to antd's flat token field names and picks the
`light`/`dark` half — it holds no colour decisions of its own, so it and
`@stapel/tokens-mui` cannot drift.

## Usage

```tsx
import { toAntdTheme } from "@stapel/tokens-antd";
import { ConfigProvider } from "antd";

<ConfigProvider theme={{ token: toAntdTheme(mode) }}>
  <App />
</ConfigProvider>;
```

`toAntdTheme(mode)` returns just the flat `theme.token`. For a config that also
flips antd's **derived** neutrals (borders, hovers, fills) to the dark palette —
not only the seed tokens — spread the full config instead:

```tsx
import { toAntdThemeConfig } from "@stapel/tokens-antd";

<ConfigProvider theme={toAntdThemeConfig(mode)}>
  <App />
</ConfigProvider>;
```

## The mapping (frontend-guidelines §2.4)

| `@stapel/tokens` role | L2 core token | antd `theme.token` |
| --- | --- | --- |
| `brand` | `accent` | `colorPrimary` |
| `success` | `text-positive` | `colorSuccess` |
| `warning` | `text-warning` | `colorWarning` |
| `danger` | `text-negative` | `colorError` |
| `info` | `text-info` | `colorInfo` |
| `bgContainer` | `upperground-primary` | `colorBgContainer` / `colorBgElevated` |
| `bgLayout` | `background-primary` | `colorBgLayout` |
| `textPrimary` | `text-primary` | `colorText` |
| `link` | `text-brand` | `colorLink` |
| radius `md` | — | `borderRadius` |
| font-size `md` | — | `fontSize` |

`antd` is a peer dependency — the consuming app brings its own copy.
