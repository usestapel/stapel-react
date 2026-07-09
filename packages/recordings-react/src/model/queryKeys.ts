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
import type { RecordingListParams } from "../api/types.js";

const ROOT = "recordings" as const;

export const recordingsQueryKeys: {
  readonly all: readonly ["recordings"];
  list(
    params: RecordingListParams
  ): readonly ["recordings", "list", RecordingListParams];
  detail(recordingId: string): readonly ["recordings", "detail", string];
} = {
  all: [ROOT],
  // The list key carries its params so the own-recordings view and a
  // per-workspace view are cached distinctly (a workspace filter is a different
  // read surface, not the same list).
  list: (params) => [ROOT, "list", params],
  detail: (recordingId) => [ROOT, "detail", recordingId],
};
