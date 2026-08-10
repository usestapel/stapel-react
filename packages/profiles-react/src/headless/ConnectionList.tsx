import type { ReactNode } from "react";
import { isLoadReady, loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import {
  useMyBlocked,
  useMyFollowers,
  useMyFollowing,
} from "../model/queries.js";

/** Which of the caller's own connection lists to render. */
export type ConnectionKind = "followers" | "following" | "blocked";

/** The two things a landed connection read carries. */
interface ConnectionData {
  readonly ids: readonly string[];
  readonly count: number;
}

/** Render-prop bag for {@link ConnectionList}. */
export interface ConnectionListBag {
  /** Which list this is. */
  readonly kind: ConnectionKind;
  /**
   * The connected users' ids as a load state — render it with `matchList`
   * (@stapel/core). The ids live behind the discriminant so "nobody follows
   * you" cannot be spelled the same way as "we could not ask".
   */
  readonly state: LoadState<readonly string[]>;
  /**
   * The server-reported total (followers/following); for `blocked`, the
   * length of the list. `undefined` until the read lands — a `0` next to a
   * failed read is the same lie in a smaller font.
   */
  readonly count: number | undefined;
  /** Refetch the list. */
  refetch(): void;
}

/**
 * Headless connection list — renderless followers / following / blocked list for
 * the caller. Selects the read hook by `kind`, normalizes the three response
 * shapes to one `LoadState` of ids plus a count, and hands a
 * {@link ConnectionListBag} to `children`; bring your own list UI. Zero visual
 * opinion (frontend-standard §2).
 *
 * ```tsx
 * <ConnectionList kind="followers">
 *   {({ state, count }) =>
 *     matchList(state, {
 *       loading: () => <Spinner />,
 *       failed: (error) => <ErrorAlert error={error} />,
 *       empty: () => <p>{t("profiles.list.empty")}</p>,
 *       ready: (ids) => <List ids={ids} total={count} />,
 *     })
 *   }
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

  // Each response shape normalized WITHIN its load state — the three answers
  // stay three all the way to the render prop.
  const data: LoadState<ConnectionData> =
    props.kind === "followers"
      ? mapLoad(loadStateFromQuery(followers), (page) => ({
          ids: page.followers,
          count: page.count,
        }))
      : props.kind === "following"
        ? mapLoad(loadStateFromQuery(following), (page) => ({
            ids: page.following,
            count: page.count,
          }))
        : mapLoad(loadStateFromQuery(blocked), (ids) => ({
            ids,
            count: ids.length,
          }));

  return props.children({
    kind: props.kind,
    state: mapLoad(data, (loaded) => loaded.ids),
    count: isLoadReady(data) ? data.data.count : undefined,
    refetch: () => {
      void query.refetch();
    },
  });
}
