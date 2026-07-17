/**
 * `@stapel/tokens-antd` — the Ant Design leg of the token bridge (§68;
 * frontend-guidelines §2.4, owner decision §38 T3). It translates the ONE
 * neutral colour-role dictionary in `@stapel/tokens` (§68 — `surface`,
 * `brand`, `text-muted`, `success-bg`, …) straight into Ant Design's flat
 * `ConfigProvider` theme token: a role name IS the antd mapping's input, no
 * separate role→role indirection table (that table — `bridgeColorRoles` —
 * is gone; §68 Ф1 "алиас-слой совместимости не делать"). The mapping table
 * below (role → antd field) is the ONE place this decision lives; both this
 * file and `@stapel/tokens-mui` read the same `colors` object so they cannot
 * silently diverge on what a role visually means.
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
  bridgeFontSizeRole,
  bridgeRadiusRole,
  colors,
  cssVar,
  fontFamily,
  fontSize,
  radii,
} from "@stapel/tokens";
import type { CoreTokenName } from "@stapel/tokens";

/** Light or dark — the half of every role's `{light,dark}` pair. */
export type ThemeMode = "light" | "dark";

/**
 * Resolve a neutral colour role to a real hex for `mode` (owner audit
 * 2026-07-17, §54 theme-bridge root cause): a host that customizes its OWN
 * brand colour does so exactly as `@stapel/tokens`' README prescribes — copy
 * `theme.default.json` to `stapel.theme.json`, edit the `ramps`, run
 * `stapel-tokens` (`pnpm gen:tokens`) — which regenerates THAT HOST's
 * `tokens.css` custom properties (`--stapel-<role>`). It does NOT and CANNOT
 * change this published package's own compiled-in `colors` object — that
 * snapshot is frozen at `@stapel/tokens`' OWN publish time to `@stapel/tokens`'
 * OWN default theme, forever, regardless of what any host does. Feeding
 * `colors` straight into antd's `ConfigProvider` (the previous implementation)
 * is why every default skin rendered Stapel's stock brand colour instead of
 * the host's, no matter how correctly the host had customized its tokens: the
 * bridge was never wired to read them.
 *
 * The fix reads the LIVE `--stapel-<role>` custom property off
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
  // `getPropertyValue` wants the BARE custom-property name (`--stapel-x`);
  // `cssVar()` deliberately returns the `var(--stapel-x)` wrapper for
  // embedding in a CSS value, which `getPropertyValue` would never match —
  // stripped back off here rather than duplicating the `--stapel-` prefix.
  const propertyName = cssVar(name).slice("var(".length, -1);
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(propertyName)
    .trim();
  return value.length > 0 ? value : fallback;
}

/** Resolve a §68 colour role to its hex for `mode`, preferring the host's
 * live CSS custom property over the compiled-in default. */
function role(name: CoreTokenName, mode: ThemeMode): string {
  return readLiveCssVar(name, colors[name][mode]);
}

/** The flat antd token map (`ThemeConfig["token"]`), never undefined. */
export type AntdThemeToken = NonNullable<ThemeConfig["token"]>;

/**
 * `@stapel/tokens` §68 roles → antd `theme.token` (frontend-guidelines §2.4
 * table). Pure: same `mode` in, same object out; reads no globals besides the
 * live CSS custom properties documented on {@link readLiveCssVar}.
 */
export function toAntdTheme(mode: ThemeMode): AntdThemeToken {
  return {
    colorPrimary: role("brand", mode),
    colorLink: role("link", mode),
    colorLinkHover: role("link-hover", mode),
    colorSuccess: role("success", mode),
    colorWarning: role("warning", mode),
    colorError: role("error", mode),
    colorInfo: role("info", mode),
    colorText: role("text", mode),
    colorTextSecondary: role("text-muted", mode),
    colorTextTertiary: role("text-subtle", mode),
    colorBgLayout: role("surface", mode),
    colorBgContainer: role("surface-raised", mode),
    colorBgElevated: role("surface-overlay", mode),
    colorBorder: role("border", mode),
    colorBorderSecondary: role("border-subtle", mode),
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
