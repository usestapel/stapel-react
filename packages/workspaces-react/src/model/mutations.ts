import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  DisplayNameResult,
  Invitation,
  Member,
  MemberInvite,
  MemberInviteResult,
  MemberPasswordReset,
  MemberPasswordResetResult,
  InvitationAccept,
  InvitationClaim,
  PreferredWorkspace,
  PreferredWorkspaceResult,
  Workspace,
  WorkspaceCreate,
  WorkspaceSecuritySettings,
  WorkspaceUpdate,
} from "../api/types.js";
import { useWorkspacesApi } from "./context.js";
import { workspacesQueryKeys } from "./queryKeys.js";

/**
 * Write hooks (frontend-standard §2 — mutations invalidate on success). Each mutation
 * invalidates exactly the server state it can move. Membership and ownership are
 * server truth (roles gate access in other services via the membership cache),
 * so NONE of these are optimistic (frontend-core-architecture §2.6: optimistic
 * is for local-echo UX, never for flows with server truth).
 *
 * Options are built as typed `UseMutationOptions` objects (not call-site
 * generics) so `void` stays in type-reference position, which
 * `no-invalid-void-type` permits. Hooks that act on one workspace take its id as
 * a parameter (the mutation variable then carries only the payload).
 */

/** Create a workspace (owner-seeded) — refreshes the workspace list. */
export function useCreateWorkspace(): UseMutationResult<
  Workspace,
  StapelApiError,
  WorkspaceCreate
> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<Workspace, StapelApiError, WorkspaceCreate> =
    {
      mutationFn: (body) => api.createWorkspace(body),
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: workspacesQueryKeys.list(),
        });
      },
    };
  return useMutation(options);
}

/**
 * Partially update a workspace — writes the fresh row into its detail cache and
 * refreshes the list (name / slug may have changed there too).
 */
export function useUpdateWorkspace(
  workspaceId: string
): UseMutationResult<Workspace, StapelApiError, WorkspaceUpdate> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<Workspace, StapelApiError, WorkspaceUpdate> =
    {
      mutationFn: (patch) => api.updateWorkspace(workspaceId, patch),
      onSuccess: (updated) => {
        queryClient.setQueryData(
          workspacesQueryKeys.detail(workspaceId),
          updated
        );
        void queryClient.invalidateQueries({
          queryKey: workspacesQueryKeys.list(),
        });
      },
    };
  return useMutation(options);
}

/** Soft-delete a workspace (owner only) — drops its detail cache + refreshes the list. */
export function useDeleteWorkspace(): UseMutationResult<
  void,
  StapelApiError,
  string
> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (workspaceId) => api.deleteWorkspace(workspaceId),
    onSuccess: (_result, workspaceId) => {
      queryClient.removeQueries({
        queryKey: workspacesQueryKeys.detail(workspaceId),
      });
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.list(),
      });
    },
  };
  return useMutation(options);
}

/**
 * Invite one or more emails to a workspace (admin+). Server truth — no optimism.
 * A bad role or missing email surfaces as a localizable `StapelApiError`
 * (`error.400.invalid_role`). Refreshes the member list (pending invites show
 * there).
 */
export function useInviteMembers(
  workspaceId: string
): UseMutationResult<MemberInviteResult, StapelApiError, MemberInvite> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    MemberInviteResult,
    StapelApiError,
    MemberInvite
  > = {
    mutationFn: (body) => api.inviteMembers(workspaceId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.members(workspaceId),
      });
      // The history beside the roster is a record OF this change: an admin
      // who removes someone and looks down expects to see it. The audit key
      // is its own root (queryKeys.ts), so the members invalidation above
      // does not reach it.
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.audit(workspaceId),
      });
    },
  };
  return useMutation(options);
}

/** The variable for {@link useUpdateMemberRole}: which member, which new role.
 * `role` is an open string since stapel-workspaces 0.6.0 (org-program §A1):
 * the effective registry is settings-extensible, so any key of GET /roles is
 * valid — the backend validates against the registry. {@link WorkspaceRole}
 * still names the builtin four for literals. */
export interface MemberRoleChange {
  readonly userId: string;
  readonly role: string;
}

