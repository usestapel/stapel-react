import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type {
  Member,
  MemberInvite,
  MemberInviteResult,
  MemberPage,
  MemberRoleUpdate,
  MembersParams,
  InvitationAccept,
  Workspace,
  WorkspaceCreate,
  WorkspaceList,
  WorkspaceUpdate,
} from "./types.js";

/**
 * CSRF rule for cookie-authenticated browser clients (mirrors auth-react): the
 * simplest SPA rule is to always send `X-Requested-With: XMLHttpRequest` on
 * mutating requests. Header-token clients ignore it; it is harmless there, so
 * every mutation carries it.
 */
const CSRF_HEADERS: Record<string, string> = {
  "X-Requested-With": "XMLHttpRequest",
};

function mutating(
  options?: Omit<StapelRequestOptions, "method" | "body">
): Omit<StapelRequestOptions, "method" | "body"> {
  return {
    ...options,
    headers: { ...CSRF_HEADERS, ...options?.headers },
  };
}

/**
 * The pair's typed operation surface — one method per stapel-workspaces endpoint
 * a signed-in browser client may call, bound to the injected {@link StapelClient}
 * (the per-module override seam of frontend-standard §7.2). Paths are relative
 * to the runtime's `baseUrl` (e.g. `/workspaces/api`).
 *
 * The service-to-service `GET /internal/{ws}/members/{user}` (membership check
 * from another backend) and `POST /internal/users/{user}/personal` (get-or-create
 * a personal workspace on first login) are intentionally absent — they are
 * machine-to-machine surfaces (`IsServiceRequest | IsStaffUser`), not part of the
 * signed-in UI this pair drives.
 *
 * These operations will be GENERATED from schema.json operationIds by gen-api
 * v2 (task `core-typed-ops`); until then they are hand-authored here (the ONE
 * legal home of path strings — `stapel/no-string-paths` §2.3 carve-out).
 */
export interface WorkspacesApi {
  readonly client: StapelClient;

  /** The caller's workspaces (accepted memberships, newest-accessed first). */
  listWorkspaces(): Promise<WorkspaceList>;
  /** Create a workspace and seed the caller as owner. */
  createWorkspace(body: WorkspaceCreate): Promise<Workspace>;
  /** A single workspace by id (touches last-accessed). */
  getWorkspace(workspaceId: string): Promise<Workspace>;
  /** Partially update a workspace's name / slug / settings (admin+). */
  updateWorkspace(
    workspaceId: string,
    patch: WorkspaceUpdate
  ): Promise<Workspace>;
  /** Soft-delete a workspace (owner only). */
  deleteWorkspace(workspaceId: string): Promise<void>;

  /** A workspace's members (viewer+), an anchor-paginated page. */
  listMembers(
    workspaceId: string,
    params?: MembersParams
  ): Promise<MemberPage>;
  /** Invite one or more emails to a workspace at a role (admin+). */
  inviteMembers(
    workspaceId: string,
    body: MemberInvite
  ): Promise<MemberInviteResult>;
  /** Change a member's role (admin+; owner grants require owner). */
  updateMemberRole(
    workspaceId: string,
    userId: string,
    patch: MemberRoleUpdate
  ): Promise<Member>;
  /** Remove a member from a workspace (admin+; the last owner is protected). */
  removeMember(workspaceId: string, userId: string): Promise<void>;

  /** Accept an invitation by its token — returns the caller's new membership. */
  acceptInvitation(body: InvitationAccept): Promise<Member>;
}

export function createWorkspacesApi(client: StapelClient): WorkspacesApi {
  return {
    client,

    listWorkspaces: () => client.get("/"),

    createWorkspace: (body) =>
      client.post("/", body satisfies WorkspaceCreate, mutating()),

    getWorkspace: (workspaceId) =>
      client.get(`/${encodeURIComponent(workspaceId)}`),

    updateWorkspace: (workspaceId, patch) =>
      client.patch(
        `/${encodeURIComponent(workspaceId)}`,
        patch satisfies WorkspaceUpdate,
        mutating()
      ),

    deleteWorkspace: (workspaceId) =>
      client.delete(`/${encodeURIComponent(workspaceId)}`, mutating()),

    listMembers: (workspaceId, params) => {
      const query: Record<string, string | number> = {};
      if (params?.anchor !== undefined) query.anchor = params.anchor;
      if (params?.direction !== undefined) query.direction = params.direction;
      if (params?.limit !== undefined) query.limit = params.limit;
      if (params?.search !== undefined) query.search = params.search;
      return client.get(`/${encodeURIComponent(workspaceId)}/members`, {
        query,
      });
    },

    inviteMembers: (workspaceId, body) =>
      client.post(
        `/${encodeURIComponent(workspaceId)}/members/invite`,
        body satisfies MemberInvite,
        mutating()
      ),

    updateMemberRole: (workspaceId, userId, patch) =>
      client.patch(
        `/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
        patch satisfies MemberRoleUpdate,
        mutating()
      ),

    removeMember: (workspaceId, userId) =>
      client.delete(
        `/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
        mutating()
      ),

    acceptInvitation: (body) =>
      client.post(
        "/invitations/accept",
        body satisfies InvitationAccept,
        mutating()
      ),
  };
}
