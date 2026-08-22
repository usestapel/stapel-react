/**
 * Namespaced TanStack Query keys (frontend-standard §2 — namespaced keys).
 * Everything under the `"search"` root so a host can invalidate the whole
 * module or match a single read. Explicit tuple return types satisfy
 * `--isolatedDeclarations`.
 *
 * THE KEY IS THE REQUEST. `query()` is keyed on the very object
 * `searchQueryParams()` hands the client, not on a hand-picked subset — so a
 * parameter that changes the URL and the request but not the key (the stale
 * page bug: new filter, cached rows) cannot be written. TanStack hashes keys
 * with sorted-key JSON, so two equal states hash equal regardless of the order
 * the members were built in, and one cursor's page stays cached under its own
 * key — which is what makes "back" instant.
 */

/** The wire query object a search read is keyed on. */
export type SearchQueryKeyParams = Readonly<
  Record<
    string,
    | string
    | number
    | boolean
    | undefined
    | readonly (string | number | boolean)[]
  >
>;

const ROOT = "search" as const;

export const searchQueryKeys: {
  readonly all: readonly ["search"];
  query(
    params: SearchQueryKeyParams
  ): readonly ["search", "query", SearchQueryKeyParams];
  /** The P2B disclosure. `type` is optional on the endpoint; normalized to
   * `null` so an absent type and an explicit `undefined` cannot cache twice. */
  ranking(type?: string): readonly ["search", "ranking", string | null];
  suggest(
    type: string,
    q: string,
    limit?: number
  ): readonly ["search", "suggest", string, string, number | null];
} = {
  all: [ROOT],
  query: (params) => [ROOT, "query", params],
  ranking: (type) => [ROOT, "ranking", type ?? null],
  suggest: (type, q, limit) => [ROOT, "suggest", type, q, limit ?? null],
};