/**
 * Change a member's role (admin+; the backend guards owner grants and the
 * last-owner invariant, surfacing `error.403.last_owner_cannot_be_removed`).
 * Refreshes the member list.
 */
export function useUpdateMemberRole(
  workspaceId: string
): UseMutationResult<Member, StapelApiError, MemberRoleChange> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<Member, StapelApiError, MemberRoleChange> = {
    mutationFn: ({ userId, role }) =>
      api.updateMemberRole(workspaceId, userId, { role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.members(workspaceId),
      });
      // The history beside the roster is a record OF this change: an admin
      // who removes someone and looks down expects to see it. The audit key
      // is its own root (queryKeys.ts), so the members invalidation above
      // does not reach it.
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.audit(workspaceId),
      });
    },
  };
  return useMutation(options);
}

/**
 * Remove a member (admin+; the last owner is protected by the backend). The
 * variable is the member's `userId`. Refreshes the member list.
 */
export function useRemoveMember(
  workspaceId: string
): UseMutationResult<void, StapelApiError, string> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (userId) => api.removeMember(workspaceId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.members(workspaceId),
      });
      // The history beside the roster is a record OF this change: an admin
      // who removes someone and looks down expects to see it. The audit key
      // is its own root (queryKeys.ts), so the members invalidation above
      // does not reach it.
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.audit(workspaceId),
      });
    },
  };
  return useMutation(options);
}

/** The variable for {@link useRenameMember}: whose name, and the new one.
 * `displayName` is nullable because clearing IS a supported outcome — blank,
 * whitespace-only and `null` all mean "no name for this person" to the
 * backend, which then answers with an empty string. */
export interface MemberRename {
  readonly userId: string;
  readonly displayName: string | null;
}

/**
 * Correct a co-member's display name (PATCH /{id}/members/{userId}/name,
 * stapel-workspaces ≥0.19.0) — the roster-side fix an owner/admin applies
 * without waiting for the person themselves.
 *
 * **Capability `members.role.change`**, not `members.invite`: ask
 * {@link "./queries.js".useCapabilityGate}(workspaceId,
 * "members.role.change") before offering the affordance. It is `standard`, so
 * no step-up is demanded (contrast {@link useResetMemberPassword}). Anonymous
 * callers are denied outright, and only an owner may rename an owner.
 *
 * **What the write moves, and hence what is invalidated.** The backend writes
 * the CANONICAL name — stapel-profiles' `Profile.display_name` through the
 * in-process profiles seam — not the membership's local
 * `display_name_hint`, which goes dark the moment a real profile exists. So
 * the stale set is not "the page this row was on": it is EVERY cached roster,
 * in every workspace, because `MemberResponse.display_name` is a live lookup
 * of that one canonical value. Hence
 * {@link "./queryKeys.js".workspacesQueryKeys.membersAll}, the workspace-less
 * prefix — invalidating `members(workspaceId)` would leave the same person
 * showing their old name on every other roster the session has open. A
 * rename can also move a row out of an active `search` filter, which the
 * prefix covers too (every page, every filter).
 *
 * A host that ALSO renders `@stapel/profiles-react` data for this person owns
 * the other half: this pair never reaches into another pair's query namespace
 * (the same seam discipline as `InviteAcceptFlow`'s basic-data slot), so
 * invalidate `profilesQueryKeys.profile(userId)` yourself there.
 *
 * **Errors** arrive in the single dialect, keyed: the four display-name rules
 * borrowed verbatim from stapel-profiles
 * (`error.400.display_name_too_short` / `_forbidden_chars` /
 * `_invisible_chars` / `_emoji`), over-length as the fleet-standard
 * `error.400.field.max_length` with `{field, max_length}` (no bespoke code),
 * and `error.503.profiles_unavailable` where stapel-profiles does not run in
 * the deployment's process — an honest refusal rather than a 200 over a write
 * that did not happen. Render them with `explainWorkspacesError` / `t(code,
 * params)` like every other key.
 */
