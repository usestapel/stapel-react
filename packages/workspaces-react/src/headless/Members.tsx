import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
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
   * The roster read, as a state a skin cannot flatten — render it with core's
   * `matchList`. This is one page (default 100); a full pager is out of scope
   * for this renderless view (bring your own via `useMembers`' `params` for
   * anchor pagination).
   *
   * Separate from {@link writeError} on purpose: "the roster could not be
   * loaded" and "your invite was rejected" are different sentences, and the
   * old merged `isError` could only produce one of them.
   */
  readonly state: LoadState<readonly Member[]>;
  /** An invite, a role change, or a removal failed. Never the read — that is
   * {@link state}. */
  readonly writeError: StapelApiError | null;
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
 *   {({ state, invite, updateRole, remove }) => ( ... )}
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
    state: mapLoad(loadStateFromQuery(query), (page) => page.items),
    writeError:
      inviteMutation.error ?? roleMutation.error ?? removeMutation.error ?? null,
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
