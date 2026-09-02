/**
 * Response bodies shaped exactly as stapel-search sends them — the tests mock
 * the WIRE, not the module (frontend-guardrails §4).
 */
import type { FeatureDef } from "@stapel/attributes-react";
import type {
  RankingResponse,
  SearchResponse,
  SuggestAnswer,
} from "../src/index.js";

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
      dropped_filters: [], core_ranges: ["price"],
    },
    facet_labels: {
      condition: {
        translatable: false,
        values: { new: "Новое", used: "Б/у" },
      },
    },
    next_anchor: "anchor-2",
    prev_anchor: null,
    has_next: true,
    has_prev: false,
    count: 25,
    count_is_lower_bound: false,
    exact_total: true,
    degraded: [],
    backend: "postgres",
    language: "ru",
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

/**
 * The schema a CLASSIFIED category actually declares — the three shapes a
 * facet group takes, so `facetGroupShape` is exercised against config keys
 * rather than against a flag a test invented:
 *
 *  - `condition` is SINGLE-CHOICE (`maxSelected: 1`) → pills;
 *  - `body` is a `hierarchical_select` whose `options` carry `children` →
 *    indented rows;
 *  - `brand` is a long open set → folded behind "Show all".
 */
export const CLASSIFIED_FEATURES: readonly FeatureDef[] = [
  {
    slug: "condition",
    name: "test.feature.condition",
    config: {
      type: "select",
      maxSelected: 1,
      options: [
        { value: "new", label: "test.condition.new" },
        { value: "used", label: "test.condition.used" },
      ],
    },
  },
  {
    slug: "body",
    name: "test.feature.body",
    config: {
      type: "hierarchical_select",
      options: [
        {
          value: "cars",
          label: "test.body.cars",
          children: [
            { value: "sedan", label: "test.body.sedan" },
            { value: "hatchback", label: "test.body.hatchback" },
          ],
        },
        { value: "vans", label: "test.body.vans" },
      ],
    },
  },
  // An open set: a `select` with no `options` table, which is what a
  // free-vocabulary attribute looks like on the wire. It stays a FACET (the
  // select family is choosable) while carrying no authored order and no
  // captions, so the fold and the count ordering are exercised against a
  // group nothing names.
  { slug: "brand", name: "test.feature.brand", config: { type: "select" } },
];

/** A long open set: twelve brands, which is a wall on a 390px phone. */
export const MANY_BRANDS: Readonly<Record<string, number>> = Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [`brand-${String(i)}`, 12 - i])
);

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

/**
 * The leaf schema a live classified deployment declares for a phone category,
 * reduced to the four shapes this pair has to survive at once:
 *
 *  - `condition` — an inline `select`: the option table and its captions
 *    travel with the schema, so nothing else has to name it;
 *  - `vendor` — a `ref_select`: the config carries a POINTER to a vocabulary
 *    (`optionsRef`) and no options at all, so neither the schema nor a
 *    pre-0.4.0 server can caption `apple`;
 *  - `imei` — a `string`, unique per document. The server counts it and no
 *    person filters by it;
 *  - `video_file_url` — a `string` again, and a URL.
 */
export const PHONE_FEATURES: readonly FeatureDef[] = [
  {
    slug: "condition",
    name: "test.feature.condition",
    config: {
      type: "select",
      translatable_options: false,
      options: [
        { value: "novoe", label: "Новое" },
        { value: "b-u", label: "Б/у" },
      ],
    },
  },
  {
    slug: "vendor",
    name: "test.feature.vendor",
    config: {
      type: "ref_select",
      optionsRef: { level: "Vendor", vocabulary: "phone-catalog" },
    },
  },
  { slug: "imei", name: "test.feature.imei", config: { type: "string" } },
  {
    slug: "video_file_url",
    name: "test.feature.video",
    config: { type: "string" },
  },
];

/**
 * What that deployment's `/query` answers for a category-scoped search — the
 * identifier and the URL field included, because it really does return them.
 */
export const PHONE_FACETS: Readonly<
  Record<string, Readonly<Record<string, number>>>
> = {
  condition: { "b-u": 31, novoe: 12 },
  vendor: { apple: 13, xiaomi: 10, samsung: 9 },
  imei: { "355971829187494": 1 },
  video_file_url: {},
};

