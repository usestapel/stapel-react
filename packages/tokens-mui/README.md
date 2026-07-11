# @stapel/tokens-mui

The Material UI leg of the **token bridge** (frontend-guidelines §2.4; owner
decision §38 T3). It projects `@stapel/tokens` L2 core tokens onto a MUI `Theme`
— the explicit Material alternative to `@stapel/tokens-antd` (§2.3).

There is exactly **one** L2 → design-system role mapping table, and it lives in
`@stapel/tokens` (`bridgeColorRoles` + the radius/font-size roles). This package
only renames those neutral roles to MUI's nested `palette`/`shape`/`typography`
fields and picks the `light`/`dark` half — it holds no colour decisions of its
own, so it and `@stapel/tokens-antd` cannot drift.

## Usage

```tsx
import { toMuiTheme } from "@stapel/tokens-mui";
import { ThemeProvider, CssBaseline } from "@mui/material";

<ThemeProvider theme={toMuiTheme(mode)}>
  <CssBaseline />
  <App />
</ThemeProvider>;
```

## The mapping (frontend-guidelines §2.4)

| `@stapel/tokens` role | L2 core token | MUI theme field |
| --- | --- | --- |
| `brand` | `accent` | `palette.primary.main` |
| `success` | `text-positive` | `palette.success.main` |
| `warning` | `text-warning` | `palette.warning.main` |
| `danger` | `text-negative` | `palette.error.main` |
| `info` | `text-info` | `palette.info.main` |
| `bgContainer` | `upperground-primary` | `palette.background.paper` |
| `bgLayout` | `background-primary` | `palette.background.default` |
| `textPrimary` | `text-primary` | `palette.text.primary` |
| radius `md` | — | `shape.borderRadius` |
| font-size `md` | — | `typography.fontSize` |

`@mui/material` (and its `@emotion/*` peers) are peer dependencies — the
consuming app brings its own copy.
