/**
 * Namespaced TanStack Query keys (frontend-standard §2). Everything under the
 * `"drive"` root so a host can invalidate this product surface without
 * touching `"docs"` — the two namespaces coexist in one cache on purpose: the
 * rows come from the docs pair's keys, the drive-only reads from these.
 *
 * ── One key per FOLDER, never one key for the tree ────────────────────────
 *
 * `children(workspaceId, folderId)` is the categories-cascade discipline in
 * key form (spec §4): opening a folder mints ONE cache entry for that folder's
 * direct children, so a deep drive costs one request per rung a person
 * actually opened, and closing a folder never invalidates its siblings. The
 * workspace root is `folderId: null`, spelled `"root"` in the key so it cannot
 * collide with a folder whose id is the literal string "null".
 *
 * Explicit tuple return types satisfy `--isolatedDeclarations`.
 */
import type { DriveSearchParams } from "../api/types.js";

const ROOT = "drive" as const;

export const driveQueryKeys: {
  readonly all: readonly ["drive"];
  /** Every folder rung, whatever its id — the PREFIX an optimistic star walks.
   * A prefix belongs in the factory like every other key: an inline
   * `[...all, "children"]` at a call site is exactly the drift
   * `stapel/query-keys-from-factory` exists to stop. */
  readonly allChildren: readonly ["drive", "children"];
  readonly allStarred: readonly ["drive", "starred"];
  /** One zip document's browsed listing. */
  archive(documentId: string): readonly ["drive", "archive", string];
  readonly allRecents: readonly ["drive", "recents"];
  children(
    workspaceId: string,
    folderId: string | null
  ): readonly ["drive", "children", string, string];
  starred(workspaceId: string): readonly ["drive", "starred", string];
  recents(workspaceId: string): readonly ["drive", "recents", string];
  search(
    params: DriveSearchParams
  ): readonly ["drive", "search", DriveSearchParams];
} = {
  all: [ROOT],
  allChildren: [ROOT, "children"],
  allStarred: [ROOT, "starred"],
  archive: (documentId) => [ROOT, "archive", documentId],
  allRecents: [ROOT, "recents"],
  children: (workspaceId, folderId) => [
    ROOT,
    "children",
    workspaceId,
    folderId ?? "root",
  ],
  starred: (workspaceId) => [ROOT, "starred", workspaceId],
  recents: (workspaceId) => [ROOT, "recents", workspaceId],
  // The params object rides in the key so a different `q` (or a different
  // ceiling) is a different cached result, not the same one refetched.
  search: (params) => [ROOT, "search", params],
};
