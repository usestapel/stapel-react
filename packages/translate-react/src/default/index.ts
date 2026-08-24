/**
 * `@stapel/translate-react/default` — the pair's default AntD skin (§54: a pair ships a
 * FEATURE, not only a bag). A separate entry point, so a host that brings its
 * own visuals never pulls `antd` or the token bridge into its bundle;
 * importing this subpath is the opt-in.
 *
 * ```tsx
 * import { TranslatePanel } from "@stapel/translate-react/default";
 * // under the pair's <TranslateProvider> + core's <I18nProvider>:
 * <TranslatePanel />
 * ```
 */
export { TranslatePanel } from "./TranslatePanel.js";
export type { TranslatePanelProps } from "./TranslatePanel.js";
export type { ThemeModeProp } from "./types.js";
