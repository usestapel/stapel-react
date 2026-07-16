/**
 * `@stapel/workspaces-react/default` — the pilot default skin for this
 * pair's settings surfaces (mirrors auth-react's `/default` split, §54): a
 * separate entry point so consumers who bring their own visuals never pull
 * `antd` into their bundle; importing this subpath is the opt-in.
 *
 * ```tsx
 * import { WorkspaceSettings, MembersManager } from "@stapel/workspaces-react/default";
 * // under this pair's <WorkspacesProvider> + core <I18nProvider>:
 * <WorkspaceSettings workspaceId={id} />
 * <MembersManager workspaceId={id} />
 * ```
 */
export { WorkspaceSettings } from "./WorkspaceSettings.js";
export type { WorkspaceSettingsProps } from "./WorkspaceSettings.js";
export { MembersManager } from "./MembersManager.js";
export type { MembersManagerProps } from "./MembersManager.js";
