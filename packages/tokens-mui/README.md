# @stapel/tokens-mui

The Material UI leg of the **token bridge** (§68; frontend-guidelines §2.4;
owner decision §38 T3). It projects `@stapel/tokens`' neutral colour roles
onto a MUI `Theme` — the explicit Material alternative to
`@stapel/tokens-antd` (§2.3).

The §68 neutral role dictionary IS the bridge vocabulary — a role name
(`brand`, `surface-raised`, `text-muted`, …) is both the CSS var suffix
(`--stapel-brand`) and the exact key this package reads off `@stapel/tokens`'
`colors` object. There is no separate role→role indirection table (the old
`bridgeColorRoles` map is gone) — this package only renames roles to MUI's
nested `palette`/`shape`/`typography` fields and picks the `light`/`dark`
half; it holds no colour decisions of its own, so it and
`@stapel/tokens-antd` cannot drift.

## Usage

```tsx
import { toMuiTheme } from "@stapel/tokens-mui";
import { ThemeProvider, CssBaseline } from "@mui/material";

<ThemeProvider theme={toMuiTheme(mode)}>
  <CssBaseline />
  <App />
</ThemeProvider>;
```

## The mapping (§68; frontend-guidelines §2.4)

| `@stapel/tokens` role | MUI theme field |
| --- | --- |
| `brand` | `palette.primary.main` |
| `brand-active` | `palette.primary.dark` |
| `text-on-accent` | `palette.primary.contrastText` |
| `success` / `warning` / `error` / `info` | `palette.{success,warning,error,info}.main` |
| `success-bg` / `warning-bg` / `error-bg` / `info-bg` | `palette.{...}.light` |
| `success-on` / `warning-on` / `error-on` / `info-on` | `palette.{...}.contrastText` |
| `text` / `text-muted` / `text-subtle` | `palette.text.{primary,secondary,disabled}` |
| `surface` | `palette.background.default` |
| `surface-raised` | `palette.background.paper` |
| `border` | `palette.divider` |
| radius `md` | `shape.borderRadius` |
| font-size `md` | `typography.fontSize` |

`@mui/material` (and its `@emotion/*` peers) are peer dependencies — the
consuming app brings its own copy.
