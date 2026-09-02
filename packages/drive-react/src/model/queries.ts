import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type { DocDocument, DocFolder } from "@stapel/docs-react";
import type {
  DriveSearchHit,
  DriveSearchParams,
  StarredListing,
} from "../api/types.js";
import { useDriveApi } from "./context.js";
import { driveQueryKeys } from "./queryKeys.js";

/**
 * Read hooks over the five drive operations (frontend-standard §2). Keys are
 * namespaced (`driveQueryKeys`). Every hook is gated on
 * {@link useActiveSessionReady} — the fleet's owner-diagnosed 2026-07-17
 * incident: a list hook has no natural `enabled` of its own, which is exactly
 * the shape that races a still-bootstrapping session — plus a non-empty scope.
 */

/**
 * The DIRECT children of one folder (`folderId: null` = the workspace roots).
 *
 * One request per rung, one cache entry per folder id: opening `/a/b/c` costs
 * three folder reads, not a tree sync, and a sibling nobody opened is never
 * fetched. This is the categories cascade discipline the spec names (§4), and
 * the reason this pair reads `GET /folders?parent_id=` instead of
 * docs-react's whole-tree `useFolders`.
 */
export function useFolderChildren(
  workspaceId: string,
  folderId: string | null
): UseQueryResult<DocFolder[], StapelApiError> {
  const api = useDriveApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: driveQueryKeys.children(workspaceId, folderId),
    queryFn: () => api.listFolderChildren(workspaceId, folderId),
    enabled: sessionReady && workspaceId.length > 0,
  });
}

/** Everything the requesting user starred in the workspace (live rows only). */
export function useStarred(
  workspaceId: string
): UseQueryResult<StarredListing, StapelApiError> {
  const api = useDriveApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: driveQueryKeys.starred(workspaceId),
    queryFn: () => api.listStarred(workspaceId),
    enabled: sessionReady && workspaceId.length > 0,
  });
}

/** Documents this user reached most recently, newest first. */
export function useRecents(
  workspaceId: string
): UseQueryResult<DocDocument[], StapelApiError> {
  const api = useDriveApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: driveQueryKeys.recents(workspaceId),
    queryFn: () => api.listRecents(workspaceId),
    enabled: sessionReady && workspaceId.length > 0,
  });
}

/**
 * Tree-wide name search. The hook takes `q` FINISHED — debouncing is the
 * component's job (`DriveSearchField` holds the timer), because the delay a
 * search box needs is a property of the input, not of the read: a hook that
 * debounced internally would also debounce a `q` restored from a URL, and
 * would fire one wire read per keystroke for any caller that already debounced.
 *
 * An empty `q` runs NOTHING. The backend refuses a blank query with a 400
 * (`?q=` is mandatory precisely so a typo never lists a whole workspace), so
 * an empty box is a disabled query here rather than an error there.
 */
export function useDriveSearch(
  params: DriveSearchParams
): UseQueryResult<DriveSearchHit[], StapelApiError> {
  const api = useDriveApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: driveQueryKeys.search(params),
    queryFn: () => api.search(params),
    enabled:
      sessionReady && params.workspaceId.length > 0 && params.q.trim().length > 0,
  });
}
