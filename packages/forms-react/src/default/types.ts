/**
 * Small shared types for the `/default` skin — kept in one place so every
 * surface takes the same theme props and re-exports the same error dialect.
 */
export type { FlowError } from "@stapel/core";
import type { ThemeMode } from "@stapel/tokens-antd";
import type { SkinSurface } from "@stapel/tokens-antd/skin";

/**
 * Every `/default` surface accepts a theme mode and a surface role, and
 * forwards both to `<SkinTheme>` from `@stapel/tokens-antd/skin`.
 *
 * `mode` absent means "whatever the host document declares RIGHT NOW"
 * (`useThemeMode()` — subscribed, so a runtime `data-theme` flip repaints a
 * mounted skin), never a hardcoded side. `surface` absent means `"raised"`;
 * pass `"bare"` when the skin is inset in a surface the host already painted
 * — which is what these surfaces pass each other when one opens another in a
 * dialog.
 */
export interface ThemeModeProp {
  readonly mode?: ThemeMode;
  readonly surface?: SkinSurface;
}

/**
 * Spread a surface's theme props onto `<SkinTheme>` without ever passing an
 * explicit `undefined` (which `exactOptionalPropertyTypes` refuses and which
 * would in any case override the substrate's own default with nothing).
 */
export function skinThemeProps(props: ThemeModeProp): {
  mode?: ThemeMode;
  surface?: SkinSurface;
} {
  return {
    ...(props.mode !== undefined ? { mode: props.mode } : {}),
    ...(props.surface !== undefined ? { surface: props.surface } : {}),
  };
}
