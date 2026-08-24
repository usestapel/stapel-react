/**
 * `@stapel/moderation-react/default` — the pair's default AntD skin (§54: a pair ships a
 * FEATURE, not only a bag). A separate entry point, so a host that brings its
 * own visuals never pulls `antd` or the token bridge into its bundle;
 * importing this subpath is the opt-in.
 *
 * ```tsx
 * import { ModerationPanel } from "@stapel/moderation-react/default";
 * // under the pair's <ModerationProvider> + core's <I18nProvider>:
 * <ModerationPanel />
 * ```
 */
export { ModerationPanel } from "./ModerationPanel.js";
export type { ModerationPanelProps } from "./ModerationPanel.js";
export type { ThemeModeProp } from "./types.js";
