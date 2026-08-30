/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "keys are namespaced").
 * Everything under the `"vocabularies"` root so a host can invalidate the whole
 * module or match a single resource. Explicit tuple return types satisfy
 * `--isolatedDeclarations`.
 *
 * Only ONE read is keyed here, and that is not an oversight: a term SEARCH is
 * not a cacheable resource — it is superseded per keystroke and its answer is
 * scoped to a dropdown that is about to close — so `useTermSearch` owns its own
 * in-flight state and never enters the cache. `useTermLabels` is the opposite:
 * a stable `{code: label}` for codes a page already holds, worth caching across
 * every control that shows the same term, which is why it is a query.
 */
const ROOT = "vocabularies" as const;

export const vocabulariesQueryKeys: {
  readonly all: readonly ["vocabularies"];
  termLabels: (
    vocabulary: string,
    level: string,
    codes: readonly string[]
  ) => readonly ["vocabularies", "termLabels", string, string, string];
} = {
  all: [ROOT],
  // The codes are sorted and joined into ONE key segment: two controls asking
  // for the same set in a different order are the same read, and an array
  // segment would make them two cache entries and two round trips.
  termLabels: (vocabulary, level, codes) => [
    ROOT,
    "termLabels",
    vocabulary,
    level,
    [...codes].sort().join(","),
  ],
};
