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
 * themselves costs nothing extra.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { ConfigProvider } from "antd";
import type { ThemeConfig } from "antd";
import { toAntdThemeConfig } from "../index.js";
import type { ThemeMode } from "../index.js";
import { useDialogSurface } from "./dialog.js";
import { useThemeMode } from "./themeMode.js";

/**
 * The minimum touch target on a phone (WCAG 2.5.8 / platform HIGs: 44 CSS
 * px). Applied as antd's `controlHeight`, which every control's box derives
 * from.
 */
export const PHONE_CONTROL_HEIGHT: number = 44;

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
 * The self-theming root of a default skin. Stamps `data-stapel-skin-root`,
 * `data-stapel-skin-mode="light|dark"` and `data-stapel-skin-surface` on its
 * element so a package's test can prove which side it rendered on.
 */
export function SkinTheme(props: SkinThemeProps): ReactElement {
  const liveMode = useThemeMode();
  const mode = props.mode ?? liveMode;
  const surface = props.surface ?? "raised";
  const dialogSurface = useDialogSurface();
  const phone = dialogSurface === "sheet";
  const theme = useMemo<ThemeConfig>(() => {
    const base = toAntdThemeConfig(mode);
    return phone
      ? { ...base, token: { ...base.token, controlHeight: PHONE_CONTROL_HEIGHT } }
      : base;
  }, [mode, phone]);
  const token = theme.token ?? {};

  const paint: CSSProperties =
    surface === "bare"
      ? {}
      : {
          color: token.colorText,
          backgroundColor:
            surface === "base" ? token.colorBgLayout : token.colorBgContainer,
        };

  return (
    <ConfigProvider theme={theme}>
      <div
        data-stapel-skin-root=""
        data-stapel-skin-mode={mode}
        data-stapel-skin-surface={surface}
        {...(props.className !== undefined ? { className: props.className } : {})}
        {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
        style={{ colorScheme: mode, ...paint, ...props.style }}
      >
        {props.children}
      </div>
    </ConfigProvider>
  );
}