export function useRenameMember(
  workspaceId: string
): UseMutationResult<DisplayNameResult, StapelApiError, MemberRename> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    DisplayNameResult,
    StapelApiError,
    MemberRename
  > = {
    mutationFn: ({ userId, displayName }) =>
      api.renameMember(workspaceId, userId, { display_name: displayName }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.membersAll(),
      });
    },
  };
  return useMutation(options);
}

/** The variable for {@link useRenameInvitation}: which pending invitation, and
 * the corrected name hint (nullable for the same reason as
 * {@link MemberRename}). */
export interface InvitationRename {
  readonly invitationId: string;
  readonly displayName: string | null;
}

/**
 * Fix a pending invitation's name hint (PATCH
 * /{id}/invitations/{invitationId}/name, stapel-workspaces ≥0.19.0) — the
 * same correction as {@link useRenameMember}, one step earlier. The invitee
 * has not accepted, so there is no profile of theirs to write and the name
 * lives on the invitation; `accept_invitation` copies it onto the membership.
 * Before this endpoint the only fix for a typo in an invitee's name was
 * revoke-and-re-invite, which re-mails the person.
 *
 * **The same capability as the member rename** (`members.role.change`, not
 * the invitation surface's `members.invite`) — the hint IS the member's name
 * after acceptance, so splitting them would let a role fix a name that
 * reverts.
 *
 * Only a PENDING invitation is editable; a terminal one refuses with the
 * keyed answers revoke gives (`error.400.invitation_already_used` /
 * `_revoked` / `_declined` / `_expired`), and an accepted invitation's name
 * is the member's name now — use {@link useRenameMember}. Validation is the
 * same stapel-profiles canon, so the same four display-name keys surface
 * here.
 *
 * Invalidation is deliberately NARROWER than the member rename's: the hint is
 * a workspace-local column on one invitation, not a shared canonical name, so
 * only this workspace's invitation lists (every page and the infinite walk —
 * the bare 3-tuple prefix) can be showing it.
 */
export function useRenameInvitation(
  workspaceId: string
): UseMutationResult<DisplayNameResult, StapelApiError, InvitationRename> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    DisplayNameResult,
    StapelApiError,
    InvitationRename
  > = {
    mutationFn: ({ invitationId, displayName }) =>
      api.renameInvitation(workspaceId, invitationId, {
        display_name: displayName,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.invitations(workspaceId),
      });
    },
  };
  return useMutation(options);
}

/**
 * Withdraw a live invitation (POST /{id}/invitations/{invitationId}/revoke,
 * #109). The variable is the invitation id; the reply is the UPDATED row, so
 * it is written straight into the page cache the table reads — a revoke is
 * the mirror of the invitee's decline and both must stay distinguishable in
 * `status`, which a blind refetch-and-hope would blur. Only a `pending`
 * invitation is revocable: the backend answers
 * `error.400.invitation_already_used` / `_revoked` / `_expired` otherwise
 * (each its own key, not a shrug). Also refreshes the member list — the seat
 * the invitation reserved is freed on commit.
 */
export function useRevokeInvitation(
  workspaceId: string
): UseMutationResult<Invitation, StapelApiError, string> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<Invitation, StapelApiError, string> = {
    mutationFn: (invitationId) =>
      api.revokeInvitation(workspaceId, invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.invitations(workspaceId),
      });
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.members(workspaceId),
      });
    },
  };
  return useMutation(options);
}

/**
 * Send the invitation email again (POST /{id}/invitations/{invitationId}/resend,
 * #109). The variable is the invitation id.
 *
 * This is NOT an idempotent "poke": the backend rotates the token and
 * restarts the TTL, so every earlier link — including the one already in the
 * invitee's inbox — stops working, and the row's `expires_at` moves. Hence
 * the invalidation: a table still showing the old expiry would be lying about
 * a live credential. An EXPIRED invitation is accepted on purpose (a dead TTL
 * is the commonest reason to resend); reviving it re-reserves a seat, so a
 * plan ceiling can answer 402 here.
 */
export function useResendInvitation(
  workspaceId: string
): UseMutationResult<Invitation, StapelApiError, string> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<Invitation, StapelApiError, string> = {
    mutationFn: (invitationId) =>
      api.resendInvitation(workspaceId, invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.invitations(workspaceId),
      });
    },
  };
  return useMutation(options);
}

