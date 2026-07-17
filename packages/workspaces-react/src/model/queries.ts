import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
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

/**
 * The caller's workspaces — their accepted memberships (GET /).
 *
 * Gated on {@link useActiveSessionReady} (owner-diagnosed live incident,
 * 2026-07-17): unlike {@link useWorkspace}/{@link useMembers} below (both
 * naturally disabled until a `workspaceId` is picked), this is the top-level
 * list hook with nothing else to gate it — it fires the instant a component
 * mounts. Without the session ready-gate this is exactly the shape of hook
 * that raced a session still bootstrapping (e.g. right after a QR
 * `session_share` scan set fresh cookies this JS runtime hadn't caught up
 * to yet) and read a live session as "expired" before it had a chance to
 * resolve — zero manual `enabled` wiring needed at each call site by design.
 */
export function useWorkspaces(): UseQueryResult<WorkspaceList, StapelApiError> {
  const api = useWorkspacesApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: workspacesQueryKeys.list(),
    queryFn: () => api.listWorkspaces(),
    enabled: sessionReady,
  });
}

/**
 * A single workspace by id (GET /{id}). Disabled until a `workspaceId` is
 * given, so a detail hook can mount before a selection exists — AND until
 * the session is ready (a `workspaceId` can be known synchronously, e.g.
 * from a URL param, before the session has finished bootstrapping).
 */
export function useWorkspace(
  workspaceId: string | null
): UseQueryResult<Workspace, StapelApiError> {
  const api = useWorkspacesApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: workspacesQueryKeys.detail(workspaceId ?? ""),
    queryFn: () => api.getWorkspace(workspaceId as string),
    enabled: sessionReady && workspaceId !== null && workspaceId !== "",
  });
}

/**
 * A page of a workspace's members (GET /{id}/members, anchor-paginated).
 * Disabled until a `workspaceId` is given (and the session is ready — see
 * {@link useWorkspace}). Pass `{ anchor, direction, limit, search }` to jump
 * to a specific page or filter; omit for the newest page (default limit 100).
 */
export function useMembers(
  workspaceId: string | null,
  params?: MembersParams
): UseQueryResult<MemberPage, StapelApiError> {
  const api = useWorkspacesApi();
  const sessionReady = useActiveSessionReady();
  const p = params ?? {};
  return useQuery({
    queryKey: workspacesQueryKeys.membersPage(workspaceId ?? "", p),
    queryFn: () => api.listMembers(workspaceId as string, p),
    enabled: sessionReady && workspaceId !== null && workspaceId !== "",
  });
}
