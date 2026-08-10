import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { DocFolder } from "../api/types.js";
import { useFolders } from "../model/queries.js";
import { folderTrail } from "../model/folderTree.js";

/** Render-prop bag for {@link Breadcrumbs}. */
export interface BreadcrumbsBag {
  /** Root → … → the current folder. Empty at the workspace root. */
  readonly trail: readonly DocFolder[];
  /** The current folder (last trail entry), `null` at the workspace root. */
  readonly current: DocFolder | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
}

/**
 * Headless breadcrumbs — the ancestor trail for a folder, walked up
 * `parent_id` over the workspace's folder list (same cache entry as
 * `FolderTree` — no extra wire read). Bring your own separator/links. Zero
 * visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <Breadcrumbs workspaceId="ws-1" folderId={folderId}>
 *   {({ trail }) => trail.map((f) => <a key={f.id}>{f.name}</a>)}
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
  const trail = folderTrail(query.data ?? [], props.folderId);
  return props.children({
    trail,
    current: trail.length > 0 ? (trail[trail.length - 1] ?? null) : null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
  });
}