/** The variable for {@link useResetMemberPassword}: whose password, and the
 * (optional) body — omit `password` to have the server generate one. */
export interface MemberPasswordResetVars {
  readonly userId: string;
  readonly body?: MemberPasswordReset;
}

/**
 * Reset a member's password on the organization's order
 * (POST /{id}/members/{userId}/password/reset, #110).
 *
 * **Step-up before the button.** Capability `members.password.reset` is
 * declared `high`, so the backend wraps the endpoint in
 * `requires_verification(scope="sensitive")`. Ask
 * {@link "./queries.js".useCapabilityGate}(workspaceId,
 * "members.password.reset") BEFORE offering the affordance: it answers both
 * "may this caller" and "will a step-up be demanded". A step-up CHALLENGE is
 * then driven by core's client and replayed transparently; the one case that
 * is not transparent is the ENROLLMENT demand (the caller holds no factor to
 * challenge) — read it off `error` with
 * {@link "./stepUp.js".readVerificationEnrollment} and route to enrollment.
 *
 * **The one-shot credential.** `generated_password` comes back exactly once,
 * only when the request omitted `password`, and can never be re-fetched. It
 * is therefore deliberately kept OUT of the query cache: nothing here writes
 * the response with `setQueryData`, and `gcTime: 0` drops the mutation result
 * the moment the screen showing it unmounts. Writing it to a query would
 * mean writing a live credential into every devtools panel AND into
 * `localStorage`, because core's query runtime persists the whole per-user
 * query cache (`createStapelQueryClient`). Hand it to the member out of band.
 *
 * Refreshes the member list (the reset moves the member's first-login state);
 * a target that is not a resettable member of THIS workspace answers one
 * byte-identical 404, never an existence oracle.
 */
export function useResetMemberPassword(
  workspaceId: string
): UseMutationResult<
  MemberPasswordResetResult,
  StapelApiError,
  MemberPasswordResetVars
> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    MemberPasswordResetResult,
    StapelApiError,
    MemberPasswordResetVars
  > = {
    mutationFn: ({ userId, body }) =>
      api.resetMemberPassword(workspaceId, userId, body),
    // The result carries a live credential: never retained past the screen
    // that displays it, and never persisted.
    gcTime: 0,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.members(workspaceId),
      });
    },
  };
  return useMutation(options);
}

/**
 * Update a workspace's SECURITY settings (the `security` block of
 * `PATCH /{id}`, org-program §C3) — `require_mfa` and the first-login
 * `provisioned_user_policies`.
 *
 * Separate from {@link useUpdateWorkspace} because the backend treats this
 * block as a different endpoint in all but the URL: an extra capability
 * (`workspace.security.manage`, declared `high`) plus a step-up on the same
 * `sensitive` scope as the password reset, and turning `require_mfa` on
 * sweeps the current members. See {@link useResetMemberPassword} for how to
 * wire that in front of the control.
 *
 * `provisioned_user_policies` is a LIST since stapel-workspaces 0.13.0 (#90)
 * — independent checkboxes, not alternatives. An explicit `[]` is a
 * deliberate, auditable choice ("demand nothing"), so it is sent as such and
 * never dropped as "empty means unset".
 *
 * MERGES, because the backend does not: `PATCH` assigns `settings` wholesale
 * (`ws.settings = data.settings`), so sending a bare `{security: …}` would
 * silently drop every other key the workspace holds. The merge reads the
 * workspace fresh rather than trusting the detail cache — a stale snapshot
 * here would resurrect settings somebody else has since removed.
 */
