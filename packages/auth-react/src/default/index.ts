/**
 * `@stapel/auth-react/default` — the §54 pilot default skin. A separate entry
 * point so consumers who bring their own visuals never pull `antd` (or the
 * bridge) into their bundle; importing this subpath is the opt-in.
 *
 * ```tsx
 * import { AuthPanel } from "@stapel/auth-react/default";
 * // under the pair's <AuthProvider> + core <I18nProvider>:
 * <AuthPanel mode="dark" />
 * ```
 */
export { AuthPanel } from "./AuthPanel.js";
export type { AuthPanelProps, AuthPanelNotice } from "./AuthPanel.js";
export {
  DEFAULT_CHANNEL_PRIORITY,
  computeZones,
  enabledChannels,
  resolveInteraction,
} from "./channels.js";
export type { AuthZones, ChannelId } from "./channels.js";
