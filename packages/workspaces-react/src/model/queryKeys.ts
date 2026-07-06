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
} = {
  all: [ROOT],
  list: () => [ROOT, "list"],
  detail: (workspaceId) => [ROOT, "detail", workspaceId],
  members: (workspaceId) => [ROOT, "members", workspaceId],
};