export function useUpdateSecuritySettings(
  workspaceId: string
): UseMutationResult<Workspace, StapelApiError, WorkspaceSecuritySettings> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    Workspace,
    StapelApiError,
    WorkspaceSecuritySettings
  > = {
    mutationFn: async (patch) => {
      const current = await api.getWorkspace(workspaceId);
      const settings = (current.settings ?? {}) as Record<string, unknown>;
      const security = (settings["security"] ?? {}) as Record<string, unknown>;
      // `policies_configured` is derived and read-only on the wire — never
      // sent back, whatever a caller spread into the patch.
      const { policies_configured: _derived, ...writable } = {
        ...security,
        ...patch,
      };
      return api.updateWorkspace(workspaceId, {
        settings: { ...settings, security: writable },
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(
        workspacesQueryKeys.detail(workspaceId),
        updated
      );
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.list(),
      });
      // require_mfa ON suspends members without a strong factor; OFF lifts
      // those suspensions. Either way the roster just moved.
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.members(workspaceId),
      });
    },
  };
  return useMutation(options);
}

/**
 * Accept an invitation by its token — the caller joins the workspace. A dead
 * token surfaces a localizable `StapelApiError` (`error.400.invitation_expired`
 * / `error.400.invitation_revoked` / `error.400.invitation_already_used`).
 * Refreshes the workspace list (the new membership appears there).
 */
export function useAcceptInvitation(): UseMutationResult<
  Member,
  StapelApiError,
  InvitationAccept
> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<Member, StapelApiError, InvitationAccept> = {
    mutationFn: (body) => api.acceptInvitation(body),
    onSuccess: (_member, body) => {
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.list(),
      });
      // The preview's `status` moved pending → accepted.
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.invitationPreview(body.token),
      });
    },
  };
  return useMutation(options);
}

/**
 * Mint a login grant for a NOT-yet-registered invitee (POST
 * /invitations/{token}/claim, AllowAny — org-program §B2/§B3). The variable
 * is the invite token; the result carries the single-use `grant_token` to
 * exchange at AUTH's `POST /grant/exchange/` (the auth-react api — this pair
 * deliberately does not call it; see `InviteAcceptFlow`'s `onLoginGrant`
 * seam). 409 `email_already_registered` → switch to login. The invitation is
 * NOT consumed here. The grant token is a credential: never log it.
 */
export function useClaimInvitation(): UseMutationResult<
  InvitationClaim,
  StapelApiError,
  string
> {
  const api = useWorkspacesApi();
  const options: UseMutationOptions<InvitationClaim, StapelApiError, string> = {
    mutationFn: (token) => api.claimInvitation(token),
  };
  return useMutation(options);
}

/**
 * Decline an invitation (POST /invitations/{token}/decline, authenticated +
 * email-match — org-program §B2). The variable is the invite token. Decline ≠
 * revoke — the preview's `status` becomes `declined`.
 */
export function useDeclineInvitation(): UseMutationResult<
  void,
  StapelApiError,
  string
> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (token) => api.declineInvitation(token),
    onSuccess: (_result, token) => {
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.invitationPreview(token),
      });
    },
  };
  return useMutation(options);
}

/**
 * Record the caller's home workspace (PUT /me/preferred-workspace).
 *
 * Invalidates the workspace list, because the list response is where the
 * choice is READ back from (`preferred_workspace_id`) — one round trip, and
 * no window in which the list has arrived but the answer has not.
 *
 * Callers should treat this as fire-and-forget: {@link useWorkspaceSelection}
 * switches the tab locally and never blocks on the round trip. A switch that
 * hangs on a flaky network is worse than a preference that lags one click.
 */
export function useSetPreferredWorkspace(): UseMutationResult<
  PreferredWorkspaceResult,
  StapelApiError,
  PreferredWorkspace
> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    PreferredWorkspaceResult,
    StapelApiError,
    PreferredWorkspace
  > = {
    mutationFn: (body) => api.setPreferredWorkspace(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.list(),
      });
    },
  };
  return useMutation(options);
}

/** Clear the caller's home workspace (DELETE /me/preferred-workspace) — back
 * to the instance default and the rest of the resolution chain. Idempotent. */
export function useClearPreferredWorkspace(): UseMutationResult<
  PreferredWorkspaceResult,
  StapelApiError,
  void
> {
  const api = useWorkspacesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    PreferredWorkspaceResult,
    StapelApiError,
    void
  > = {
    mutationFn: () => api.clearPreferredWorkspace(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspacesQueryKeys.list(),
      });
    },
  };
  return useMutation(options);
}
