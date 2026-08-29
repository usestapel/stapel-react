/**
 * `@stapel/tokens-antd` — the Ant Design leg of the token bridge (§68;
 * frontend-guidelines §2.4, owner decision §38 T3). It translates the ONE
 * neutral colour-role dictionary in `@stapel/tokens` (§68 — `surface`,
 * `brand`, `text-muted`, `success-bg`, …) straight into Ant Design's flat
 * `ConfigProvider` theme token: a role name IS the antd mapping's input, no
 * separate role→role indirection table (that table — `bridgeColorRoles` —
 * is gone; §68 Phase 1 decision: no compatibility alias layer). The mapping table
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
 *
 * A default skin does neither by hand: it wraps itself in `SkinTheme` from
 * the `/skin` subpath, which applies this config for the document's LIVE mode
 * (`useThemeMode()`, reactive) and paints its own surface.
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
 * The attribute `@stapel/tokens`' generated `tokens.css` keys its dark block
 * on (`:root` = light, `[data-theme="dark"]` = dark — see that package's
 * `gen/lib.mjs#renderCss`). It is the ONE switch a host flips to change
 * theme, so it is also the ONE signal this bridge reads.
 */
export const THEME_ATTRIBUTE: string = "data-theme";

/**
 * The attribute `@stapel/tokens`' generated `tokens.css` keys a SCOPED token
 * set on (`:root[data-brand="<brand>"]` / `:root[data-brand="<brand>"][data-theme="dark"]`
 * — see that package's `gen/lib.mjs#scopeSelectors`). It is the second of the
 * two switches a host flips, and the two are peers: one picks the side, the
 * other picks the ramp, and both change exactly the same live
 * `--stapel-<role>` values this bridge reads.
 *
 * A multibrand host writes it at runtime once it knows which site it is
 * serving (`@stapel/core`'s `SiteProvider`), which is AFTER first paint — so
 * anything that caches a built theme has to treat it as live, not as a
 * boot-time constant.
 */
export const BRAND_ATTRIBUTE: string = "data-brand";

/**
 * The host's current `<html data-brand>` — the scoped token set in force, or
 * `""` where the host declares none (the unscoped `:root` ramp) or there is
 * no DOM.
 *
 * A cheap, allocation-free companion to {@link hostBrandFingerprint} for a
 * caller that caches a built theme: the fingerprint reports the brand's
 * VALUE (and so also catches a late stylesheet or an edited theme file),
 * this reports the brand's IDENTITY. Both belong in a cache key, because
 * neither implies the other — two scoped ramps may share a `--stapel-brand`
 * and differ in every other role, and a `getComputedStyle` that cannot yet
 * see the scoped sheet reports the same string for both.
 */
export function hostBrandScope(): string {
  if (typeof document === "undefined") return "";
  return document.documentElement.getAttribute(BRAND_ATTRIBUTE) ?? "";
}

/**
 * Which mode the host's document is ACTUALLY in, read from the same
 * `data-theme` attribute `tokens.css` keys its dark block on.
 *
 * This exists because "default `mode` to `light`" is not a neutral default —
 * it is a wrong answer on every dark deployment, and it produced an
 * unreadable error Alert on a live sandbox (owner report 2026-08-09):
 * `toAntdThemeConfig("light")` under `<html data-theme="dark">` emitted
 * `--ant-color-error-bg: #fff2f0` (near-white, derived by antd's LIGHT
 * algorithm) together with `--ant-color-text: #f4f5f7` (near-white, read
 * LIVE off the host's dark `tokens.css`) — a 1.03:1 contrast ratio. A
 * default skin calls this instead of hardcoding a side, so it self-themes
 * with zero host wiring.
 *
 * Deliberately does NOT consult `prefers-color-scheme`: `tokens.css` ships
 * no `@media (prefers-color-scheme)` block, so an OS-dark/host-light
 * document would serve LIGHT custom properties while this returned `"dark"`
 * — re-creating the exact mismatch above from the other side. The attribute
 * is the only signal that cannot disagree with the stylesheet.
 *
 * Reads `document.documentElement` — the same element {@link readLiveCssVar}
 * reads its custom properties from, so the mode and the values can never
 * come from different scopes. `"light"` where there is no DOM (SSR, node
 * tests), matching `tokens.css`' `:root` default.
 */
