/**
 * `@stapel/workspaces-react/default` — this pair's DEFAULT SKIN: the antd
 * screens a host mounts to have a working workspace product, not a set of
 * examples (§83, §54). A separate entry point so consumers who bring their
 * own visuals never pull `antd` into their bundle; importing this subpath is
 * the opt-in.
 *
 * Every screen self-themes through `<SkinTheme>` from
 * `@stapel/tokens-antd/skin`, so it is correct inside a dark document with no
 * host wiring, and every one of them needs this pair's `<WorkspacesProvider>`
 * plus core's `<I18nProvider>` above it.
 *
 * ```tsx
 * import {
 *   WorkspacesPage, WorkspaceSettings, MembersManager,
 *   InvitationsPane, AuditTrailPane, InviteAcceptPage,
 * } from "@stapel/workspaces-react/default";
 *
 * <WorkspacesPage onOpen={(ws) => navigate(`/w/${ws.slug}`)} />
 * <WorkspaceSettings workspaceId={id} onDeleted={() => navigate("/")} />
 * <MembersManager workspaceId={id} />
 * <InvitationsPane workspaceId={id} />
 * <AuditTrailPane workspaceId={id} />
 * <InviteAcceptPage token={token} sessionEmail={email} />
 * ```
 */
export { WorkspacesPage } from "./WorkspacesPage.js";
export type { WorkspacesPageProps } from "./WorkspacesPage.js";
export { WorkspaceSettings } from "./WorkspaceSettings.js";
export type { WorkspaceSettingsProps } from "./WorkspaceSettings.js";
export { MembersManager } from "./MembersManager.js";
export type { MembersManagerProps } from "./MembersManager.js";
export { InvitationsPane } from "./InvitationsPane.js";
export type { InvitationsPaneProps } from "./InvitationsPane.js";
export { AuditTrailPane } from "./AuditTrailPane.js";
export type { AuditTrailPaneProps } from "./AuditTrailPane.js";
export { RoleSelectField } from "./RoleSelectField.js";
export type { RoleSelectFieldProps } from "./RoleSelectField.js";
export { InviteAcceptPage } from "./InviteAcceptPage.js";
export type { InviteAcceptPageProps } from "./InviteAcceptPage.js";
