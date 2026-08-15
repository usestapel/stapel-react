/**
 * `@stapel/shell-react/theme` — the three-state theme control and the
 * mechanism under it. A separate entry point from the package root, which is
 * contractually pure (`resolveNav` runs at scaffold codegen time, in Node,
 * with no React), and from `/default`, which is antd.
 *
 * ```tsx
 * import {
 *   ThemeModeControl,
 *   useThemePreference,
 * } from "@stapel/shell-react/theme";
 *
 * // `preference` is whatever the host treats as the source of truth —
 * // a profile field, a store, local state. The library applies it and
 * // follows the OS while it is "system"; it never writes it back.
 * useThemePreference(preference);
 * <ThemeModeControl value={preference} onChange={save} />;
 * ```
 */
export {
  applyThemePreference,
  documentThemeMode,
  isThemePreference,
  readStoredThemePreference,
  resolveThemePreference,
  subscribeThemeStamp,
  systemThemeMode,
  watchSystemTheme,
  DEFAULT_DARK_CLASSES,
  THEME_ATTRIBUTE,
  THEME_PREFERENCES,
  THEME_PREFERENCE_STORAGE_KEY,
} from "./preference.js";
export type {
  ApplyThemeOptions,
  ThemeMode,
  ThemePreference,
} from "./preference.js";

export { useDocumentThemeMode, useThemePreference } from "./useTheme.js";

export { ThemeModeControl, themeModeLabelsEn } from "./ThemeModeControl.js";
export type {
  ThemeModeControlProps,
  ThemeModeLabels,
} from "./ThemeModeControl.js";
