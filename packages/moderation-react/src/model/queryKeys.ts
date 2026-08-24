/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "keys are
 * namespaced"). Everything under the `"moderation"` root so a host can
 * invalidate the whole module or match a single resource.
 *
 * The two PREFIX keys (`cases`, `sanctions`, `appealQueue`) exist so a write
 * can invalidate every filtered page of a list without knowing which filters
 * are mounted: a verdict changes one case AND removes it from whichever queue
 * page somebody is looking at, and a client that only invalidated the exact
 * filter key it wrote through would leave a resolved case sitting in a
 * colleague's open-cases table.
 */
const ROOT = "moderation" as const;

/** Filters folded to a stable key part — an object's property ORDER is not
 * stable across builders, and a query key that depends on it splits one cache
 * entry into two. */
export type FiltersKey = string;

export function filtersKey(
  filters: Readonly<Record<string, string | number | undefined>>
): FiltersKey {
  return Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
}

export const moderationQueryKeys: {
  readonly all: readonly ["moderation"];
  readonly policy: (targetType: string) => readonly ["moderation", "policy", string];
  readonly myReports: readonly ["moderation", "myReports"];
  readonly myAppeals: readonly ["moderation", "myAppeals"];
  readonly cases: readonly ["moderation", "cases"];
  readonly casePage: (
    filters: FiltersKey
  ) => readonly ["moderation", "cases", string];
  readonly case: (caseId: string) => readonly ["moderation", "case", string];
  readonly caseEvents: (
    caseId: string
  ) => readonly ["moderation", "caseEvents", string];
  readonly stats: readonly ["moderation", "stats"];
  readonly sanctions: readonly ["moderation", "sanctions"];
  readonly sanctionPage: (
    filters: FiltersKey
  ) => readonly ["moderation", "sanctions", string];
  readonly appealQueue: readonly ["moderation", "appealQueue"];
  readonly appealQueuePage: (
    filters: FiltersKey
  ) => readonly ["moderation", "appealQueue", string];
} = {
  all: [ROOT],
  policy: (targetType) => [ROOT, "policy", targetType],
  myReports: [ROOT, "myReports"],
  myAppeals: [ROOT, "myAppeals"],
  cases: [ROOT, "cases"],
  casePage: (filters) => [ROOT, "cases", filters],
  case: (caseId) => [ROOT, "case", caseId],
  caseEvents: (caseId) => [ROOT, "caseEvents", caseId],
  stats: [ROOT, "stats"],
  sanctions: [ROOT, "sanctions"],
  sanctionPage: (filters) => [ROOT, "sanctions", filters],
  appealQueue: [ROOT, "appealQueue"],
  appealQueuePage: (filters) => [ROOT, "appealQueue", filters],
};
