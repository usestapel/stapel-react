/**
 * The pair's query keys, in one factory (frontend-guardrails §2.6 — the ONE
 * legal home of literal key arrays; `stapel/query-keys-from-factory` refuses
 * them anywhere else).
 */
export const geoKeys = {
  all: ["geo"] as const,
  /** The bootstrap read. No parameters: one deployment, one config. */
  mapConfig: (): readonly ["geo", "map-config"] => ["geo", "map-config"] as const,
  /**
   * A forward search. The BIAS is part of the key, because it is part of the
   * answer: the same text near Moscow and near Berlin are two different
   * result lists, and caching them under one key would show the wrong one.
   */
  search: (q: string, bias: string): readonly ["geo", "search", string, string] =>
    ["geo", "search", q, bias] as const,
  /** One resolved point, keyed to the coordinate that was asked about. */
  resolve: (
    lat: number,
    lon: number,
    nearest: number
  ): readonly ["geo", "resolve", number, number, number] =>
    ["geo", "resolve", lat, lon, nearest] as const,
} as const;