export function resolveThemeMode(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute(THEME_ATTRIBUTE) === "dark"
    ? "dark"
    : "light";
}

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
 *
 * ONLY when the document is in the mode being asked for, though (owner
 * report 2026-08-09). The live custom properties resolve through whichever
 * `data-theme` is active — they are the DOCUMENT's mode, not the caller's —
 * so serving them for a different `mode` silently welds half a light theme
 * to half a dark one. That is not hypothetical: `toAntdThemeConfig("light")`
 * under `<html data-theme="dark">` handed antd a LIGHT algorithm (which
 * derives `colorErrorBg` → `#fff2f0`, near-white) plus a LIVE DARK
 * `colorText` (`#f4f5f7`, near-white) and rendered an error Alert at 1.03:1
 * contrast — literally unreadable. On a mismatch the compiled-in default for
 * the REQUESTED mode is used instead: the host's brand customization is lost
 * for that call, which is a visual regression; a mode-blended theme is a
 * legibility one. The way to keep both is to ask for the mode the document
 * is in — see {@link resolveThemeMode}, which every default skin now
 * defaults to.
 */
function readLiveCssVar(
  live: CSSStyleDeclaration | null,
  name: CoreTokenName,
  fallback: string
): string {
  if (live === null) return fallback;
  // `getPropertyValue` wants the BARE custom-property name (`--stapel-x`);
  // `cssVar()` deliberately returns the `var(--stapel-x)` wrapper for
  // embedding in a CSS value, which `getPropertyValue` would never match —
  // stripped back off here rather than duplicating the `--stapel-` prefix.
  const propertyName = cssVar(name).slice("var(".length, -1);
  const value = live.getPropertyValue(propertyName).trim();
  return value.length > 0 ? value : fallback;
}

/**
 * The host's live custom-property scope for `mode`, or `null` where the
 * compiled-in defaults are the only honest answer (no DOM; or the document
 * is in the OTHER mode, where reading live values would blend two themes —
 * see {@link readLiveCssVar}).
 *
 * ONE `getComputedStyle` call per theme build. It used to be one per role —
 * fifteen style resolutions to build a single token map, paid again by every
 * `SkinTheme` that mounted. `getComputedStyle` returns a LIVE declaration, so
 * one handle answers all fifteen roles and stays correct if the host restyles
 * between reads.
 */
function liveScope(mode: ThemeMode): CSSStyleDeclaration | null {
  if (typeof document === "undefined") return null;
  if (resolveThemeMode() !== mode) return null;
  return getComputedStyle(document.documentElement);
}

/**
 * The host's LIVE `--stapel-brand`, or `""` where {@link toAntdTheme} would
 * not read live values at all (no DOM, or the document is in the other mode)
 * or where the host's generated `tokens.css` has not reached the document.
 *
 * A one-property probe of the same scope the full build reads, for a caller
 * that CACHES a built theme and needs a cheap key that changes whenever the
 * build would. `brand` is the role a host actually customizes (the whole
 * point of `readLiveCssVar`), and it moves with the rest of the ramp: a
 * stylesheet arriving late, a host swapping its theme file, or a
 * customization landing after first paint all change this string, so a cache
 * keyed on it cannot serve a stale brand.
 */
export function hostBrandFingerprint(mode: ThemeMode = resolveThemeMode()): string {
  const live = liveScope(mode);
  if (live === null) return "";
  const propertyName = cssVar("brand").slice("var(".length, -1);
  return live.getPropertyValue(propertyName).trim();
}

/** Resolve a §68 colour role to its hex for `mode`, preferring the host's
 * live CSS custom property over the compiled-in default. */
