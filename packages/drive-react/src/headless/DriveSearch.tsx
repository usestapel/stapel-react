import type { ReactNode } from "react";
import { loadStateFromQuery } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { useDriveSearch } from "../model/queries.js";
import type { DriveSearchHit } from "../api/types.js";

/** Render-prop bag for {@link DriveSearch}. */
export interface DriveSearchBag {
  /**
   * The hits for `q`, each carrying the server-materialized breadcrumb of its
   * CONTAINER — so a result list costs exactly one request and a person can
   * see WHERE the match lives without a second read per row.
   */
  readonly state: LoadState<readonly DriveSearchHit[]>;
  /** The query the state answers (echoed back so a skin can title the list). */
  readonly q: string;
  /** True while `q` is blank — nothing was asked, so nothing is loading. */
  readonly idle: boolean;
  refetch(): void;
}

/**
 * Headless name search — `GET /search?q=`, workspace-scoped and tree-wide.
 *
 * `q` arrives FINISHED. The debounce lives in the component that owns the
 * input (`DriveSearchField` in the skin), not here: a hook that debounced
 * internally would also delay a `q` restored from a URL or picked from a
 * suggestion, and would double the delay for any caller that already
 * debounced. What this bag does own is the blank case — an empty box asks
 * nothing (the backend 400s on a blank `q` on purpose), and `idle` is how a
 * skin tells "type something" from "no results".
 */
export function DriveSearch(props: {
  workspaceId: string;
  /** The finished query. Blank leaves the bag idle. */
  q: string;
  /** Ceiling on hits; the server's own default applies when omitted. */
  limit?: number;
  children: (bag: DriveSearchBag) => ReactNode;
}): ReactNode {
  const query = useDriveSearch({
    workspaceId: props.workspaceId,
    q: props.q,
    ...(props.limit !== undefined ? { limit: props.limit } : {}),
  });
  return props.children({
    state: loadStateFromQuery(query),
    q: props.q,
    idle: props.q.trim().length === 0,
    refetch: () => {
      void query.refetch();
    },
  });
}
