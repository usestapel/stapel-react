/**
 * `SkinTheme` — the ONE self-theming wrapper every default skin renders
 * inside. Nine pairs carried a copy of it as `src/default/theme.tsx`
 * (`<X>SkinTheme`), identical modulo names; the rest inlined the same
 * `ConfigProvider theme={toAntdThemeConfig(props.mode ?? resolveThemeMode())}`
 * per component. All of them shared two defects this one component ends:
 *
 *  1. **The mode was read once.** `resolveThemeMode()` answered at render
 *     time and nothing subscribed, so a runtime toggle left mounted skins on
 *     the old side. The default here is {@link useThemeMode}, which is
 *     reactive. And it is never `"light"` — a hardcoded side is a wrong
 *     answer on every dark deployment (audit CF-1: `AuthPanel` rendered
 *     light inputs and invisible headings on a dark page).
 *  2. **Some skins painted no surface.** Typography then landed on whatever
 *     the host page had — a dark page under a light-themed skin is text at
 *     1:1. `SkinTheme` paints its own background and text colour by default,
 *     from the same token side the antd algorithm is on, so a skin is
 *     legible on any host page with zero wiring. `surface="bare"` is the
 *     opt-out for a skin that is inset in a surface the host already painted.
 *
 * It also fixes the phone control height once for the fleet: on a phone
 * (the same viewport rule as the bottom sheet — {@link useDialogSurface})
 * antd's `controlHeight` is raised to 44px, so every button, input and select
 * in every pair becomes a real touch target instead of the 29–32px the visual
 * pass measured. Tablet and desktop keep antd's 32/40.
 *
 * Nested `ConfigProvider`s merge, so a screen composed of several skinned
 * parts under one `SkinTheme` stays correct, and a pair whose parts each wrap
 * themselves costs nothing extra — see {@link skinThemeConfig} and
 * {@link AppliedThemeContext} for the two things that had to be true before
 * that last clause stopped being a lie.
 */
