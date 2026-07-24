import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  Member,
  MemberInvite,
  MemberInviteResult,
  InvitationAccept,
  InvitationClaim,
  Workspace,
  WorkspaceCreate,
  WorkspaceUpdate,
} from "../api/types.js";
import { useWorkspacesApi } from "./context.js";
import { workspacesQueryKeys } from "./queryKeys.js";

/**
 * Write hooks (frontend-standard §2 — "мутации с инвалидацией"). Each mutation
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
