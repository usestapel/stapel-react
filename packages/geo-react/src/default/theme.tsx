/**
 * The default skin's INTERNAL theme wrapper — every `/default` surface of this
 * pair wraps itself in this, so the skin is readable no matter what the host
 * supplies (tracker #26: a skin set with no internal provider once inherited a
 * theme bridge serving light-mode values inside a dark document — text on
 * background at 1.00:1).
 *
 * ── Why this is a delegation and not a tenth copy ──────────────────────────
 *
 * Nine pairs ship a byte-identical `src/default/theme.tsx` that builds its own
 * `ConfigProvider` from `toAntdThemeConfig(resolveThemeMode())`. Two defects
 * live in all nine (coordinator finding CF-1): the mode is read ONCE, so a
 * runtime theme toggle leaves mounted skins on the old side; and the fix has
 * to be applied nine times to land. `@stapel/tokens-antd/skin`'s `SkinTheme`
 * is that fix, once — a reactive `useThemeMode()`, a painted surface, and the
 * 44px phone control height — and `stapel/no-local-skin-theme` exists to stop
 * the tenth copy being written.
 *
 * So the SHAPE the other pairs ship is kept — one named wrapper, one root
 * element, one `data-*` hook a test can assert on — while the substance is
 * `SkinTheme`'s. `mode` stays optional and has no hardcoded fallback: the
 * document declares the mode and the component does not get a vote
 * (`stapel/no-hardcoded-theme-mode`).
 *
 * This is also what "override styles" means for this pair: a host retheming
 * through the §68 token JSON regenerates its `--stapel-*` custom properties
 * and every surface here follows with zero code — a far better deal than a
 * prop-per-colour API, and the reason the skin has none.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { SkinSurface } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";

export interface GeoSkinThemeProps {
  /**
   * Light or dark. Defaults to the mode the host's document declares, read
   * REACTIVELY — pass explicitly only to pin a side (a demo showing both).
   */
  readonly mode?: ThemeMode;
  /** See `SkinSurface`. Default `"raised"` — the picker is a panel dropped
   * onto a host page. `"bare"` inside a surface the host already painted. */
  readonly surface?: SkinSurface;
  /** Layout styles merged onto the themed root (colours come from the mode). */
  readonly style?: CSSProperties;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * `<GeoSkinTheme/>` — the self-theming wrapper of `@stapel/geo-react/default`.
 * Standalone use is supported (wrap any composition of the skin's parts once);
 * the shipped surfaces already wrap themselves and nested antd
 * `ConfigProvider`s merge, so composing them under one `GeoSkinTheme` stays
 * correct.
 *
 * Stamps `data-geo-skin-root` on its element beside the shared
 * `data-stapel-skin-*` attributes, so this pair's own tests can prove the skin
 * mounted its theme without reaching into the shared layer's markup.
 */
export function GeoSkinTheme(props: GeoSkinThemeProps): ReactElement {
  return (
    <div data-geo-skin-root="">
      <SkinTheme
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
        {...(props.surface !== undefined ? { surface: props.surface } : {})}
        {...(props.style !== undefined ? { style: props.style } : {})}
        {...(props.className !== undefined ? { className: props.className } : {})}
      >
        {props.children}
      </SkinTheme>
    </div>
  );
}
