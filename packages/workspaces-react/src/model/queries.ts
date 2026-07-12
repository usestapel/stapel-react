import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  MemberPage,
  MembersParams,
  Workspace,
  WorkspaceList,
} from "../api/types.js";
import { useWorkspacesApi } from "./context.js";
import { workspacesQueryKeys } from "./queryKeys.js";

/**
 * Read hooks over the workspaces API. Staleness follows core's query defaults;
 * override per call site via a page that needs fresher data. Keys are
 * namespaced (see `workspacesQueryKeys`).
 */

/** The caller's workspaces — their accepted memberships (GET /). */
export function useWorkspaces(): UseQueryResult<WorkspaceList, StapelApiError> {
  const api = useWorkspacesApi();
  return useQuery({
    queryKey: workspacesQueryKeys.list(),
    queryFn: () => api.listWorkspaces(),
  });
}

/**
 * A single workspace by id (GET /{id}). Disabled until a `workspaceId` is
 * given, so a detail hook can mount before a selection exists.
 */
export function useWorkspace(
  workspaceId: string | null
): UseQueryResult<Workspace, StapelApiError> {
  const api = useWorkspacesApi();
  return useQuery({
    queryKey: workspacesQueryKeys.detail(workspaceId ?? ""),
    queryFn: () => api.getWorkspace(workspaceId as string),
    enabled: workspaceId !== null && workspaceId !== "",
  });
}

/**
 * A page of a workspace's members (GET /{id}/members, anchor-paginated).
 * Disabled until a `workspaceId` is given. Pass `{ anchor, direction, limit,
 * search }` to jump to a specific page or filter; omit for the newest page
 * (default limit 100).
 */
export function useMembers(
  workspaceId: string | null,
  params?: MembersParams
): UseQueryResult<MemberPage, StapelApiError> {
  const api = useWorkspacesApi();
  const p = params ?? {};
  return useQuery({
    queryKey: workspacesQueryKeys.membersPage(workspaceId ?? "", p),
    queryFn: () => api.listMembers(workspaceId as string, p),
    enabled: workspaceId !== null && workspaceId !== "",
  });
}
