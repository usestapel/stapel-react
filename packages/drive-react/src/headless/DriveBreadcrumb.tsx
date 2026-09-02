import type { ReactNode } from "react";
import { loadReady, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { Breadcrumbs } from "@stapel/docs-react";
import type { DriveBreadcrumbNode } from "../api/types.js";

/** Render-prop bag for {@link DriveBreadcrumb}. */
export interface BreadcrumbBag {
  /**
   * Root-first ancestors of the current folder, EXCLUDING the workspace root
   * itself (a skin draws that crumb from its own label — there is no folder
   * row for "/"). Empty at the root.
   *
   * A `LoadState`, not an array, because the two sources answer at different
   * times and a breadcrumb bar must never invent the path it is not sure of.
   */
  readonly state: LoadState<readonly DriveBreadcrumbNode[]>;
  /** The last crumb — the folder being shown. `null` at the workspace root. */
  readonly current: DriveBreadcrumbNode | null;
}

const lastOf = (
  trail: readonly DriveBreadcrumbNode[]
): DriveBreadcrumbNode | null => trail[trail.length - 1] ?? null;

/**
 * Headless breadcrumbs for the drive, from whichever source is cheapest.
 *
 * ── Two sources, and why both exist ───────────────────────────────────────
 *
 * `trail` — the free one. Tapping into a folder means the folder's own row
 * was on screen a moment ago, so the navigation that descended ALREADY holds
 * the chain; a search hit likewise arrives with `breadcrumb` materialized
 * server-side. Passing it here costs zero requests, which is the whole point
 * of a rung-at-a-time drive: the trail is a by-product of walking it.
 *
 * No `trail` — the fallback, for the case a by-product cannot cover: a deep
 * link opened straight at `/files/<folder>` with no history behind it. Then
 * this delegates to `@stapel/docs-react`'s `Breadcrumbs`, which walks up
 * `parent_id` over that pair's whole-workspace folder read. It is one extra
 * request and it is the pair that owns folders answering it — not a second
 * ancestor walk written here.
 *
 * So the discipline holds where it matters (browsing costs one read per rung)
 * and the honest exception is explicit rather than hidden in a prefetch.
 */
export function DriveBreadcrumb(props: {
  workspaceId: string;
  /** The folder being shown; `null` = the workspace root. */
  folderId: string | null;
  /** The chain the navigation already holds, root-first, current last. */
  trail?: readonly DriveBreadcrumbNode[];
  children: (bag: BreadcrumbBag) => ReactNode;
}): ReactNode {
  const { trail, children } = props;
  if (trail !== undefined) {
    return children({ state: loadReady(trail), current: lastOf(trail) });
  }
  return (
    <Breadcrumbs workspaceId={props.workspaceId} folderId={props.folderId}>
      {({ state }) => {
        const mapped = mapLoad(
          state,
          (crumbs): readonly DriveBreadcrumbNode[] =>
            crumbs.trail.map((folder) => ({ id: folder.id, name: folder.name }))
        );
        return children({
          state: mapped,
          current: mapped.status === "ready" ? lastOf(mapped.data) : null,
        });
      }}
    </Breadcrumbs>
  );
}
