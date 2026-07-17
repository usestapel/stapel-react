/**
 * `@stapel/tokens-mui` — the Material UI leg of the token bridge (§68;
 * frontend-guidelines §2.4, owner decision §38 T3). It translates the ONE
 * neutral colour-role dictionary in `@stapel/tokens` (§68 — `surface`,
 * `brand`, `text-muted`, `success-bg`, …) straight into a MUI `Theme`: a role
 * name IS the MUI mapping's input, no separate role→role indirection table
 * (that table — `bridgeColorRoles` — is gone; §68 Ф1 "алиас-слой
 * совместимости не делать"). This file and `@stapel/tokens-antd` both read
 * the same `colors` object, so they cannot silently diverge on what a role
 * visually means.
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
  bridgeFontSizeRole,
  bridgeRadiusRole,
  colors,
  fontFamily,
  fontSize,
  radii,
} from "@stapel/tokens";
import type { CoreTokenName } from "@stapel/tokens";

/** Light or dark — the half of every role's `{light,dark}` pair. */
export type ThemeMode = "light" | "dark";

/** Resolve a §68 colour role to its hex for `mode`. */
function role(name: CoreTokenName, mode: ThemeMode): string {
  return colors[name][mode];
}

/**
 * `@stapel/tokens` §68 roles → a MUI `Theme` (frontend-guidelines §2.4 table).
 * Pure: same `mode` in, an equivalent theme out; reads no globals.
 */
export function toMuiTheme(mode: ThemeMode): Theme {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: role("brand", mode),
        dark: role("brand-active", mode),
        contrastText: role("text-on-accent", mode),
      },
      success: {
        main: role("success", mode),
        light: role("success-bg", mode),
        contrastText: role("success-on", mode),
      },
      warning: {
        main: role("warning", mode),
        light: role("warning-bg", mode),
        contrastText: role("warning-on", mode),
      },
      error: {
        main: role("error", mode),
        light: role("error-bg", mode),
        contrastText: role("error-on", mode),
      },
      info: {
        main: role("info", mode),
        light: role("info-bg", mode),
        contrastText: role("info-on", mode),
      },
      text: {
        primary: role("text", mode),
        secondary: role("text-muted", mode),
        disabled: role("text-subtle", mode),
      },
      background: {
        default: role("surface", mode),
        paper: role("surface-raised", mode),
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
