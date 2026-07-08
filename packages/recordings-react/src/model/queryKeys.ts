/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "ключи неймспейснуты").
 * Everything under the `"recordings"` root so a host can invalidate the whole
 * module or match a single resource. Persist scope is per-user via core's query
 * runtime (`setPersistUser`). Explicit tuple return types satisfy
 * `--isolatedDeclarations`. One entry per read-operation.
 *
 * Mutations invalidate `all` (the whole module) rather than a narrow key: a
 * created recording or a finalize both shift the list AND a detail read at once,
 * so the broad invalidation keeps every cached read honest without the pair
 * guessing which entries changed.
 */
const ROOT = "recordings" as const;

export const recordingsQueryKeys: {
  readonly all: readonly ["recordings"];
  readonly list: () => readonly ["recordings", "list"];
  detail(recordingId: string): readonly ["recordings", "detail", string];
} = {
  all: [ROOT],
  list: () => [ROOT, "list"],
  detail: (recordingId) => [ROOT, "detail", recordingId],
};
