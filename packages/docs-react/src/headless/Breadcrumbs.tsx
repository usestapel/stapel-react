import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { DocFolder } from "../api/types.js";
import { useFolders } from "../model/queries.js";
import { folderTrail } from "../model/folderTree.js";

/** What a ready {@link BreadcrumbsBag.state} carries. */
export interface BreadcrumbTrail {
  /** Root → … → the current folder. Empty at the workspace root. */
  readonly trail: readonly DocFolder[];
  /** The current folder (last trail entry), `null` at the workspace root. */
  readonly current: DocFolder | null;
}

/** Render-prop bag for {@link Breadcrumbs}. */
export interface BreadcrumbsBag {
  /** The trail as a state a skin cannot flatten (core's `LoadState`;
   * `stapel/no-flattened-load-state`) — an empty trail is only the workspace
   * root when the folder read actually succeeded. */
  readonly state: LoadState<BreadcrumbTrail>;
}

/**
 * Headless breadcrumbs — the ancestor trail for a folder, walked up
 * `parent_id` over the workspace's folder list (same cache entry as
 * `FolderTree` — no extra wire read). Bring your own separator/links. Zero
 * visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <Breadcrumbs workspaceId="ws-1" folderId={folderId}>
 *   {({ state }) => matchLoad(state, { loading, failed, ready: ({ trail }) => … })}
 * </Breadcrumbs>
 * ```
 */
export function Breadcrumbs(props: {
  workspaceId: string;
  /** The folder to trail to; `null` = the workspace root (empty trail). */
  folderId: string | null;
  children: (bag: BreadcrumbsBag) => ReactNode;
}): ReactNode {
  const query = useFolders(props.workspaceId);
  return props.children({
    state: mapLoad(loadStateFromQuery(query), (folders): BreadcrumbTrail => {
      const trail = folderTrail(folders, props.folderId);
      return {
        trail,
        current: trail.length > 0 ? (trail[trail.length - 1] ?? null) : null,
      };
    }),
  });
}
