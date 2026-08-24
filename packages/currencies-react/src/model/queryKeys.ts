/**
 * The pair's query keys, in one factory (frontend-guardrails §2.6 — the ONE
 * legal home of literal key arrays; `stapel/query-keys-from-factory` refuses
 * them anywhere else). Everything under the `"currencies"` root so a host can
 * invalidate the whole module after a rate refresh.
 */
const ROOT = "currencies" as const;

export const currenciesQueryKeys: {
  readonly all: readonly ["currencies"];
  readonly list: () => readonly ["currencies", "list"];
  readonly one: (code: string) => readonly ["currencies", "one", string];
} = {
  all: [ROOT],
  /** The whole catalogue. No parameters: one deployment, one catalogue. */
  list: () => [ROOT, "list"] as const,
  /** One currency, keyed UPPER-CASE — the catalogue's canonical spelling, so
   * `usd` and `USD` are one cache entry rather than two. */
  one: (code: string) => [ROOT, "one", code.toUpperCase()] as const,
};
