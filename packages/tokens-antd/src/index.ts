/**
 * `@stapel/tokens-antd` — the Ant Design leg of the token bridge
 * (frontend-guidelines §2.4, owner decision §38 T3). It translates the ONE
 * neutral role table in `@stapel/tokens` (`bridgeColorRoles` + the radius/
 * font-size roles) into Ant Design's flat `ConfigProvider` theme token. The
 * L2 → role decision is NOT duplicated here — this file only renames roles to
 * antd field names and picks the light/dark half, so it and `@stapel/tokens-mui`
 * cannot drift.
 *
 * ```tsx
 * import { toAntdTheme } from "@stapel/tokens-antd";
 * import { ConfigProvider } from "antd";
 *
 * <ConfigProvider theme={{ token: toAntdTheme(mode) }}>
 *   <App />
 * </ConfigProvider>
 * ```
 *
 * For a config that also flips antd's derived neutrals (borders/hovers/fills)
 * to the dark palette — not just the seed tokens — use `toAntdThemeConfig(mode)`
 * and spread it directly: `<ConfigProvider theme={toAntdThemeConfig(mode)}>`.
 */
import { theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";
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

/** The flat antd token map (`ThemeConfig["token"]`), never undefined. */
export type AntdThemeToken = NonNullable<ThemeConfig["token"]>;

/**
 * `@stapel/tokens` L2 → antd `theme.token` (frontend-guidelines §2.4 table).
 * Pure: same `mode` in, same object out; reads no globals.
 */
export function toAntdTheme(mode: ThemeMode): AntdThemeToken {
  return {
    colorPrimary: role("brand", mode),
    colorLink: role("link", mode),
    colorLinkHover: role("brandHover", mode),
    colorSuccess: role("success", mode),
    colorWarning: role("warning", mode),
    colorError: role("danger", mode),
    colorInfo: role("info", mode),
    colorText: role("textPrimary", mode),
    colorTextSecondary: role("textSecondary", mode),
    colorBgContainer: role("bgContainer", mode),
    colorBgLayout: role("bgLayout", mode),
    colorBgElevated: role("bgContainer", mode),
    colorBorder: role("border", mode),
    colorBorderSecondary: role("borderSecondary", mode),
    borderRadius: radii[bridgeRadiusRole],
    fontSize: fontSize[bridgeFontSizeRole].fontSize,
    fontFamily: fontFamily.sans,
  };
}

/**
 * The full antd `ThemeConfig`: {@link toAntdTheme}'s token plus the algorithm
 * that recomputes antd's derived neutrals for the mode (so dark is actually
 * dark, not just dark seeds over a light surface). Pass straight to
 * `<ConfigProvider theme={toAntdThemeConfig(mode)}>`.
 */
export function toAntdThemeConfig(mode: ThemeMode): ThemeConfig {
  return {
    algorithm:
      mode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: toAntdTheme(mode),
  };
}
