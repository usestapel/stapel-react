import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import {
  useMyBlocked,
  useMyFollowers,
  useMyFollowing,
} from "../model/queries.js";

/** Which of the caller's own connection lists to render. */
export type ConnectionKind = "followers" | "following" | "blocked";

/** Render-prop bag for {@link ConnectionList}. */
export interface ConnectionListBag {
  /** Which list this is. */
  readonly kind: ConnectionKind;
  /** The connected users' ids (empty while loading or when none). */
  readonly ids: readonly string[];
  /** The server-reported total (followers/following); for `blocked`, the length. */
  readonly count: number;
  /** The list read is in flight. */
  readonly isLoading: boolean;
  /** The read failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Refetch the list. */
  refetch(): void;
}

/**
 * Headless connection list — renderless followers / following / blocked list for
 * the caller. Selects the read hook by `kind`, normalizes the three response
 * shapes to `{ ids, count }`, and hands a {@link ConnectionListBag} to
 * `children`; bring your own list UI. Zero visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <ConnectionList kind="followers">
 *   {({ ids, count }) => ( ... )}
 * </ConnectionList>
 * ```
 */
export function ConnectionList(props: {
  kind: ConnectionKind;
  children: (bag: ConnectionListBag) => ReactNode;
}): ReactNode {
  // Only the selected list fetches; the other two stay dormant (`enabled: false`).
  const followers = useMyFollowers(props.kind === "followers");
  const following = useMyFollowing(props.kind === "following");
  const blocked = useMyBlocked(props.kind === "blocked");

  const query =
    props.kind === "followers"
      ? followers
      : props.kind === "following"
        ? following
        : blocked;

  let ids: readonly string[] = [];
  let count = 0;
  if (props.kind === "followers" && followers.data) {
    ids = followers.data.followers;
    count = followers.data.count;
  } else if (props.kind === "following" && following.data) {
    ids = following.data.following;
    count = following.data.count;
  } else if (props.kind === "blocked" && blocked.data) {
    ids = blocked.data;
    count = blocked.data.length;
  }

  return props.children({
    kind: props.kind,
    ids,
    count,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch();
    },
  });
}
