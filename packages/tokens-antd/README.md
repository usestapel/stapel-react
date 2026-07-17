# @stapel/tokens-antd

The Ant Design leg of the **token bridge** (§68; frontend-guidelines §2.4;
owner decision §38 T3). It projects `@stapel/tokens`' neutral colour roles
onto an Ant Design `ConfigProvider` theme — so integrating a
`@stapel/*-react` pair's default skin already carries the user's theme,
light and dark.

The §68 neutral role dictionary IS the bridge vocabulary — a role name
(`brand`, `surface-raised`, `text-muted`, …) is both the CSS var suffix
(`--stapel-brand`) and the exact key this package reads off `@stapel/tokens`'
`colors` object. There is no separate role→role indirection table (the old
`bridgeColorRoles` map is gone) — this package only renames roles to antd's
flat token field names and picks the `light`/`dark` half; it holds no colour
decisions of its own, so it and `@stapel/tokens-mui` cannot drift.

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

## The mapping (§68; frontend-guidelines §2.4)

| `@stapel/tokens` role | antd `theme.token` |
| --- | --- |
| `brand` | `colorPrimary` |
| `success` / `warning` / `error` / `info` | `colorSuccess` / `colorWarning` / `colorError` / `colorInfo` |
| `text` | `colorText` |
| `text-muted` | `colorTextSecondary` |
| `text-subtle` | `colorTextTertiary` |
| `surface` | `colorBgLayout` |
| `surface-raised` | `colorBgContainer` |
| `surface-overlay` | `colorBgElevated` |
| `border` | `colorBorder` |
| `border-subtle` | `colorBorderSecondary` |
| `link` / `link-hover` | `colorLink` / `colorLinkHover` |
| radius `md` | `borderRadius` |
| font-size `md` | `fontSize` |

Every field above is resolved by reading the host's **live**
`--stapel-<role>` CSS custom property off `document.documentElement` at call
time (falling back to the compiled-in default only with no DOM — SSR/tests) —
so a host's customized brand colour flows through even to antd's seed-token
colour derivation (hover/active shades), not just its own light/dark mode.

`antd` is a peer dependency — the consuming app brings its own copy.
