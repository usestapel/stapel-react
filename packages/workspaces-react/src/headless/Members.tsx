import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { Member, MemberInvite } from "../api/types.js";
import { useMembers } from "../model/queries.js";
import {
  useInviteMembers,
  useRemoveMember,
  useUpdateMemberRole,
} from "../model/mutations.js";
import type { MemberRoleChange } from "../model/mutations.js";

/** Render-prop bag for {@link Members}. */
export interface MembersBag {
  /**
   * The workspace's members once loaded (empty before load). This is one page
   * (default 100) — the roster's own {@link Member.email}/`search` narrows
   * further; a full pager is out of scope for this renderless view (bring
   * your own via `useMembers`' `params` for anchor pagination).
   */
  readonly members: readonly Member[];
  /** The initial member-list load is in flight. */
  readonly isLoading: boolean;
  /** The read, an invite, a role change, or a removal failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Invite one or more emails at a role. */
  invite(body: MemberInvite): void;
  /** An invite call is in flight. */
  readonly isInviting: boolean;
  /** Change a member's role. */
  updateRole(change: MemberRoleChange): void;
  /** A role-change call is in flight. */
  readonly isUpdatingRole: boolean;
  /** Remove a member by `userId`. */
  remove(userId: string): void;
  /** A removal call is in flight. */
  readonly isRemoving: boolean;
  /** Refetch the member list from the server. */
  refetch(): void;
}

/**
 * Headless member roster — a renderless view + invite / role-change / removal
 * controls over one workspace's members. Wires {@link useMembers},
 * {@link useInviteMembers}, {@link useUpdateMemberRole}, and
 * {@link useRemoveMember} and hands a {@link MembersBag} to `children`; bring your
 * own roster / invite form / role menu. Zero visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <Members workspaceId={id}>
 *   {({ members, invite, updateRole, remove }) => ( ... )}
 * </Members>
 * ```
 */
export function Members(props: {
  workspaceId: string;
  children: (bag: MembersBag) => ReactNode;
}): ReactNode {
  const query = useMembers(props.workspaceId);
  const inviteMutation = useInviteMembers(props.workspaceId);
  const roleMutation = useUpdateMemberRole(props.workspaceId);
  const removeMutation = useRemoveMember(props.workspaceId);
  return props.children({
    members: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError:
      query.isError ||
      inviteMutation.isError ||
      roleMutation.isError ||
      removeMutation.isError,
    error:
      query.error ??
      inviteMutation.error ??
      roleMutation.error ??
      removeMutation.error ??
      null,
    invite: (body) => {
      inviteMutation.mutate(body);
    },
    isInviting: inviteMutation.isPending,
    updateRole: (change) => {
      roleMutation.mutate(change);
    },
    isUpdatingRole: roleMutation.isPending,
    remove: (userId) => {
      removeMutation.mutate(userId);
    },
    isRemoving: removeMutation.isPending,
    refetch: () => {
      void query.refetch();
    },
  });
}
