import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { useStarred } from "../model/queries.js";
import { useToggleStar } from "../model/mutations.js";
import { driveRows } from "./rows.js";
import type { DriveRow } from "./rows.js";

/** Render-prop bag for {@link Starred}. */
export interface StarredBag {
  /**
   * The starred folders and documents as ONE row list, folders first — the
   * same {@link DriveRow} shape the folder listing hands a skin, so the
   * starred tab reuses the row component instead of growing a second one.
   */
  readonly state: LoadState<readonly DriveRow[]>;
  /** Unstar (or re-star) from the tab itself, optimistically. */
  toggleStar(row: DriveRow, starred: boolean): void;
  readonly isTogglingStar: boolean;
  refetch(): void;
}

/**
 * Headless starred tab — `GET /starred?workspace_id=`.
 *
 * Live rows only, by the backend's choice: a trashed item drops out of this
 * listing but KEEPS its star until purge, so restoring it brings the bookmark
 * back. Nothing here needs to model that — it is simply what the endpoint
 * answers — but a skin should not claim "you unstarred it" when a row
 * disappears after a trash.
 */
export function Starred(props: {
  workspaceId: string;
  children: (bag: StarredBag) => ReactNode;
}): ReactNode {
  const query = useStarred(props.workspaceId);
  const toggle = useToggleStar();
  return props.children({
    state: mapLoad(loadStateFromQuery(query), (listing) =>
      driveRows(listing.folders, listing.documents)
    ),
    toggleStar: (row, starred) => {
      toggle.mutate({ target: { kind: row.kind, id: row.id }, starred });
    },
    isTogglingStar: toggle.isPending,
    refetch: () => {
      void query.refetch();
    },
  });
}
