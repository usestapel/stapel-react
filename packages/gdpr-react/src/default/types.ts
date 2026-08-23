/**
 * Small shared types for the `/default` skin — kept in one place so every
 * surface takes the same `mode` prop and re-exports the same error dialect.
 */
export type { FlowError } from "@stapel/core";
import type { ThemeMode } from "@stapel/tokens-antd";

/** Every `/default` surface accepts a theme mode; absent means "whatever the
 * host document declares" (`resolveThemeMode()`), never a hardcoded side. */
export interface ThemeModeProp {
  readonly mode?: ThemeMode;
}
