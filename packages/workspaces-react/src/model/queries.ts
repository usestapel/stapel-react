import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type {
  InvitationPreview,
  MemberPage,
  MembersParams,
  RoleInfo,
  Workspace,
  WorkspaceList,
} from "../api/types.js";
import { useWorkspacesApi } from "./context.js";
import { workspacesQueryKeys } from "./queryKeys.js";
import { hasCapability } from "./capabilities.js";

/**
 * Read hooks over the workspaces API. Staleness follows core's query defaults;
 * override per call site via a page that needs fresher data. Keys are
 * namespaced (see `workspacesQueryKeys`).
 */

/**
 * The caller's workspaces — their accepted memberships (GET /).
 *
 * Gated on {@link useActiveSessionReady} (owner-diagnosed live incident,
 * 2026-07-17): unlike {@link useWorkspace}/{@link useMembers} below (both
 * naturally disabled until a `workspaceId` is picked), this is the top-level
 * list hook with nothing else to gate it — it fires the instant a component
 * mounts. Without the session ready-gate this is exactly the shape of hook
 * that raced a session still bootstrapping (e.g. right after a QR
 * `session_share` scan set fresh cookies this JS runtime hadn't caught up
 * to yet) and read a live session as "expired" before it had a chance to
 * resolve — zero manual `enabled` wiring needed at each call site by design.
 */
export function useWorkspaces(): UseQueryResult<WorkspaceList, StapelApiError> {
  const api = useWorkspacesApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: workspacesQueryKeys.list(),
    queryFn: () => api.listWorkspaces(),
    enabled: sessionReady,
  });
}

/**
 * A single workspace by id (GET /{id}). Disabled until a `workspaceId` is
 * given, so a detail hook can mount before a selection exists — AND until
 * the session is ready (a `workspaceId` can be known synchronously, e.g.
 * from a URL param, before the session has finished bootstrapping).
 */
export function useWorkspace(
  workspaceId: string | null
): UseQueryResult<Workspace, StapelApiError> {
  const api = useWorkspacesApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: workspacesQueryKeys.detail(workspaceId ?? ""),
    queryFn: () => api.getWorkspace(workspaceId as string),
    enabled: sessionReady && workspaceId !== null && workspaceId !== "",
  });
}

/**
 * A page of a workspace's members (GET /{id}/members, anchor-paginated).
 * Disabled until a `workspaceId` is given (and the session is ready — see
 * {@link useWorkspace}). Pass `{ anchor, direction, limit, search }` to jump
 * to a specific page or filter; omit for the newest page (default limit 100).
 */
export function useMembers(
  workspaceId: string | null,
  params?: MembersParams
): UseQueryResult<MemberPage, StapelApiError> {
  const api = useWorkspacesApi();
  const sessionReady = useActiveSessionReady();
  const p = params ?? {};
  return useQuery({
    queryKey: workspacesQueryKeys.membersPage(workspaceId ?? "", p),
    queryFn: () => api.listMembers(workspaceId as string, p),
    enabled: sessionReady && workspaceId !== null && workspaceId !== "",
  });
}

/**
 * The effective role registry (GET /roles, org-program §A2): builtin four +
 * the deployment's `STAPEL_WORKSPACES["ROLES"]` overlay, capability strings
 * verbatim, rank-descending. Deployment-static data — role UI (RoleSelect)
 * reads this instead of hardcoding the builtin four. Session-ready-gated like
 * {@link useWorkspaces} (IsAuthenticated endpoint, mounts at screen top).
 */
export function useRoles(): UseQueryResult<
  readonly RoleInfo[],
  StapelApiError
> {
  const api = useWorkspacesApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: workspacesQueryKeys.roles(),
    queryFn: async () => (await api.listRoles()).roles ?? [],
    enabled: sessionReady,
  });
}

/**
 * Public invitation preview (GET /invitations/{token}, AllowAny — org-program
 * §B2): what the `/invite/{token}` page renders BEFORE any auth decision.
 * Deliberately NOT session-gated — the whole point is that the invitee may
 * have no session at all; the token in the URL is the bearer secret.
 */
export function useInvitationPreview(
  token: string | null
): UseQueryResult<InvitationPreview, StapelApiError> {
  const api = useWorkspacesApi();
  return useQuery({
    queryKey: workspacesQueryKeys.invitationPreview(token ?? ""),
    queryFn: () => api.getInvitationPreview(token as string),
    enabled: token !== null && token !== "",
  });
}

/** What {@link useCapabilities} returns: the caller's granted capability
 * strings in one workspace plus the wildcard-aware `can()` check. */
export interface CapabilitiesResult {
  /** Verbatim registry strings of the caller's role (wildcards included);
   * empty while loading or when the caller is not a member. */
  readonly capabilities: readonly string[];
  /** Wildcard-aware check (`*` / `prefix.*` — the backend matcher, ported).
   * UI convenience only: the backend re-checks on every operation. */
  can(capability: string): boolean;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
}

/**
 * The caller's capabilities in one workspace (org-program §A2): reads
 * `my_capabilities` off the workspace detail (`WorkspaceResponse`, additive
 * field since stapel-workspaces 0.6.0) and exposes the ported wildcard
 * matcher. Deny-by-default: `can()` is false while loading, on error, or when
 * the backend predates the field.
 */
export function useCapabilities(workspaceId: string | null): CapabilitiesResult {
  const query = useWorkspace(workspaceId);
  const capabilities = query.data?.my_capabilities ?? [];
  return {
    capabilities,
    can: (capability) => hasCapability(capabilities, capability),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
  };
}
