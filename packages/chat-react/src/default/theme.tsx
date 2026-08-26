/**
 * The default skin's INTERNAL theme wrapper — every `/default` surface of this
 * pair wraps itself in this, so the skin is readable no matter what the host
 * supplies.
 *
 * ── Why this file had to exist ─────────────────────────────────────────────
 *
 * It did not, and that was the defect. `src/default/**` here rendered antd
 * `Card`/`Typography`/`Tag` with NO theme root of its own, so the panels took
 * whatever `ConfigProvider` happened to be above them — and in a dark document
 * with none, antd's default algorithm is the LIGHT one. The result is the
 * failure tracker #26 named: a skin set with no internal provider inheriting
 * light-mode values inside a dark page, which is how six of this pair's own
 * stories were photographed as white text on a black field.
 *
 * A hand-rolled surface would not have fixed it. Painting a background with
 * `--stapel-*` custom properties leaves ANTD on the wrong side of the theme —
 * the Card, the Tag's semantic colours and every border still come from the
 * algorithm — so the fix has to be the shared `SkinTheme`, which is a
 * `ConfigProvider` and a painted root together.
 *
 * ── Why this is a delegation and not another copy ──────────────────────────
 *
 * Nine pairs once shipped a byte-identical `theme.tsx` that built its own
 * `ConfigProvider` from `toAntdThemeConfig(resolveThemeMode())`, with the mode
 * read ONCE — so a runtime theme toggle left every mounted skin on the old
 * side, nine times over. `@stapel/tokens-antd/skin`'s `SkinTheme` is that fix
 * once (a reactive `useThemeMode()`, a painted surface, the 44px phone control
 * height), and `stapel/no-local-skin-theme` exists to stop the tenth copy.
 *
 * So the SHAPE the other pairs ship is kept — one named wrapper, one root
 * element, one `data-*` hook a test can assert on — while the substance is
 * `SkinTheme`'s. `mode` stays optional with no hardcoded fallback: the
 * document declares the mode and the component does not get a vote
 * (`stapel/no-hardcoded-theme-mode`).
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { SkinSurface } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";

export interface ChatSkinThemeProps {
  /**
   * Light or dark. Defaults to the mode the host's document declares, read
   * REACTIVELY — pass explicitly only to pin a side (a demo showing both).
   */
  readonly mode?: ThemeMode;
  /**
   * See `SkinSurface`. Default `"bare"`: the shipped chat surfaces are antd
   * `Card`s, which paint themselves, so a second painted rectangle behind one
   * is a surface nobody asked for. A caller composing loose parts passes
   * `"raised"`.
   */
  readonly surface?: SkinSurface;
  /** Layout styles merged onto the themed root (colours come from the mode). */
  readonly style?: CSSProperties;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * `<ChatSkinTheme/>` — the self-theming wrapper of `@stapel/chat-react/default`.
 * Standalone use is supported (wrap any composition of the skin's parts once);
 * the shipped surfaces already wrap themselves, and nesting is free — a
 * `SkinTheme` inside a `SkinTheme` on the same mode reuses the outer config and
 * renders no second provider.
 *
 * Stamps `data-chat-skin-root` on its element beside the shared
 * `data-stapel-skin-*` attributes, so this pair's own tests can prove the skin
 * mounted its theme without reaching into the shared layer's markup.
 */
export function ChatSkinTheme(props: ChatSkinThemeProps): ReactElement {
  return (
    <div data-chat-skin-root="">
      <SkinTheme
        surface={props.surface ?? "bare"}
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
        {...(props.style !== undefined ? { style: props.style } : {})}
        {...(props.className !== undefined ? { className: props.className } : {})}
      >
        {props.children}
      </SkinTheme>
    </div>
  );
}
