import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type { Member, MemberInvite, MembersParams } from "../api/types.js";
import { useMembers } from "../model/queries.js";
import {
  useInviteMembers,
  useRemoveMember,
  useRenameMember,
  useUpdateMemberRole,
} from "../model/mutations.js";
import type { MemberRename, MemberRoleChange } from "../model/mutations.js";

/**
 * Where in the anchor walk the current page sits — the half of the roster a
 * pager needs and a count of rows cannot supply.
 *
 * ANCHOR, not offset: a page is addressed by the opaque `next_anchor` of the
 * page before it, so a member removed while an admin reads never skews the
 * next page. There is no "page 3" to jump to, which is why the shape carries
 * two cursors and no index.
 */
export interface MembersPageInfo {
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
  /** Pass as `params.anchor` with `direction: "next"` to walk forward. */
  readonly nextAnchor: string | null;
  /** Pass as `params.anchor` with `direction: "prev"` to walk back. */
  readonly prevAnchor: string | null;
  /** Rows on THIS page. Never a count of the roster — see `rosterComplete`. */
  readonly count: number;
}

/** Render-prop bag for {@link Members}. */
export interface MembersBag {
  /**
   * The roster read, as a state a skin cannot flatten — render it with core's
   * `matchList`. This is ONE page: which one is decided by the `params` the
   * caller passes (default: the newest page, limit 100), and {@link page}
   * says whether there is another.
   *
   * Separate from {@link writeError} on purpose: "the roster could not be
   * loaded" and "your invite was rejected" are different sentences, and the
   * old merged `isError` could only produce one of them.
   */
  readonly state: LoadState<readonly Member[]>;
  /**
   * Whether {@link state} holds the WHOLE roster — the read succeeded and the
   * page reports no `has_next`.
   *
   * A skin may only reason about the roster as a set — "is this the last
   * owner?", "how many admins are there?" — while this is `true`. On one page
   * of a longer roster those counts are counts of a page, and a control gated
   * on one would refuse a removal the backend would have allowed, which is a
   * worse defect than the ungated button it replaced. `false` while the read
   * is loading or failed: an unknown roster is never a complete one.
   */
  readonly rosterComplete: boolean;
  /** The walk position, or `null` while the page has not arrived. A pager
   * with no page cannot claim there is a next one. */
  readonly page: MembersPageInfo | null;
  /** An invite, a role change, a rename or a removal failed. Never the read —
   * that is {@link state}. */
  readonly writeError: StapelApiError | null;
  /** Invite one or more emails at a role. */
  invite(body: MemberInvite): void;
  /** An invite call is in flight. */
  readonly isInviting: boolean;
  /** Change a member's role. */
  updateRole(change: MemberRoleChange): void;
  /** A role-change call is in flight. */
  readonly isUpdatingRole: boolean;
  /** Correct a member's display name — the CANONICAL one (stapel-profiles),
   * not a workspace-local note. `displayName: null` clears it. */
  rename(change: MemberRename): void;
  /** A rename call is in flight. */
  readonly isRenaming: boolean;
  /** Remove a member by `userId`. */
  remove(userId: string): void;
  /** A removal call is in flight. */
  readonly isRemoving: boolean;
  /** Refetch the member list from the server. */
  refetch(): void;
}

/**
 * Headless member roster — a renderless view + invite / role-change / rename /
 * removal controls over one workspace's members. Wires {@link useMembers},
 * {@link useInviteMembers}, {@link useUpdateMemberRole},
 * {@link useRenameMember} and {@link useRemoveMember} and hands a
 * {@link MembersBag} to `children`; bring your own roster / invite form / role
 * menu. Zero visual opinion (frontend-standard §2).
 *
 * `params` is the anchor page to read — the caller owns the walk, because the
 * cursor belongs to the screen's state, not to this component's. Omitted, it
 * reads the newest page, exactly as before.
 *
 * ```tsx
 * <Members workspaceId={id} params={{ anchor, direction: "next", search }}>
 *   {({ state, page, invite, updateRole, remove }) => ( ... )}
 * </Members>
 * ```
 */
export function Members(props: {
  workspaceId: string;
  params?: MembersParams;
  children: (bag: MembersBag) => ReactNode;
}): ReactNode {
  const query = useMembers(props.workspaceId, props.params);
  const inviteMutation = useInviteMembers(props.workspaceId);
  const roleMutation = useUpdateMemberRole(props.workspaceId);
  const renameMutation = useRenameMember(props.workspaceId);
  const removeMutation = useRemoveMember(props.workspaceId);
  const data = query.data;
  return props.children({
    state: mapLoad(loadStateFromQuery(query), (page) => page.items),
    rosterComplete: data !== undefined && !data.has_next && !data.has_prev,
    page:
      data === undefined
        ? null
        : {
            hasNext: data.has_next,
            hasPrev: data.has_prev,
            nextAnchor: data.next_anchor ?? null,
            prevAnchor: data.prev_anchor ?? null,
            count: data.count,
          },
    writeError:
      inviteMutation.error ??
      roleMutation.error ??
      renameMutation.error ??
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
    rename: (change) => {
      renameMutation.mutate(change);
    },
    isRenaming: renameMutation.isPending,
    remove: (userId) => {
      removeMutation.mutate(userId);
    },
    isRemoving: removeMutation.isPending,
    refetch: () => {
      void query.refetch();
    },
  });
}
