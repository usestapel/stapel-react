/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "keys are
 * namespaced"). Everything under the `"alerts"` root, so a host can invalidate
 * the whole module, one resource, or one row. Explicit tuple return types
 * satisfy `--isolatedDeclarations`.
 *
 * ── The list key carries the FILTERS **and** the offset ───────────────────
 *
 * Those are different server answers, so they are different cache entries. A
 * key that ignored the filters would show the "fatal only" view the rows it
 * had already fetched for "everything" — on the one screen whose job is
 * deciding what is on fire.
 *
 * The offset is in the key for the same reason and one more: the ETag a page
 * carries is the validator for THAT page. Sharing a cache entry across offsets
 * would mean offering a validator for rows 0–49 on a request for rows 50–99,
 * and a matching 304 would then keep the wrong page on screen.
 *
 * ── Nothing here is keyed by a user id ────────────────────────────────────
 *
 * Every read is the same tracker for every operator: the rows are a property
 * of the fleet, not of the reader. Core's query runtime partitions the
 * persisted cache per user, and sign-out clears it.
 */
const ROOT = "alerts" as const;

export const alertsQueryKeys: {
  /** Everything this module caches — the one invalidation a host needs. */
  readonly all: readonly ["alerts"];
  /** Every issue read (the invalidation a write targets). */
  readonly issues: readonly ["alerts", "issues"];
  /** One filtered page. `filtersKey` is a stable serialization of the query. */
  issueList(filtersKey: string): readonly ["alerts", "issues", "list", string];
  /** One issue by id, with its events. */
  issue(issueId: string): readonly ["alerts", "issues", "one", string];
} = {
  all: [ROOT],
  issues: [ROOT, "issues"],
  issueList: (filtersKey) => [ROOT, "issues", "list", filtersKey],
  issue: (issueId) => [ROOT, "issues", "one", issueId],
};
