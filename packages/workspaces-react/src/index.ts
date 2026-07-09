/**
 * `@stapel/workspaces-react` — the headless React flow pair for stapel-workspaces
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * Scaffolded by `stapel-new-react-lib`. Layers: api → model → flows → headless
 * → i18n. Generated surfaces (flows registry, error map, manifest, llms.txt)
 * are produced by the monorepo `gen:*` drivers and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createWorkspacesApi } from "./api/workspacesApi.js";
export type { WorkspacesApi } from "./api/workspacesApi.js";
export type { Schemas } from "./api/types.js";

// ── flows ────────────────────────────────────────────────────────────────────
// The flow-machine primitive lives in `@stapel/core` (one reviewed copy for
// every pair — frontend-core-architecture §4b). Re-exported for ergonomics.
export { createFlowMachine, useFlow, isErrorCode } from "@stapel/core";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
  FlowError,
} from "@stapel/core";
export { toFlowError } from "./flows/errors.js";
export { WORKSPACES_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  WorkspacesFlowId,
  WorkspacesFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createWorkspacesRuntime } from "./model/runtime.js";
export type {
  WorkspacesRuntime,
  CreateWorkspacesRuntimeOptions,
} from "./model/runtime.js";
export {
  WorkspacesRuntimeContext,
  useWorkspacesRuntime,
  useWorkspacesApi,
  useWorkspacesAnalytics,
} from "./model/context.js";
export { workspacesQueryKeys } from "./model/queryKeys.js";

// ── model (read hooks) ───────────────────────────────────────────────────────
export {
  useWorkspaces,
  useWorkspace,
  useMembers,
} from "./model/queries.js";

// ── model (write hooks) ──────────────────────────────────────────────────────
export {
  useCreateWorkspace,
  useUpdateWorkspace,
  useDeleteWorkspace,
  useInviteMembers,
  useUpdateMemberRole,
  useRemoveMember,
  useAcceptInvitation,
} from "./model/mutations.js";
export type { MemberRoleChange } from "./model/mutations.js";

// ── api (wire type aliases) ──────────────────────────────────────────────────
export type {
  Workspace as WorkspaceData,
  WorkspaceList as WorkspaceListData,
  WorkspaceCreate,
  WorkspaceUpdate,
  Member as MemberData,
  MemberList as MemberListData,
  MemberInvite,
  MemberInviteResult,
  MemberRoleUpdate,
  Invitation,
  InvitationAccept,
  WorkspaceRole,
  WorkspaceKind,
} from "./api/types.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { WorkspacesProvider } from "./headless/WorkspacesProvider.js";
export { WorkspaceList } from "./headless/WorkspaceList.js";
export type { WorkspaceListBag } from "./headless/WorkspaceList.js";
export { Members } from "./headless/Members.js";
export type { MembersBag } from "./headless/Members.js";
export { AcceptInvitation } from "./headless/AcceptInvitation.js";
export type { AcceptInvitationBag } from "./headless/AcceptInvitation.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  WORKSPACES_I18N_KEYS,
  workspacesI18nBundleEn,
  registerWorkspacesI18n,
} from "./i18n/keys.js";
export type { WorkspacesI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  WORKSPACES_ERRORS,
  WORKSPACES_ERROR_CODES,
  workspacesErrorBundleEn,
  explainWorkspacesError,
} from "./i18n/errorsMap.js";
export type {
  WorkspacesErrorCode,
  WorkspacesErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
