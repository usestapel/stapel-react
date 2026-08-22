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

/** `GET /query` 200 — the whole envelope. */
export type SearchResponse = Schemas["SearchResponse"];

/** One result row. `promoted` is present on EVERY item under EVERY sort — a
 * mandatory marking (DSA Art. 26), not an optional field, which is why the
 * card slot's contract carries it and why the default skin renders it. */
export type SearchItem = Schemas["SearchItem"];

/** The honesty block beside the counts: `approximate`, `candidates`,
 * `counted`, `skipped`. Rendered, never swallowed (spec §4.2). */
export type FacetMeta = Schemas["FacetMeta"];

/** `GET /suggest` 200. */
export type SuggestResponse = Schemas["SuggestResponse"];

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
