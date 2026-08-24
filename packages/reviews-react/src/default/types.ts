/**
 * Small shared types for the `/default` skin — kept in one place so every
 * surface takes the same theming props.
 *
 * There is no local `theme.tsx` behind them any more: the wrapper is
 * `<SkinTheme>` from `@stapel/tokens-antd/skin`, the one self-theming root the
 * whole fleet shares. These two props are simply what a caller may pin on it.
 */
export type { FlowError } from "@stapel/core";
import type { SkinSurface } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";

/**
 * Every `/default` surface accepts a theme mode and a surface role.
 *
 * `mode` absent means "whatever the host document declares, live" — the
 * substrate's `useThemeMode()`, subscribed to `data-theme`, never a hardcoded
 * side. Pass it only to pin one (a demo showing both).
 *
 * `surface` says what the wrapper paints under the skin. Each part defaults to
 * `"raised"` so it is legible dropped onto any host page; `<ReviewsPanel>`
 * hands its children `"bare"` because it has already painted the block they
 * sit in, and a host inlining `<RatingBadge>` into its own painted header
 * passes `"bare"` for the same reason.
 */
export interface ThemeModeProp {
  readonly mode?: ThemeMode;
  readonly surface?: SkinSurface;
}
