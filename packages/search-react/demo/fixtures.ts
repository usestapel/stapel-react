/**
 * Demo fixtures — real response BODIES, shaped exactly as stapel-search sends
 * them, so a demo exercises the same parsing a stand would.
 */
import type { FeatureDef } from "@stapel/attributes-react";
import type {
  RankingResponse,
  SearchItem,
  SearchResponse,
  SuggestAnswer,
} from "../src/index.js";

export const DEMO_TYPE = "listing";

/**
 * A drawing rather than a photograph: an inline SVG data URI, so a card demo
 * has a picture in every environment — a shot runner with no network, a
 * reviewer offline — and pulls nothing from a host this package does not own.
 *
 * Parameterised by tone so a result PAGE does not show one image three times.
 * A grid where every row carries the same picture photographs as a rendering
 * bug even when it is only a fixture.
 *
 * The root carries an explicit `width`/`height` as well as its `viewBox`:
 * `<Image>` commits a load through `HTMLImageElement.decode()`, and a browser
 * asked to decode an SVG with no intrinsic size rejects it — which renders as
 * the placeholder well, empty, in every card. The `charset` is spelled
 * properly for the same reason: a fixture that fails to load is a fixture
 * that tests nothing.
 */
function demoPhoto(body: string, tone: string): string {
  return (
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" ' +
        'viewBox="0 0 400 300">' +
        `<rect width="400" height="300" fill="${tone}"/>` +
        body +
        "</svg>"
    )
  );
}

const DEMO_PHOTO_DRILL = demoPhoto(
  '<rect x="90" y="120" width="150" height="60" rx="12" fill="#6b7280"/>' +
    '<rect x="240" y="140" width="90" height="20" rx="6" fill="#9ca3af"/>' +
    '<rect x="120" y="180" width="60" height="80" rx="10" fill="#4b5563"/>',
  "#dbe3ee"
);

const DEMO_PHOTO_HAMMER = demoPhoto(
  '<rect x="80" y="130" width="200" height="26" rx="10" fill="#8a6a45"/>' +
    '<rect x="250" y="100" width="70" height="90" rx="12" fill="#6b7280"/>',
  "#efe6da"
);

const DEMO_PHOTO_SAW = demoPhoto(
  '<circle cx="200" cy="150" r="80" fill="#9ca3af"/>' +
    '<circle cx="200" cy="150" r="26" fill="#e5e7eb"/>',
  "#e4ece4"
);

