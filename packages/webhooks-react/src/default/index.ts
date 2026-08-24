/**
 * `@stapel/webhooks-react/default` — the pair's default AntD skin (§54: a pair ships a
 * FEATURE, not only a bag). A separate entry point, so a host that brings its
 * own visuals never pulls `antd` or the token bridge into its bundle;
 * importing this subpath is the opt-in.
 *
 * ```tsx
 * import { WebhooksPanel } from "@stapel/webhooks-react/default";
 * // under the pair's <WebhooksProvider> + core's <I18nProvider>:
 * <WebhooksPanel />
 * ```
 */
export { WebhooksPanel } from "./WebhooksPanel.js";
export type { WebhooksPanelProps } from "./WebhooksPanel.js";
export type { ThemeModeProp } from "./types.js";
