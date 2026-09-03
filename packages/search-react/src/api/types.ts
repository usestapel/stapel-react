/**
 * Wire types for the stapel-search HTTP contract — **derived from the
 * generated OpenAPI surface** (frontend-standard §2/§3), never hand-maintained.
 * The single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-search's OWN `docs/schema.json`).
 *
 * Where drf-spectacular under-describes the runtime, this file adds a small
 * documented correction and states what the generator lost.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

/** `GET /query` 200 — the whole envelope. Corrected in one place: see
 * {@link FacetMeta}. */
export type SearchResponse = Omit<Schemas["SearchResponse"], "facet_meta"> & {
  readonly facet_meta: FacetMeta;
};

/** One result row. `promoted` is present on EVERY item under EVERY sort — a
 * mandatory marking (DSA Art. 26), not an optional field, which is why the
 * card slot's contract carries it and why the default skin renders it. */
export type SearchItem = Schemas["SearchItem"];

/**
 * One group the counter COUNTED and then held back, because its buckets
 * describe too little of the result set (`FACET_MIN_COVERAGE`).
 *
 * The existence of this list is what makes "this search offers no filters"
 * a false sentence whenever it is not empty (D175).
 */
export interface FacetWithheldGroup {
  readonly slug: string;
  /** Sum of that group's bucket counts — how much of the set it describes. */
  readonly coverage: number;
  /** Size of the candidate set `coverage` is a fraction of. */
  readonly candidates: number;
}

/** One category the candidate set is made of. */
export interface FacetCategoryCount {
  /** The slash-joined id path (`"32/149/163"`) — the SAME string the
   * `category` filter and `SearchQueryState.category` already take, so a
   * panel can offer it as a filter without translating anything. */
  readonly category: string;
  readonly count: number;
}

/**
 * The honesty block beside the counts: `approximate`, `candidates`,
 * `counted`, `skipped`, and (stapel-search 0.12.0+) where the facet plan came
 * from. Rendered, never swallowed (spec §4.2).
 *
 * WHAT THE GENERATOR LOST: drf-spectacular describes `withheld` and
 * `categories` as bare `object` arrays, so the generated members are
 * `{[key: string]: unknown}[]` — the two fields a panel has to read
 * field-by-field are the two it cannot. Both are corrected here to the
 * documented row shapes; nothing else about `FacetMeta` is hand-written.
 */
export type FacetMeta = Omit<
  Schemas["FacetMeta"],
  "withheld" | "categories"
> & {
  readonly withheld: readonly FacetWithheldGroup[];
  readonly categories: readonly FacetCategoryCount[];
};

/** `GET /suggest` 200, as the CURRENT generated schema describes it. */
export type SuggestResponse = Schemas["SuggestResponse"];

/**
 * How a category's name matched the typed prefix. Informational — the server
 * ranks by `count`, never by this.
 */
export type SuggestCategoryMatch = "prefix" | "substring";

/**
 * One CATEGORY the type-ahead offers: a destination, not a search term.
 *
 * A classified's search box is a navigation control before it is a text
 * filter. "Shorts" is not one destination but three — men's, women's,
 * children's — and the only things that let a buyer pick between them are the
 * ancestor path and how many live listings sit behind each. Both are here,
 * and neither can be computed on the client: the count is one aggregate over
 * the index, and a client-side matcher over a fetched tree would have the
 * names and no numbers.
 */
export interface SuggestCategory {
  readonly id: number;
  readonly slug: string;
  /** The category's own display name. */
  readonly name: string;
  /**
   * Display names root→leaf, e.g. `["Menswear", "Shorts"]` — this is what
   * distinguishes three categories sharing a name, and it is what a row has
   * to print.
   */
  readonly path: readonly string[];
  /**
   * The ancestry as ids joined with `/`, ready to pass VERBATIM as the
   * `category` parameter of `/query`.
   *
   * The server serves the joined string rather than only the segments
   * precisely so that a client cannot invent a different join and silently
   * miss — so nothing in this pair rebuilds it from {@link path} or
   * {@link slug}.
   */
  readonly category: string;
  /**
   * Live listings a buyer would see under this category, descendants
   * included — the same number the SERP reports for it.
   */
  readonly count: number;
  /** Number of segments in {@link path}. */
  readonly depth: number;
  readonly match: SuggestCategoryMatch;
}

