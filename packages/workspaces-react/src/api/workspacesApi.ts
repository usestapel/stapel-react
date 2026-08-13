import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type {
  DisplayNameResult,
  DisplayNameUpdate,
  Invitation,
  InvitationPage,
  InvitationsParams,
  Member,
  MemberInvite,
  MemberInviteResult,
  MemberPage,
  MemberPasswordReset,
  MemberPasswordResetResult,
  MemberRoleUpdate,
  AuditParams,
  AuditPage,
  MembersParams,
  PreferredWorkspace,
  PreferredWorkspaceResult,
  InvitationAccept,
  InvitationClaim,
  InvitationPreview,
  InstanceShape,
  RoleList,
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

  /**
   * Record the caller's home workspace — their EXPLICIT choice, which the
   * instance's `default_workspace_id` documents itself as yielding to.
   * Answers 404 for anything they cannot actively open.
   */
  setPreferredWorkspace(body: PreferredWorkspace): Promise<PreferredWorkspaceResult>;
  /** Clear the caller's home workspace — back to the resolution chain. Idempotent. */
  clearPreferredWorkspace(): Promise<PreferredWorkspaceResult>;

  /** A workspace's members (viewer+), an anchor-paginated page. */
  /** The workspace's membership history, newest first — who let this person
   * in, who took them out, and when (stapel-workspaces 0.24). Anchor-paginated
   * like the member and invitation lists. */
  listAudit(
    workspaceId: string,
    params?: AuditParams
  ): Promise<AuditPage>;

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

  /**
   * Correct a member's display name (stapel-workspaces ≥0.19.0, capability
   * `members.role.change`). Writes the CANONICAL name — stapel-profiles'
   * `Profile.display_name` through this module's in-process profiles seam,
   * which also publishes `profile.changed` — NOT the membership's
   * `display_name_hint`, which is a pre-profile placeholder that goes dark the
   * moment a real profile exists.
   *
   * Only an owner may rename an owner. Where stapel-profiles does not run in
   * the deployment's process the answer is `error.503.profiles_unavailable`,
   * never a 200 over a write that did not happen.
   */
  renameMember(
    workspaceId: string,
    userId: string,
    body: DisplayNameUpdate
  ): Promise<DisplayNameResult>;

  /**
   * Reset a member's password on the organization's order (stapel-workspaces
   * ≥0.14.0, #110). Capability `members.password.reset`, declared **high** —
   * the backend wraps it in `requires_verification(scope="sensitive")`, so an
   * ambient cookie is not enough and a step-up (or factor ENROLLMENT) 403 is
   * the normal first answer. A missing/wrong target answers one
   * byte-identical 404 (never an existence oracle).
   *
   * `generated_password` in the reply is a ONE-SHOT credential: present only
   * when the request omitted `password`, never re-fetchable, never logged.
   */
  resetMemberPassword(
    workspaceId: string,
    userId: string,
    body?: MemberPasswordReset
  ): Promise<MemberPasswordResetResult>;

  // ── invitation administration (#109, stapel-workspaces ≥0.12.0) ────────────

  /**
   * The workspace's invitations — the admin's "who has not accepted yet"
   * table (capability `members.invite`). An ANCHOR-paginated page, filtered
   * by `status` (default `pending`) and `search` (invited email). The invite
   * token is never in the response.
   */
  listInvitations(
    workspaceId: string,
    params?: InvitationsParams
  ): Promise<InvitationPage>;
  /**
   * Withdraw a live invitation — the workspace's terminal "no", the mirror of
   * the invitee's decline (the two stay distinguishable in `status` forever).
   * Only a `pending` one is revocable; the reply is the updated row.
   */
  revokeInvitation(
    workspaceId: string,
    invitationId: string
  ): Promise<Invitation>;
  /**
   * Send the invitation email again. Accepts an EXPIRED invitation on purpose
   * (a dead TTL is the commonest reason to resend) and refuses the three
   * terminal states. Rotates the token and restarts the TTL — every earlier
   * link stops working — so the reply is the updated row, not the old one.
   */
  resendInvitation(
    workspaceId: string,
    invitationId: string
  ): Promise<Invitation>;
  /**
   * Fix a still-PENDING invitation's name hint (stapel-workspaces ≥0.19.0,
   * capability `members.role.change` — the same one as {@link renameMember},
   * because this hint IS the member's name after acceptance and splitting the
   * two would let a role fix a name that reverts).
   *
   * The same correction as {@link renameMember}, one step earlier: the invitee
   * has not accepted, so there is no profile of theirs to write and the name
   * lives on the invitation. Before it, the only fix for a typo in an
   * invitee's name was revoke-and-re-invite, which re-mails the person. A
   * terminal invitation refuses with the keyed answers revoke gives
   * (`error.400.invitation_already_used` / `_revoked` / `_declined` /
   * `_expired`).
   */
  renameInvitation(
    workspaceId: string,
    invitationId: string,
    body: DisplayNameUpdate
  ): Promise<DisplayNameResult>;

  /** Accept an invitation by its token — returns the caller's new membership. */
  acceptInvitation(body: InvitationAccept): Promise<Member>;

  // ── invite flow (org-program §B2, stapel-workspaces ≥0.7.0) ────────────────

  /**
   * Public (AllowAny) invitation preview — what the `/invite/{token}` page
   * renders before any auth decision. The token in the URL is the bearer
   * secret: a credential, never log it.
   */
  getInvitationPreview(token: string): Promise<InvitationPreview>;
  /**
   * Mint a login grant for a NOT-yet-registered invitee (AllowAny; only valid
   * while `email_registered === false` — an existing account gets 409
   * `email_already_registered` and the frontend switches to login). The
   * invitation is NOT consumed: accept stays a separate, deliberate step.
   * The returned `grant_token` is exchanged at AUTH's `POST /grant/exchange/`
   * — deliberately not this pair's surface (pairs don't depend on each
   * other); `InviteAcceptFlow` hands it outward via `onLoginGrant`.
   */
  claimInvitation(token: string): Promise<InvitationClaim>;
  /** Decline an invitation (authenticated + email-match) — the invitee's
   * terminal "no". Decline ≠ revoke; both stay distinguishable in `status`. */
  declineInvitation(token: string): Promise<void>;

  // ── role registry (org-program §A2, stapel-workspaces ≥0.6.0) ──────────────

  /** The effective role registry (builtin + deployment overlay), for
   * RoleSelect-class UI — capability strings verbatim, rank-descending. */
  listRoles(): Promise<RoleList>;

  /** Instance shape (GET /instance, unauthenticated). */
  getInstanceShape(): Promise<InstanceShape>;
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

    setPreferredWorkspace: (body) =>
      client.put(
        "/me/preferred-workspace",
        body satisfies PreferredWorkspace,
        mutating()
      ),

    clearPreferredWorkspace: () =>
      client.delete("/me/preferred-workspace", mutating()),

    listAudit: (workspaceId, params) => {
      const query: Record<string, string | number> = {};
      if (params?.action !== undefined) query.action = params.action;
      if (params?.user_id !== undefined) query.user_id = params.user_id;
      if (params?.anchor !== undefined) query.anchor = params.anchor;
      if (params?.direction !== undefined) query.direction = params.direction;
      if (params?.limit !== undefined) query.limit = params.limit;
      return client.get(`/${encodeURIComponent(workspaceId)}/audit`, {
        query,
      });
    },

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

    renameMember: (workspaceId, userId, body) =>
      client.patch(
        `/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}/name`,
        body satisfies DisplayNameUpdate,
        mutating()
      ),

    renameInvitation: (workspaceId, invitationId, body) =>
      client.patch(
        `/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitationId)}/name`,
        body satisfies DisplayNameUpdate,
        mutating()
      ),

    resetMemberPassword: (workspaceId, userId, body) =>
      client.post(
        `/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}/password/reset`,
        (body ?? {}) satisfies MemberPasswordReset,
        mutating()
      ),

    listInvitations: (workspaceId, params) => {
      const query: Record<string, string | number> = {};
      if (params?.anchor !== undefined) query.anchor = params.anchor;
      if (params?.direction !== undefined) query.direction = params.direction;
      if (params?.limit !== undefined) query.limit = params.limit;
      if (params?.search !== undefined) query.search = params.search;
      if (params?.status !== undefined) query.status = params.status;
      return client.get(`/${encodeURIComponent(workspaceId)}/invitations`, {
        query,
      });
    },

    revokeInvitation: (workspaceId, invitationId) =>
      client.post(
        `/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
        undefined,
        mutating()
      ),

    resendInvitation: (workspaceId, invitationId) =>
      client.post(
        `/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitationId)}/resend`,
        undefined,
        mutating()
      ),

    acceptInvitation: (body) =>
      client.post(
        "/invitations/accept",
        body satisfies InvitationAccept,
        mutating()
      ),

    getInvitationPreview: (token) =>
      client.get(`/invitations/${encodeURIComponent(token)}`),

    claimInvitation: (token) =>
      client.post(
        `/invitations/${encodeURIComponent(token)}/claim`,
        undefined,
        mutating()
      ),

    declineInvitation: (token) =>
      client.post(
        `/invitations/${encodeURIComponent(token)}/decline`,
        undefined,
        mutating()
      ),

    listRoles: () => client.get("/roles"),

    getInstanceShape: () => client.get("/instance"),
  };
}
