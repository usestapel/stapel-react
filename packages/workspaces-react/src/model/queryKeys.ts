import type { MembersParams } from "../api/types.js";

/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "ключи неймспейснуты").
 * Everything under the `"workspaces"` root so a host can invalidate the whole
 * module or match a single resource. Persist scope is per-user via core's query
 * runtime (`setPersistUser`). Explicit tuple return types satisfy
 * `--isolatedDeclarations`. One entry per read-operation.
 */
const ROOT = "workspaces" as const;

export const workspacesQueryKeys: {
  readonly all: readonly ["workspaces"];
  list(): readonly ["workspaces", "list"];
  detail(workspaceId: string): readonly ["workspaces", "detail", string];
  members(workspaceId: string): readonly ["workspaces", "members", string];
  membersPage(
    workspaceId: string,
    params: MembersParams
  ): readonly ["workspaces", "members", string, MembersParams];
} = {
  all: [ROOT],
  list: () => [ROOT, "list"],
  detail: (workspaceId) => [ROOT, "detail", workspaceId],
  // The bare 3-tuple is a valid prefix of membersPage's 4-tuple, so
  // invalidating `members(workspaceId)` (mutations.ts) drops every page.
  members: (workspaceId) => [ROOT, "members", workspaceId],
  membersPage: (workspaceId, params) => [ROOT, "members", workspaceId, params],
};