/**
 * The `/suggest` answer this pair actually reads.
 *
 * GENERATOR NOTE, and the reason this is not `Schemas["SuggestResponse"]`:
 * the generated type describes ONE server. stapel-search 0.7.0 made the answer
 * three-part — `categories`, `terms`, and `items` as a deprecated alias of
 * `terms` — plus `language` and `degraded`, and declares all five REQUIRED,
 * which is true of a 0.7.0 answer and false of every answer sent by the
 * servers a storefront is also deployed against.
 *
 * Every member but `backend` is therefore OPTIONAL here, which is not
 * sloppiness but the deployment story: a storefront ships against whichever
 * server is actually running, an older one sends no `categories` key at all,
 * and "the key is absent" has to read as "this server offers no destinations"
 * rather than as a crash or as an empty group under a heading. A pair typed
 * against the required-field version would compile while reading `undefined`
 * from a field the compiler swore was there.
 */
export interface SuggestAnswer {
  readonly backend: string;
  /** Destinations, ranked by live listing count desc, then depth, then name. */
  readonly categories?: readonly SuggestCategory[];
  /** Title prefixes from the index. */
  readonly terms?: readonly string[];
  /** Deprecated alias of {@link terms}, and the only half a pre-0.7.0 server
   * sends. Read through {@link suggestTerms}, never directly. */
  readonly items?: readonly string[];
  /** Which dictionary answered — the same resolution `/query` reports. */
  readonly language?: string;
  /** What this answer could not do — see {@link SUGGEST_DEGRADED_CATEGORIES}
   * and {@link SUGGEST_DEGRADED_ROLLUP}. */
  readonly degraded?: readonly string[];
}

/**
 * The suggest answer had NO category provider, so the categories half is
 * empty for a reason that is not "nothing matched".
 *
 * A dropdown has no room for a sentence about a provider being down, and the
 * person reading it is mid-word. So the group is ABSENT rather than empty —
 * an empty group under a heading is the box claiming the catalogue has no
 * section by that name, which is a different and untrue statement.
 */
export const SUGGEST_DEGRADED_CATEGORIES = "category_suggestions";

/**
 * Ancestry never arrived, so every stored path is one segment long and every
 * count would read `0`.
 *
 * The rows are still destinations and still worth offering; their COUNTS are
 * the part that is not an answer, so a surface drops the number rather than
 * printing a catalogue of zeros.
 */
export const SUGGEST_DEGRADED_ROLLUP = "category_rollup";

/**
 * The term half of a suggest answer, from whichever key this server sends.
 *
 * `terms` is 0.7.0's name and `items` is the deprecated alias kept for one
 * minor; a client that read only one of them would go blank against half the
 * servers in the fleet.
 */
export function suggestTerms(answer: SuggestAnswer | undefined): readonly string[] {
  return answer?.terms ?? answer?.items ?? [];
}

/** `GET /ranking` 200 — the P2B Art. 5 disclosure. */
export type RankingResponse = Schemas["RankingResponse"];

/** One ranking parameter of the disclosure. */
export type Scorer = Schemas["Scorer"];

/**
 * The sorts stapel-search ships (`conf.py::DEFAULT_SORTS`).
 *
 * GENERATOR NOTE, and the reason `sort` is typed as a plain `string` below:
 * `docs/schema.json` declares **no `enum`** on any query parameter — the sort
 * vocabulary lives in the backend's `SORTS` setting, which a deployment may
 * extend. So this list is what the shipped default offers a sort control, NOT
 * a claim about what the server will accept. An unknown value is refused by
 * the server with `error.400.search_unknown_sort`, naming the value; a client
 * union that silently dropped it would turn a shareable link into an empty
 * page.
 */
export const SEARCH_SORTS: readonly string[] = [
  "relevance",
  "newest",
  "price_asc",
  "price_desc",
  "distance",
];

