/**
 * Response bodies shaped exactly as stapel-search sends them — the tests mock
 * the WIRE, not the module (frontend-guardrails §4).
 */
import type { FeatureDef } from "@stapel/attributes-react";
import type { RankingResponse, SearchResponse } from "../src/index.js";

export function searchResponse(
  overrides: Partial<SearchResponse> = {}
): SearchResponse {
  return {
    items: [
      {
        key: "l-1",
        score: 1.4,
        promoted: true,
        distance_km: 3.4,
        card: { title: "Bosch GSB 13 RE", price: "3200", currency: "RUB" },
      },
      {
        key: "l-2",
        score: 1.1,
        promoted: false,
        distance_km: null,
        card: { title: "Makita HP1630", price: "4100", currency: "RUB" },
      },
    ],
    facets: {
      brand: { bosch: 12, makita: 9, interskol: 0 },
      condition: { new: 7, used: 18 },
    },
    facet_meta: {
      approximate: false,
      candidates: 25,
      counted: ["brand", "condition"],
      skipped: [],
    },
    next_anchor: "anchor-2",
    prev_anchor: null,
    has_next: true,
    has_prev: false,
    count: 25,
    exact_total: true,
    degraded: [],
    backend: "postgres",
    sort: "relevance",
    took_ms: 12,
    ...overrides,
  };
}

/** The `{localizable_error, error, params}` envelope stapel-core sends. */
export function errorBody(
  code: string,
  params: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    localizable_error: code,
    error: `refused: ${code}`,
    params,
    error_language: "en",
  };
}

export const FEATURES: readonly FeatureDef[] = [
  {
    slug: "brand",
    name: "test.feature.brand",
    config: {
      type: "select",
      options: [
        { value: "bosch", label: "test.brand.bosch" },
        { value: "makita", label: "test.brand.makita" },
        { value: "interskol", label: "test.brand.interskol" },
      ],
    },
  },
  {
    slug: "condition",
    name: "test.feature.condition",
    config: {
      type: "select",
      options: [
        { value: "new", label: "test.condition.new" },
        { value: "used", label: "test.condition.used" },
      ],
    },
  },
];

export const RANKING: RankingResponse = {
  doc_type: "listing",
  backend: "postgres",
  scorers: [
    {
      slug: "relevance",
      weight: 1,
      description_key: "search.scorer.relevance",
      description: "Text match.",
      params: {},
      applies_to_sorts: ["relevance"],
      active: true,
      inactive_reason: "",
    },
    {
      slug: "geo_decay",
      weight: 0.3,
      description_key: "search.scorer.geo",
      description: "Closer first.",
      params: { max_radius_km: 50 },
      applies_to_sorts: ["relevance"],
      active: false,
      inactive_reason: "engine cannot evaluate distance",
    },
  ],
  notes: ["Promoted placements are marked in the results."],
};
