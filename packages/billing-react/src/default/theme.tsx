/**
 * The default skin's INTERNAL theme provider — every `/default` surface wraps
 * itself in this, so the skin is readable no matter what the host supplies
 * (tracker #26: a skin set with no internal provider once inherited a theme
 * bridge serving light-mode values inside a dark document — text on
 * background at 1.00:1). The theme derives from `@stapel/tokens` via
 * `@stapel/tokens-antd`'s `toAntdThemeConfig(mode)`; `mode` defaults to what
 * the HOST's document declares (`resolveThemeMode()` — the `data-theme`
 * attribute `tokens.css` keys its dark block on), never to a hardcoded side.
 *
 * This is also what "override styles" means for this pair: a host retheming
 * through the §68 token JSON regenerates its `--stapel-*` custom properties
 * and the wallet follows with zero code — a far better deal than a
 * prop-per-colour API, and the reason the skin has none.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { ConfigProvider } from "antd";
import {
  resolveThemeMode,
  toAntdTheme,
  toAntdThemeConfig,
} from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";

export interface BillingSkinThemeProps {
  /**
   * Light or dark. Defaults to the mode the host's document declares
   * (`resolveThemeMode()`). Pass explicitly to pin a side.
   */
  readonly mode?: ThemeMode;
  /** Extra styles merged onto the themed root element (layout only — colors
   * come from the mode). */
  readonly style?: CSSProperties;
  readonly children: ReactNode;
}

/**
 * `<BillingSkinTheme/>` — the self-theming wrapper of
 * `@stapel/billing-react/default`. Standalone use is supported (wrap any
 * composition of the skin's parts once); the shipped surfaces
 * (`WalletPanel`, `BuyOptions`) each already wrap themselves, and nested antd
 * `ConfigProvider`s merge, so composing them under one `BillingSkinTheme`
 * stays correct.
 */
export function BillingSkinTheme(props: BillingSkinThemeProps): ReactElement {
  const mode = props.mode ?? resolveThemeMode();
  const theme = useMemo(() => toAntdThemeConfig(mode), [mode]);
  const token = useMemo(() => toAntdTheme(mode), [mode]);
  return (
    <ConfigProvider theme={theme}>
      <div
        data-billing-skin-root
        data-billing-skin-mode={mode}
        style={{
          color: token.colorText,
          backgroundColor: token.colorBgContainer,
          ...props.style,
        }}
      >
        {props.children}
      </div>
    </ConfigProvider>
  );
}