/** Which facets to count: the category's own plan (`"on"`/omitted), none
 * (`"off"`), or an explicit slug list. */
export type FacetSelection = "on" | "off" | readonly string[];

/** One `r.<slug>` range. Either end may be absent — `..500` and `100..` are
 * both legal, and both ends absent means "no range at all". */
export interface SearchRange {
  readonly from?: string;
  readonly to?: string;
}

/** A point plus an optional radius (`lat`/`lon`/`radius_km`). */
export interface SearchGeoCenter {
  readonly kind: "center";
  readonly lat: number;
  readonly lon: number;
  readonly radiusKm?: number;
}

/**
 * A bounding box (`bbox=minLat,minLon,maxLat,maxLon`). `minLon > maxLon` is
 * LEGAL and means the box crosses the antimeridian — the codec must not
 * "fix" it, and the backend explicitly allows it (`query.py`).
 */
export interface SearchGeoBox {
  readonly kind: "bbox";
  readonly minLat: number;
  readonly minLon: number;
  readonly maxLat: number;
  readonly maxLon: number;
}

/** Either geo form. `bbox` wins server-side when both are sent, so the state
 * model carries one or the other and never both. */
export type SearchGeo = SearchGeoCenter | SearchGeoBox;

/**
 * The full query state — everything the URL carries, in one value.
 *
 * `type` is the only required parameter of the endpoint (`error.400
 * .search_unknown_doc_type` names it when absent or unregistered).
 */
export interface SearchQueryState {
  /** Registered doc type. One type per query; federated search is not in v1. */
  readonly type: string;
  /** Free text. `""` means "no text", which is a valid search (browse). */
  readonly q: string;
  /** Language of the query: picks the analyzer AND narrows the corpus. */
  readonly lang?: string;
  /** `root/leaf` path. A PREFIX filter — a parent finds its descendants. */
  readonly category?: string;
  /** Opaque owner key — the seller's own listings. */
  readonly owner?: string;
  /** `f.<slug>` → the chosen values. Repeat = OR within a slug; different
   * slugs AND together. An empty array is the same as no entry. */
  readonly filters: Readonly<Record<string, readonly string[]>>;
  /** `r.<slug>` → `from..to`. */
  readonly ranges: Readonly<Record<string, SearchRange>>;
  readonly geo?: SearchGeo;
  /** Omitted lets the server choose (`relevance` with text, else `newest`). */
  readonly sort?: string;
  readonly facets?: FacetSelection;
  /** Opaque keyset cursor from a previous answer. */
  readonly anchor?: string;
  readonly direction?: "next" | "prev";
  readonly limit?: number;
}

/** Request shape for `GET /suggest` (typed, but deliberately not hooked —
 * see `searchApi.ts`). */
export interface SuggestParams {
  readonly type: string;
  readonly q?: string;
  readonly limit?: number;
}

/**
 * One thing the engine could not do for this query, parsed out of the
 * envelope's `degraded[]`.
 *
 * The backend concatenates its own contribution with the backend's and the
 * facet counter's WITHOUT de-duplicating (`services.py`), so the same literal
 * can arrive twice; {@link SearchDegradation} values are de-duplicated by
 * `raw` when parsed.
 */
export type SearchDegradationKind =
  | "typo_tolerance"
  | "phrase_synonyms"
  | "exact_total"
  | "exact_facet_counts"
  | "category_rollup"
  /** The engine has no `category_counts` verb, so the categories the result
   * set is made of are unknown and no evidence facet plan could be drawn.
   * An empty filter panel then means "we do not know", not "there are none". */
  | "facet_plan_evidence"
  | "scorer"
  | "unknown";

export interface SearchDegradation {
  readonly kind: SearchDegradationKind;
  /** The literal the server sent — shown for an `unknown` kind, because a
   * degradation this build has no sentence for is still a degradation. */
  readonly raw: string;
  /** For `kind: "scorer"`, the scorer slug after the `scorer:` prefix. */
  readonly scorer?: string;
  /** i18n key for the sentence. */
  readonly messageKey: string;
}
