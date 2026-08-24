/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "keys are namespaced").
 * Everything under the `"translate"` root so a host can invalidate the whole
 * module or match a single resource. Persist scope is per-user via core's query
 * runtime (`setPersistUser`). Explicit tuple return types satisfy
 * `--isolatedDeclarations`. Add one entry per read-operation as you wire hooks.
 */
const ROOT = "translate" as const;

export const translateQueryKeys: {
  readonly all: readonly ["translate"];
} = {
  all: [ROOT],
};
