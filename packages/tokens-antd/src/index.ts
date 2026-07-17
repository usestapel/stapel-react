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
  cssVar,
  fontFamily,
  fontSize,
  radii,
} from "@stapel/tokens";
import type { BridgeColorRole, CoreTokenName } from "@stapel/tokens";

/** Light or dark — the half of every L2 core token's `{light,dark}` pair. */
export type ThemeMode = "light" | "dark";

/**
 * Resolve a neutral colour role to a real hex for `mode` (owner audit
 * 2026-07-17, §54 theme-bridge root cause): a host that customizes its OWN
 * brand colour does so exactly as `@stapel/tokens`' README prescribes — copy
 * `theme.default.json` to `stapel.theme.json`, edit the `ramps`, run
 * `pnpm gen:tokens` — which regenerates THAT HOST's `tokens.css` custom
 * properties (`--stapel-color-<role>`). It does NOT and CANNOT change this
 * published package's own compiled-in `colors` object — that snapshot is
 * frozen at `@stapel/tokens`' OWN publish time to `@stapel/tokens`' OWN
 * default theme, forever, regardless of what any host does. Feeding `colors`
 * straight into antd's `ConfigProvider` (the previous implementation) is why
 * every default skin rendered Stapel's stock brand colour instead of the
 * host's, no matter how correctly the host had customized its tokens: the
 * bridge was never wired to read them.
 *
 * The fix reads the LIVE `--stapel-color-<role>` custom property off
 * `document.documentElement` at call time — the exact value the host's own
 * (re)generated `tokens.css` sets, already resolved through whichever
 * `data-theme` is active — and falls back to the static default only where
 * there is no DOM to read (SSR, tests, a host that never loaded
 * `tokens.css`). This is the one change that makes "the skin takes its theme
 * from the bridge automatically" (the doc comment on every default skin)
 * literally true for a host's brand colour, not just its light/dark mode.
 */
function readLiveCssVar(name: CoreTokenName, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  // `getPropertyValue` wants the BARE custom-property name (`--stapel-color-x`);
  // `cssVar()` deliberately returns the `var(--stapel-color-x)` wrapper for
  // embedding in a CSS value, which `getPropertyValue` would never match —
  // stripped back off here rather than duplicating the `--stapel-` prefix.
  const propertyName = cssVar(`color-${name}`).slice("var(".length, -1);
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(propertyName)
    .trim();
  return value.length > 0 ? value : fallback;
}

/** Resolve a neutral colour role to its hex for `mode` via the shared table,
 * preferring the host's live CSS custom property over the compiled-in default. */
function role(name: BridgeColorRole, mode: ThemeMode): string {
  const token = bridgeColorRoles[name];
  return readLiveCssVar(token, colors[token][mode]);
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