/**
 * The envelope a server OLDER than stapel-search 0.4.0 sends: no
 * `facet_labels`, no `facet_meta.core_ranges`. Both keys are absent rather
 * than empty, which is the difference a client that reads `data.facet_labels`
 * has to survive.
 */
export function legacySearchResponse(
  facets: Readonly<Record<string, Readonly<Record<string, number>>>> = PHONE_FACETS
): SearchResponse {
  const { facet_labels: _labels, ...rest } = searchResponse({ facets });
  // The generated types describe the CURRENT server, so the older envelope is
  // expressed by leaving the two keys OUT rather than by widening the type —
  // absent is what the deployment sends, and absent is what a client reading
  // `data.facet_labels` has to survive.
  const meta: Record<string, unknown> = {
    approximate: false,
    candidates: 43,
    counted: Object.keys(facets),
    skipped: [],
    dropped_filters: [],
  };
  return { ...rest, facet_meta: meta } as SearchResponse;
}

/**
 * The same phone leaf as {@link PHONE_FEATURES} plus the seven NUMERIC
 * attributes the live category declares — battery health, four parcel
 * dimensions and two wholesale counts.
 *
 * They are the measured defect of the chip row: `buildRangeGroups` draws a row
 * for every numeric feature, so all seven became chips, and they were emitted
 * before the facet chips — which put parcel width in front of the price, the
 * condition and the vendor on a 390px row.
 *
 * Nothing in these defs distinguishes `akb` from `weight_for_delivery`, which
 * is exactly why the fix is an ORDER and not a deletion: the next category's
 * `int` attribute is `mileage`.
 */
export const PHONE_RANGE_FEATURES: readonly FeatureDef[] = [
  ...PHONE_FEATURES,
  { slug: "akb", name: "test.feature.akb", config: { type: "int" } },
  {
    slug: "weight_for_delivery",
    name: "test.feature.weight",
    config: { type: "float" },
  },
  {
    slug: "length_for_delivery",
    name: "test.feature.length",
    config: { type: "int" },
  },
  {
    slug: "height_for_delivery",
    name: "test.feature.height",
    config: { type: "int" },
  },
  {
    slug: "width_for_delivery",
    name: "test.feature.width",
    config: { type: "int" },
  },
  {
    slug: "wholesale_min_order_count",
    name: "test.feature.min_order",
    config: { type: "int" },
  },
  {
    slug: "wholesale_packing_count",
    name: "test.feature.packing",
    config: { type: "int" },
  },
];

/**
 * `GET /suggest` as stapel-search 0.7.0 answers it: destinations first, then
 * title prefixes.
 *
 * The three categories share a leaf name and are told apart only by the path
 * and the count, which is the whole reason the server sends both — a
 * client-side matcher over a fetched tree would have the names and no numbers.
 * `detskaya` carries a count of `0`: the server really does return a section
 * with nothing in it, ranked last, and somebody has to decide what a dead end
 * dressed as a destination is worth.
 */
export function suggestAnswer(
  overrides: Partial<SuggestAnswer> = {}
): SuggestAnswer {
  return {
    categories: [
      {
        id: 41,
        slug: "shorty",
        name: "Шорты",
        path: ["Мужская одежда", "Шорты"],
        category: "10/41",
        count: 1240,
        depth: 2,
        match: "prefix",
      },
      {
        id: 52,
        slug: "shorty",
        name: "Шорты",
        path: ["Женская одежда", "Шорты"],
        category: "11/52",
        count: 830,
        depth: 2,
        match: "prefix",
      },
      {
        id: 63,
        slug: "shorty",
        name: "Шорты",
        path: ["Детская одежда", "Шорты"],
        category: "12/63",
        count: 0,
        depth: 2,
        match: "substring",
      },
    ],
    terms: ["шорты adidas", "шорты nike"],
    items: ["шорты adidas", "шорты nike"],
    language: "ru",
    degraded: [],
    backend: "postgres",
    ...overrides,
  };
}

/** The same endpoint on a server OLDER than 0.7.0: `items` and nothing else.
 * The keys are ABSENT, not empty, which is what the client has to survive. */
export function legacySuggestAnswer(): SuggestAnswer {
  return { items: ["шорты adidas", "шорты nike"], backend: "postgres" };
}