/** A page with a promoted row, approximate facet counts and one skipped slug. */
export const DEMO_SEARCH_RESPONSE: SearchResponse = {
  items: [
    {
      key: "l-1001",
      score: 1.42,
      promoted: true,
      distance_km: 3.4,
      card: {
        title: "Bosch GSB 13 RE",
        price: "3200",
        currency: "RUB",
        location: "Moscow",
        image_url: DEMO_PHOTO_DRILL,
        url: "https://demo.stapel.dev/l/1001",
      },
    },
    {
      key: "l-1002",
      score: 1.1,
      promoted: false,
      distance_km: 11.9,
      card: {
        title: "Makita HP1630",
        price: "4100",
        currency: "RUB",
        location: "Khimki",
        image_url: DEMO_PHOTO_HAMMER,
        url: "https://demo.stapel.dev/l/1002",
      },
    },
    {
      key: "l-1003",
      score: 0.8,
      promoted: false,
      distance_km: null,
      card: {
        title: "Interskol DU-13",
        price: "1800",
        currency: "RUB",
        image_url: DEMO_PHOTO_SAW,
        url: "https://demo.stapel.dev/l/1003",
      },
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
    // The core axes stapel-search 0.4.0 declares per answer. `price` is why
    // the demo panel has a money range above the attribute rows at all.
    core_ranges: ["price"],
  },
  facet_labels: {
    condition: {
      translatable: true,
      values: { new: "demo.condition.new", used: "demo.condition.used" },
    },
  },
  next_anchor: "eyJ2IjoxLCJrIjoibC0xMDAzIiwibyI6M30",
  prev_anchor: null,
  has_next: true,
  has_prev: false,
  // A capped count: the engine counted to its cap and stopped, so the number
  // is a FLOOR and the demo renders "25+" rather than "25".
  count: 25,
  count_is_lower_bound: true,
  exact_total: false,
  // `typo_tolerance` is addressed to whoever chose the engine and no longer
  // reaches a buyer; the other two describe THIS answer and still do.
  degraded: ["typo_tolerance", "exact_facet_counts", "scorer:geo_decay"],
  backend: "postgres",
  language: "en",
  sort: "relevance",
  took_ms: 41,
};

/**
 * A search that ran and matched nothing — the arm `LoadList` draws its empty
 * state from. Distinct from a FAILED search on purpose: the counts, the
 * cursors and the honesty flags are all present and all say "zero".
 */
export const DEMO_EMPTY_RESPONSE: SearchResponse = {
  ...DEMO_SEARCH_RESPONSE,
  items: [],
  facets: {},
  facet_meta: { approximate: false, candidates: 0, counted: [], skipped: [], core_ranges: [] },
  next_anchor: null,
  prev_anchor: null,
  has_next: false,
  has_prev: false,
  count: 0,
  count_is_lower_bound: false,
  exact_total: true,
  degraded: [],
};

/** The one item the DSA marking is about: promoted, with a photo. */
export const DEMO_PROMOTED_ITEM: SearchItem = {
  key: "l-1001",
  score: 1.42,
  promoted: true,
  distance_km: 3.4,
  card: {
    title: "Bosch GSB 13 RE",
    price: "3200",
    currency: "RUB",
    location: "Moscow",
    image_url: DEMO_PHOTO_DRILL,
    url: "https://demo.stapel.dev/l/1001",
  },
};

/** An ordinary row: no marking, no distance, and no `url` — a doc type that
 * stores none gets a card that is read, not opened. */
export const DEMO_PLAIN_ITEM: SearchItem = {
  key: "l-1003",
  score: 0.8,
  promoted: false,
  distance_km: null,
  card: {
    title: "Interskol DU-13",
    price: "1800",
    currency: "RUB",
    image_url: DEMO_PHOTO_SAW,
  },
};

/**
 * What the box offers under the cursor: DESTINATIONS first, then title
 * prefixes out of the INDEX — never a query log (`services.suggest`).
 *
 * The two categories share a leaf name, which is the case the group exists
 * for: only the ancestor path and the live count tell them apart, and a
 * client-side matcher over a fetched tree would have the names and no numbers.
 */
export const DEMO_SUGGEST: SuggestAnswer = {
  categories: [
    {
      id: 41,
      slug: "dreli",
      name: "Дрели",
      path: ["Инструменты", "Дрели"],
      category: "10/41",
      count: 1240,
      depth: 2,
      match: "prefix",
    },
    {
      id: 52,
      slug: "dreli",
      name: "Дрели",
      path: ["Садовая техника", "Дрели"],
      category: "11/52",
      count: 96,
      depth: 2,
      match: "substring",
    },
  ],
  terms: ["Bosch GSB 13 RE", "Bosch GBH 2-26", "Bosch PSR 18"],
  items: ["Bosch GSB 13 RE", "Bosch GBH 2-26", "Bosch PSR 18"],
  language: "ru",
  degraded: [],
  backend: "postgres",
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
  // The numeric one — this is the feature a RANGE row is drawn for
  // (`RANGE_FEATURE_TYPES`), and the reason the panel demo shows a range at
  // all. `power_w` is also the slug the response reports as `skipped`, so the
  // same fixture documents both halves: a slug can be filterable by range and
  // uncounted as a facet at the same time.
  {
    slug: "power_w",
    name: "demo.feature.power",
    config: { type: "int", min: 0, max: 2000, postfix: "W" },
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
