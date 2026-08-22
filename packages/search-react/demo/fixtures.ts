/**
 * Demo fixtures — real response BODIES, shaped exactly as stapel-search sends
 * them, so a demo exercises the same parsing a stand would.
 */
import type { FeatureDef } from "@stapel/attributes-react";
import type { RankingResponse, SearchResponse } from "../src/index.js";

export const DEMO_TYPE = "listing";

/** A page with a promoted row, approximate facet counts and one skipped slug. */
export const DEMO_SEARCH_RESPONSE: SearchResponse = {
  items: [
    {
      key: "l-1001",
      score: 1.42,
      promoted: true,
      distance_km: 3.4,
      card: { title: "Bosch GSB 13 RE", price: "3200", currency: "RUB", location: "Moscow" },
    },
    {
      key: "l-1002",
      score: 1.1,
      promoted: false,
      distance_km: 11.9,
      card: { title: "Makita HP1630", price: "4100", currency: "RUB", location: "Khimki" },
    },
    {
      key: "l-1003",
      score: 0.8,
      promoted: false,
      distance_km: null,
      card: { title: "Interskol DU-13", price: "1800", currency: "RUB" },
    },
  ],
  facets: {
    brand: { bosch: 12, makita: 9, interskol: 4 },
    condition: { new: 7, used: 18 },
  },
  facet_meta: {
    approximate: true,
    candidates: 15000,
    counted: ["brand", "condition"],
    skipped: ["power_w"],
  },
  next_anchor: "eyJ2IjoxLCJrIjoibC0xMDAzIiwibyI6M30",
  prev_anchor: null,
  has_next: true,
  has_prev: false,
  count: 25,
  exact_total: false,
  degraded: ["typo_tolerance", "exact_facet_counts", "scorer:geo_decay"],
  backend: "postgres",
  sort: "relevance",
  took_ms: 41,
};

/** The category schema the facet panel resolves labels from. */
export const DEMO_FEATURES: readonly FeatureDef[] = [
  {
    slug: "brand",
    name: "demo.feature.brand",
    config: {
      type: "select",
      options: [
        { value: "bosch", label: "demo.brand.bosch" },
        { value: "makita", label: "demo.brand.makita" },
        { value: "interskol", label: "demo.brand.interskol" },
      ],
    },
  },
  {
    slug: "condition",
    name: "demo.feature.condition",
    config: {
      type: "select",
      options: [
        { value: "new", label: "demo.condition.new" },
        { value: "used", label: "demo.condition.used" },
      ],
    },
  },
];

export const DEMO_RANKING: RankingResponse = {
  doc_type: DEMO_TYPE,
  backend: "postgres",
  scorers: [
    {
      slug: "relevance",
      weight: 1,
      description_key: "search.scorer.relevance",
      description: "Text match against the title and description.",
      params: {},
      applies_to_sorts: ["relevance"],
      active: true,
      inactive_reason: "",
    },
    {
      slug: "geo_decay",
      weight: 0.3,
      description_key: "search.scorer.geo",
      description: "Closer listings rank higher.",
      params: { max_radius_km: 50 },
      applies_to_sorts: ["relevance"],
      active: false,
      inactive_reason: "the configured engine cannot evaluate distance",
    },
  ],
  notes: ["Promoted placements are marked in the results themselves."],
};
