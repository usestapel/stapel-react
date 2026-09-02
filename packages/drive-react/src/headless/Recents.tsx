import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { useRecents } from "../model/queries.js";
import { useToggleStar } from "../model/mutations.js";
import { documentRow } from "./rows.js";
import type { DriveRow } from "./rows.js";

/** Render-prop bag for {@link Recents}. */
export interface RecentsBag {
  /**
   * Documents this user reached most recently, newest first — server order,
   * kept verbatim (the ordering IS the meaning of this list).
   *
   * Documents only: the backend writes a recent on content read, download-URL
   * issuance and accepted save, and folders are not "opened" in that sense
   * (Drive parity, spec §3.2). A skin that showed folders here would be
   * drawing an empty half of a list forever.
   */
  readonly state: LoadState<readonly DriveRow[]>;
  toggleStar(row: DriveRow, starred: boolean): void;
  readonly isTogglingStar: boolean;
  refetch(): void;
}

/** Headless recents tab — `GET /recents?workspace_id=`. */
export function Recents(props: {
  workspaceId: string;
  children: (bag: RecentsBag) => ReactNode;
}): ReactNode {
  const query = useRecents(props.workspaceId);
  const toggle = useToggleStar();
  return props.children({
    state: mapLoad(loadStateFromQuery(query), (documents) =>
      documents.map(documentRow)
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