function role(
  live: CSSStyleDeclaration | null,
  name: CoreTokenName,
  mode: ThemeMode
): string {
  return readLiveCssVar(live, name, colors[name][mode]);
}

/** The flat antd token map (`ThemeConfig["token"]`), never undefined. */
export type AntdThemeToken = NonNullable<ThemeConfig["token"]>;

/**
 * `@stapel/tokens` §68 roles → antd `theme.token` (frontend-guidelines §2.4
 * table). Pure: same `mode` in, same object out; reads no globals besides the
 * live CSS custom properties documented on {@link readLiveCssVar}.
 *
 * `mode` defaults to {@link resolveThemeMode} — the mode the host's document
 * declares — so `toAntdTheme()` follows the host's theme switch instead of
 * pinning a side.
 */
export function toAntdTheme(mode: ThemeMode = resolveThemeMode()): AntdThemeToken {
  const live = liveScope(mode);
  return {
    colorPrimary: role(live, "brand", mode),
    colorLink: role(live, "link", mode),
    colorLinkHover: role(live, "link-hover", mode),
    colorSuccess: role(live, "success", mode),
    colorWarning: role(live, "warning", mode),
    colorError: role(live, "error", mode),
    colorInfo: role(live, "info", mode),
    colorText: role(live, "text", mode),
    colorTextSecondary: role(live, "text-muted", mode),
    colorTextTertiary: role(live, "text-subtle", mode),
    colorBgLayout: role(live, "surface", mode),
    colorBgContainer: role(live, "surface-raised", mode),
    colorBgElevated: role(live, "surface-overlay", mode),
    colorBorder: role(live, "border", mode),
    colorBorderSecondary: role(live, "border-subtle", mode),
    // The status SURFACES (alert fills, tag fills, their borders) come from
    // the `*-bg` / `*-border` roles, not from antd's palette derivation of the
    // status seed. Derived, the light warning fill was `#d9d5c3` (khaki) and
    // the success fill `#afbab3` (sage) — the token JSON says `#fdf6e7` and
    // `#eaf7f0` (visual pass VC-B4 / N14, ~20 screens). Hover is pinned to the
    // same role so a closable alert does not flash khaki on hover.
    colorSuccessBg: role(live, "success-bg", mode),
    colorSuccessBgHover: role(live, "success-bg", mode),
    colorSuccessBorder: role(live, "success-border", mode),
    colorSuccessBorderHover: role(live, "success-border", mode),
    colorWarningBg: role(live, "warning-bg", mode),
    colorWarningBgHover: role(live, "warning-bg", mode),
    colorWarningBorder: role(live, "warning-border", mode),
    colorWarningBorderHover: role(live, "warning-border", mode),
    colorErrorBg: role(live, "error-bg", mode),
    colorErrorBgHover: role(live, "error-bg", mode),
    colorErrorBorder: role(live, "error-border", mode),
    colorErrorBorderHover: role(live, "error-border", mode),
    colorInfoBg: role(live, "info-bg", mode),
    colorInfoBgHover: role(live, "info-bg", mode),
    colorInfoBorder: role(live, "info-border", mode),
    colorInfoBorderHover: role(live, "info-border", mode),
    colorPrimaryBg: role(live, "brand-subtle", mode),
    // Hover/active from the brand ramp's own roles: antd's derived light
    // hover (`#6e80e6`) put a white label at 3.6:1 mid-press.
    colorPrimaryHover: role(live, "brand-hover", mode),
    colorPrimaryActive: role(live, "brand-active", mode),
    // The label ON a brand/status fill. antd's default is white in both
    // modes; the dark brand fill is a light lavender, and white on it is
    // ~2.6:1 (visual pass VC-B2, every dark primary in the fleet). The
    // `text-on-accent` role is the token JSON's answer — near-black in dark.
    colorTextLightSolid: role(live, "text-on-accent", mode),
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
 *
 * `mode` defaults to {@link resolveThemeMode}, so `toAntdThemeConfig()` with
 * no argument reads the host's `data-theme` — the algorithm and the token
 * values then provably come from the same side (see {@link readLiveCssVar}
 * for what happens when they don't).
 */
export function toAntdThemeConfig(mode: ThemeMode = resolveThemeMode()): ThemeConfig {
  return {
    algorithm:
      mode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: toAntdTheme(mode),
    components: {
      // A tooltip's fill is antd's dark spotlight in BOTH modes, so its label
      // must stay light even where `colorTextLightSolid` became near-black
      // for the lavender dark brand fill. Skins ship no tooltips (house
      // rule); this keeps antd's own (a table sorter, a slider) legible.
      Tooltip: { colorTextLightSolid: colors.text.dark },
    },
  };
}

/**
 * ── The design-system scale, re-exported ────────────────────────────────────
 *
 * ANSWERS the fleet question filed five times in wave B (`REQUESTS-`
 * categories §4, reviews R3, billing §7, listings §5, search): `src/default/**`
 * imports `spacing` / `fontSize` from `@stapel/tokens` in twenty packages —
 * `stapel/no-raw-dimensions`' autofix writes exactly that import, 274 times
 * this wave — and not one pair DECLARES `@stapel/tokens`. It resolves today
 * only because this package has a hard `dependencies` entry on it and the
 * consumer's tree happens to hoist. A published tarball with a bare import of
 * an undeclared package is one hoisting change from breaking every skin at
 * once.
 *
 * The answer is NOT to add a twenty-first declaration. A default skin already
 * declares exactly one design-system dependency — this one — and that is the
 * property worth keeping: `@stapel/tokens-antd` IS the antd leg of the token
 * bridge, so the scale a skin lays out with belongs on the same edge as the
 * colours it paints with. Re-exported here, a pair's dependency list stays
 * `@stapel/core` + `@stapel/tokens-antd` + `antd`, and the version of
 * `@stapel/tokens` in play is the one this package was built against — which
 * is the version its own colour mapping already assumes. A per-pair peer range
 * could disagree with it; a re-export cannot.
 *
 * The two alternatives were weighed and rejected:
 *
 *  - **`dependencies` in every pair** — twenty declarations of a package whose
 *    only job is to be the same everywhere, and twenty chances for a duplicate
 *    copy at a different version, which is how a fleet gets two spacing scales.
 *  - **an optional peer in every pair** — honest about the shape, but it makes
 *    every consumer resolve a floor by hand for constants they never chose.
 *
 * A host or a non-antd skin that wants the tokens directly still depends on
 * `@stapel/tokens` and imports from it; nothing here forbids that. This is
 * for the skins, which already depend on this package by construction.
 *
 * Only what `src/default/**` actually uses is re-exported — a census of the
 * fleet's imports: `spacing` (130 sites), `fontSize` (34), `radii` (14),
 * `cssVar` (11), `breakpoints` (5), `breakpointForWidth` (1). `colors` is
 * deliberately absent: a skin that reaches for a hex has left the bridge, and
 * `toAntdTheme` is the supported way to get one. `elevation`, `typography`
 * and the raw ramps stay on `@stapel/tokens` for the same reason.
 *
 * Follow-up NOT in this package's gift: `stapel/no-raw-dimensions`' autofix
 * still writes `from "@stapel/tokens"`. It should write
 * `from "@stapel/tokens-antd"` under `src/default/**` — filed for
 * `@stapel/eslint-plugin`'s owner in SHARED-API §9.
 */
export {
  spacing,
  radii,
  fontSize,
  fontWeight,
  breakpoints,
  breakpointForWidth,
  mediaQuery,
  cssVar,
} from "@stapel/tokens";
export type {
  SpacingStep,
  RadiusName,
  FontSizeName,
  FontWeightName,
  Breakpoint,
  CoreTokenName,
  StapelVar,
} from "@stapel/tokens";
