import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { RelationshipStatus } from "../api/types.js";
import { useRelationship } from "../model/queries.js";
import {
  useBlock,
  useFollow,
  useUnblock,
  useUnfollow,
} from "../model/mutations.js";

/** Render-prop bag for {@link Relationship}. */
export interface RelationshipBag {
  /** The current caller↔target status once loaded, else null. */
  readonly status: RelationshipStatus | null;
  /** True once `status === "following"`. */
  readonly isFollowing: boolean;
  /** True once `status === "blocked"`. */
  readonly isBlocked: boolean;
  /** The initial status read is in flight. */
  readonly isLoading: boolean;
  /** Any relationship action is in flight. */
  readonly isMutating: boolean;
  /** The read or an action failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Follow the target user. */
  follow(): void;
  /** Unfollow the target user. */
  unfollow(): void;
  /** Block the target user. */
  block(): void;
  /** Unblock the target user. */
  unblock(): void;
}

/**
 * Headless relationship control — renderless follow / unfollow / block / unblock
 * for a single target user, plus the live status. Wires {@link useRelationship}
 * and the four action mutations and hands a {@link RelationshipBag} to
 * `children`; bring your own buttons / menu UI. Zero visual opinion
 * (frontend-standard §2).
 *
 * ```tsx
 * <Relationship userId={id}>
 *   {({ isFollowing, follow, unfollow }) => ( ... )}
 * </Relationship>
 * ```
 */
export function Relationship(props: {
  userId: string;
  children: (bag: RelationshipBag) => ReactNode;
}): ReactNode {
  const query = useRelationship(props.userId);
  const followMutation = useFollow();
  const unfollowMutation = useUnfollow();
  const blockMutation = useBlock();
  const unblockMutation = useUnblock();

  const mutations = [
    followMutation,
    unfollowMutation,
    blockMutation,
    unblockMutation,
  ];
  // The latest action's echoed status wins; fall back to the read.
  const actioned = mutations.find((m) => m.isSuccess && m.data)?.data;
  const status = ((actioned?.status ?? query.data?.status) ??
    null) as RelationshipStatus | null;

  return props.children({
    status,
    isFollowing: status === "following",
    isBlocked: status === "blocked",
    isLoading: query.isLoading,
    isMutating: mutations.some((m) => m.isPending),
    isError: query.isError || mutations.some((m) => m.isError),
    error:
      query.error ?? mutations.find((m) => m.error)?.error ?? null,
    follow: () => {
      followMutation.mutate(props.userId);
    },
    unfollow: () => {
      unfollowMutation.mutate(props.userId);
    },
    block: () => {
      blockMutation.mutate(props.userId);
    },
    unblock: () => {
      unblockMutation.mutate(props.userId);
    },
  });
}
