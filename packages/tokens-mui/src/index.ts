/**
 * `@stapel/tokens-mui` — the Material UI leg of the token bridge
 * (frontend-guidelines §2.4, owner decision §38 T3). It translates the ONE
 * neutral role table in `@stapel/tokens` (`bridgeColorRoles` + the radius/
 * font-size roles) into a MUI `Theme`. The L2 → role decision is NOT duplicated
 * here — this file only renames roles to MUI's nested `palette`/`shape`/
 * `typography` fields and picks the light/dark half, so it and
 * `@stapel/tokens-antd` cannot drift.
 *
 * ```tsx
 * import { toMuiTheme } from "@stapel/tokens-mui";
 * import { ThemeProvider, CssBaseline } from "@mui/material";
 *
 * <ThemeProvider theme={toMuiTheme(mode)}>
 *   <CssBaseline />
 *   <App />
 * </ThemeProvider>
 * ```
 */
import { createTheme } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import {
  bridgeColorRoles,
  bridgeFontSizeRole,
  bridgeRadiusRole,
  colors,
  fontFamily,
  fontSize,
  radii,
} from "@stapel/tokens";
import type { BridgeColorRole } from "@stapel/tokens";

/** Light or dark — the half of every L2 core token's `{light,dark}` pair. */
export type ThemeMode = "light" | "dark";

/** Resolve a neutral colour role to its hex for `mode` via the shared table. */
function role(name: BridgeColorRole, mode: ThemeMode): string {
  return colors[bridgeColorRoles[name]][mode];
}

/**
 * `@stapel/tokens` L2 → a MUI `Theme` (frontend-guidelines §2.4 table). Pure:
 * same `mode` in, an equivalent theme out; reads no globals.
 */
export function toMuiTheme(mode: ThemeMode): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { main: role("brand", mode), contrastText: role("textOnBrand", mode) },
      success: { main: role("success", mode) },
      warning: { main: role("warning", mode) },
      error: { main: role("danger", mode) },
      info: { main: role("info", mode) },
      text: {
        primary: role("textPrimary", mode),
        secondary: role("textSecondary", mode),
      },
      background: {
        default: role("bgLayout", mode),
        paper: role("bgContainer", mode),
      },
      divider: role("border", mode),
    },
    shape: {
      borderRadius: radii[bridgeRadiusRole],
    },
    typography: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize[bridgeFontSizeRole].fontSize,
    },
  });
}