import { createContext, useContext, useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { ConfigProvider } from "antd";
import type { ThemeConfig } from "antd";
import { controls, spacing } from "@stapel/tokens";
import {
  hostBrandFingerprint,
  hostBrandScope,
  livePhoneControlHeight,
  resolveThemeMode,
  toAntdThemeConfig,
} from "../index.js";
import type { ThemeMode } from "../index.js";
import { useDialogSurface } from "./dialogSurface.js";
import { useHostBrand, useThemeMode } from "./themeMode.js";

/**
 * The minimum touch target on a phone (WCAG 2.5.8 / platform HIGs: 44 CSS
 * px). Applied as antd's `controlHeight`, which every control's box derives
 * from. The value is the token dictionary's own `controls["height-phone"]`
 * (`--stapel-control-height-phone`); at build time a host's LIVE value wins —
 * see {@link livePhoneControlHeight} — and this constant is the compiled-in
 * default the fleet ships with.
 */
export const PHONE_CONTROL_HEIGHT: number = controls["height-phone"];

/**
 * The touch floor beyond `controlHeight`.
 *
 * `controlHeight` reaches buttons, inputs, selects, pagination and the
 * default `Segmented` — and nothing else. The visual pass measured what it
 * misses: `Rate` stars at 22px (reviews, the package's one interaction),
 * `size="small"` controls at 24–33px, checkbox and radio rows at 22px,
 * clickable tags at 22px, list rows at whatever their text was. Each of
 * those is an antd token the phone theme can set, so they are set HERE, once:
 *
 *  - `controlHeightSM`: antd derives it as `controlHeight × 0.75` (33px);
 *    on a phone there is no such thing as a small touch target.
 *  - `Rate.starSize` + `Rate.marginXS`: a 32px glyph on a 44px pitch.
 *  - `Radio.radioSize`, `Checkbox.controlInteractiveSize`: a 24px box the
 *    thumb can find; the 44px row comes from {@link phoneTouchFloorCss}.
 *
 * Exported so a host theming outside `SkinTheme` (a bespoke `ConfigProvider`)
 * can apply the same floor.
 */
/** The floor's token/components pair for a given control height — the shape
 * {@link PHONE_TOUCH_FLOOR} freezes at the default 44, built here so a host's
 * live `--stapel-control-height-phone` produces the same floor at ITS height
 * (the rate star keeps its glyph and gives the pitch the rest). */
function phoneTouchFloorFor(height: number): {
  readonly token: NonNullable<ThemeConfig["token"]>;
  readonly components: NonNullable<ThemeConfig["components"]>;
} {
  return {
    token: {
      controlHeight: height,
      controlHeightSM: height,
    },
    components: {
      Rate: { starSize: spacing["6"], marginXS: height - spacing["6"] },
      Radio: { radioSize: spacing["5"] },
      Checkbox: { controlInteractiveSize: spacing["5"] },
    },
  };
}

export const PHONE_TOUCH_FLOOR: {
  readonly token: NonNullable<ThemeConfig["token"]>;
  readonly components: NonNullable<ThemeConfig["components"]>;
} = phoneTouchFloorFor(PHONE_CONTROL_HEIGHT);

/**
 * The rows and glyph boxes no antd token reaches, as a stylesheet scoped
 * under a phone skin root: the hit area of a rate star, a checkbox/radio row,
 * a clickable tag, a list/menu row. Selector prefixes are antd's default
 * class prefix, resolved at render time from `ConfigProvider`, so a host with
 * a custom `prefixCls` gets the same rules.
 *
 * Rendered by `SkinTheme` as a React 19 hoistable `<style href precedence>`:
 * one element in `<head>` for the whole document however many skins mount.
 */
export function phoneTouchFloorCss(
  prefix: string,
  height: number = PHONE_CONTROL_HEIGHT
): string {
  const h = `${String(height)}px`;
  const root = `[data-stapel-skin-root][data-stapel-skin-phone]`;
  return [
    `${root} .${prefix}-rate .${prefix}-rate-star{display:inline-flex;align-items:center;min-height:${h}}`,
    `${root} .${prefix}-checkbox-wrapper,${root} .${prefix}-radio-wrapper{min-height:${h};align-items:center}`,
    `${root} .${prefix}-tag-checkable,${root} .${prefix}-tag[role="button"],${root} a.${prefix}-tag,${root} button.${prefix}-tag{display:inline-flex;align-items:center;min-height:${h}}`,
    `${root} .${prefix}-list-item,${root} .${prefix}-menu-item,${root} .${prefix}-dropdown-menu-item{min-height:${h}}`,
    `${root} .${prefix}-segmented{max-width:100%;overflow-x:auto}`,
  ].join("\n");
}

/** The `href` the hoisted phone stylesheet is deduplicated by. */
export const PHONE_TOUCH_FLOOR_STYLE_HREF: string = "stapel-skin-phone-touch-floor";

/**
 * What the wrapper paints under its children.
 *
 * - `"raised"` (default): a container — `colorBgContainer` + `colorText`.
 *   Right for a panel, a card, a page section dropped onto a host page.
 * - `"base"`: the page/layout background — `colorBgLayout` + `colorText`.
 *   Right for a full-page screen whose children are themselves raised.
 * - `"bare"`: paints nothing; the host already painted the surface the skin
 *   sits in (a modal body, a host card). The theme still applies.
 */
export type SkinSurface = "raised" | "base" | "bare";

export interface SkinThemeProps {
  /**
   * Light or dark. Defaults to the document's LIVE mode
   * ({@link useThemeMode}) — pass explicitly only to pin a side (a demo
   * that shows both).
   */
  readonly mode?: ThemeMode;
  /** See {@link SkinSurface}. Default `"raised"`. */
  readonly surface?: SkinSurface;
  /** Layout styles merged onto the themed root (colours come from the mode). */
  readonly style?: CSSProperties;
  readonly className?: string;
  readonly children: ReactNode;
  readonly "data-testid"?: string;
}

/**
 * The theme configs already built, keyed by everything they depend on.
 *
 * A `useMemo` inside the component memoized per INSTANCE, which is the wrong
 * boundary: a screen composed of ten skinned parts built ten configs that
 * were deep-equal and referentially distinct, and a list whose rows each wrap
 * themselves built one per row. Every distinct config object is a fresh
 * `ConfigProvider` value for antd — a benchmark of 200 self-wrapping rows
 * measured ~1.9s of mount (`test/skinThemePerf.test.tsx`), which is what
 * `forms-react` was paying when its full-skin test went 1.8s → >30s.
 *
 * One object per (mode, phone, live-scope) triple instead, shared by every
 * `SkinTheme` in the process. Identity is now the thing
 * {@link AppliedThemeContext} can compare, so a nested skin can tell that the
 * exact theme it is about to apply is already applied and render no provider
 * at all.
 */
const themeConfigCache = new Map<string, ThemeConfig>();

/**
 * The config `SkinTheme` applies, built at most once per distinct answer.
 *
 * The key carries everything the build reads, so a cache hit is provably the
 * same object the build would have produced:
 *
 *  - the requested `mode` and whether this is a phone (the 44px control
 *    height is part of the token);
 *  - the DOCUMENT's mode, because `toAntdThemeConfig` reads the host's live
 *    custom properties only when the two agree (see `readLiveCssVar`) — a
 *    `data-theme` flip changes the key and the next build re-reads;
 *  - {@link hostBrandScope} — the document's `data-brand`, the OTHER
 *    attribute `tokens.css` keys on (`:root[data-brand="…"]`). The
 *    fingerprint below usually moves with it, but not always: two scoped
 *    ramps may share a `--stapel-brand` and differ in every other role, and
 *    a `getComputedStyle` taken before the scoped sheet is applied reports
 *    the unscoped value for both. The identity of the scope is therefore its
 *    own key segment;
 *  - {@link hostBrandFingerprint} — the host's live brand value itself. A host
 *    that customized its tokens, or whose `tokens.css` arrived after the
 *    first render, keys a different entry rather than being served the
 *    compiled-in default forever. That is the freshness the per-instance
 *    `useMemo` used to give (a NEW mount re-read) at the price of a rebuild
 *    per mount; here it costs one `getComputedStyle` and a `Map` lookup.
 *
 * A key that changes only rebuilds when something RENDERS, so the component
 * subscribes to both attributes ({@link useThemeMode}, {@link useHostBrand})
 * — a cache that cannot be consulted is not a cache that is fresh.
 *
 * Only the OUTERMOST `SkinTheme` of a tree reaches this function at all —
 * see {@link AppliedThemeContext}.
 */
function skinThemeConfig(mode: ThemeMode, phone: boolean): ThemeConfig {
  // The phone floor's height is a LIVE read (`--stapel-control-height-phone`,
  // default 44) — part of the key, so two answers cannot share an entry.
  const phoneHeight = phone ? livePhoneControlHeight(mode) : 0;
  const key = [
    mode,
    phone ? `phone@${String(phoneHeight)}` : "wide",
    resolveThemeMode(),
    hostBrandScope(),
    hostBrandFingerprint(mode),
  ].join("|");
  const hit = themeConfigCache.get(key);
  if (hit !== undefined) return hit;
  const base = toAntdThemeConfig(mode);
  const floor = phone ? phoneTouchFloorFor(phoneHeight) : null;
  const config: ThemeConfig =
    floor !== null
      ? {
          ...base,
          token: { ...base.token, ...floor.token },
          components: { ...base.components, ...floor.components },
        }
      : base;
  themeConfigCache.set(key, config);
  return config;
}

/** What the nearest enclosing `SkinTheme` handed antd, and what it built it
 * from — so a nested skin can tell whether its own answer would be the same
 * one without building it. */
interface AppliedTheme {
  readonly mode: ThemeMode;
  readonly phone: boolean;
  readonly config: ThemeConfig;
}

/**
 * The theme the nearest enclosing `SkinTheme` is already applying.
 *
 * A skin part that wraps itself AND is wrapped by a screen was rendering a
 * second `ConfigProvider` with a deep-equal theme — antd merges it, so the
 * result was right and the work was pure waste. It is not small waste: a
 * benchmark of 200 self-wrapping rows measured ~1.9s of mount for the
 * providers alone (`test/skinThemePerf.test.tsx`), which is the shape
 * `forms-react`'s full-skin test was paying when it went 1.8s → >30s. The
 * doctrine actively encourages that shape ("parts may wrap themselves AND be
 * wrapped"), so the substrate has to make it free rather than warn against it.
 *
 * When the enclosing skin was built for the same `mode` and the same phone
 * answer, the inner one reuses that exact config object, renders its painted
 * root and NO provider — and never touches the cache or the DOM to decide.
 * A different `mode` (a demo pinning dark inside a light screen) does not
 * match and gets its own provider, as it must.
 *
 * Only a `SkinTheme` publishes here, and it publishes exactly what it handed
 * antd, so the context cannot claim a theme antd is not on. A foreign
 * `ConfigProvider` deliberately interposed between two `SkinTheme`s is the
 * one shape this does not re-assert over; `src/default/**` has no such
 * providers by doctrine, and a skin that means to override declares it on its
 * own `mode`.
 */
const AppliedThemeContext = createContext<AppliedTheme | null>(null);

/**
 * The self-theming root of a default skin. Stamps `data-stapel-skin-root`,
 * `data-stapel-skin-mode="light|dark"` and `data-stapel-skin-surface` on its
 * element so a package's test can prove which side it rendered on.
 */
export function SkinTheme(props: SkinThemeProps): ReactElement {
  const liveMode = useThemeMode();
  // Subscribed, not read: `data-brand` selects the same live `--stapel-*`
  // values `data-theme` does, and a host that resolves its brand at runtime
  // stamps it in an effect — after the render that built the theme. Without
  // this, that theme is never rebuilt and every antd control keeps the
  // colours of the brand the page booted with (owner report 2026-08-30).
  useHostBrand();
  const applied = useContext(AppliedThemeContext);
  // A nested bare `SkinTheme` inherits the PIN of the one above it, not the
  // document. `props.mode ?? liveMode` re-read the document inside a pinned
  // parent, so a demo pinning `mode="dark"` around a self-wrapping surface
  // rendered that surface light (search: 16 of 29 dark shots; reviews' sign-in
  // door invisible; geo's `--dark` guard guarding nothing). The pin is a
  // decision the parent already took; the child's job is to apply it.
  const mode = props.mode ?? applied?.mode ?? liveMode;
  const surface = props.surface ?? "raised";
  const dialogSurface = useDialogSurface();
  const phone = dialogSurface === "sheet";
  const { getPrefixCls } = useContext(ConfigProvider.ConfigContext);
  const inherited =
    applied !== null && applied.mode === mode && applied.phone === phone
      ? applied
      : null;
  const theme = inherited?.config ?? skinThemeConfig(mode, phone);
  const publish = useMemo<AppliedTheme>(
    () => ({ mode, phone, config: theme }),
    [mode, phone, theme]
  );
  const token = theme.token ?? {};

  const paint: CSSProperties =
    surface === "bare"
      ? {}
      : {
          color: token.colorText,
          backgroundColor:
            surface === "base" ? token.colorBgLayout : token.colorBgContainer,
        };

  const root = (
    <div
      data-stapel-skin-root=""
      data-stapel-skin-mode={mode}
      data-stapel-skin-surface={surface}
      {...(phone ? { "data-stapel-skin-phone": "" } : {})}
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
      style={{ colorScheme: mode, ...paint, ...props.style }}
    >
      {props.children}
    </div>
  );

  if (inherited !== null) return root;

  return (
    <AppliedThemeContext.Provider value={publish}>
      {phone && (
        <style href={PHONE_TOUCH_FLOOR_STYLE_HREF} precedence="default">
          {phoneTouchFloorCss(getPrefixCls(), livePhoneControlHeight(mode))}
        </style>
      )}
      <ConfigProvider theme={theme}>{root}</ConfigProvider>
    </AppliedThemeContext.Provider>
  );
}
