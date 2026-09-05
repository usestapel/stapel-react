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

/**
 * One slug's captions: the GROUP's own name, and the words for its values.
 *
 * `label` is the group heading the server resolved from the category's
 * feature definition, in the request's own language. It is the only source
 * that always exists — `categoryFeatures` is an optional slot a live
 * classified board never filled, and without it every heading in the panel
 * was the raw index slug. `null` is the server saying it has no name for the
 * slug either; ABSENT is a server too old to send one, and both read the same
 * way here (fall through to the schema).
 *
 * WHY IT IS NOT THE GENERATED SHAPE: stapel-search 0.14.5's `schema.json`
 * declares this field REQUIRED, but the contract this pair announces is
 * `>=0.14 <0.15`, and a 0.14.0 server inside that range sends no `label` at
 * all. The generated member is therefore `Omit`ted and re-declared here as
 * optional-and-nullable — a type must not promise a field a server the pair
 * says it supports does not send.
 */
export type FacetLabels = Omit<
  Schemas["FacetLabels"],
  "label" | "label_translatable" | "url_key" | "vocabulary" | "order"
> & {
  /**
   * Where this group sits in ONE panel, numbered together with the numeric
   * axes of `facet_meta.ranges` (stapel-search 0.16.0+).
   *
   * The whole point of the field is that it is the SAME sequence: a group and
   * a range are two ways of narrowing one authored feature, and sorting both
   * halves by this key puts "Price" and "Year" where the category's schema put
   * them instead of stacking every choice above every measurement. `null` is
   * the server saying the plan has no position for this group, which sorts
   * last.
   *
   * WHY IT IS NOT THE GENERATED SHAPE: 0.16.0 declares it REQUIRED, and a
   * fixture captured from a 0.15 answer — or a group a host builds by hand —
   * carries no `order` at all. Optional here, and the panel reads absence and
   * `null` the same way: no position, sort last.
   */
  readonly order?: number | null;
  readonly label?: string | null;
  /**
   * Whether {@link label} is a translation KEY rather than a caption, the way
   * `translatable` says it for the values.
   *
   * Measured on a live answer (`category=141/151`, 2026-09-04): the server
   * sends it beside every label — a make caption with
   * `label_translatable: false`, a condition caption with `true` — and the
   * describe it. Declared, not consumed: this pair passes the group heading
   * through its translator either way, and a caption that is not a key comes
   * back unchanged (`translate()` keeps a key it cannot resolve). Typed so a
   * fixture captured from the wire is not a type error.
   */
  readonly label_translatable?: boolean;
  /**
   * What this group is called IN THE ADDRESS: `f.<url_key>`, `r.<url_key>`.
   *
   * The slug minus the type suffix an importer mints (`_select`,
   * `_ref_select`, `_int`, `_bool`, `_string`) where dropping it stays
   * unambiguous among the features of the category in scope, and the slug
   * itself otherwise — and always when the query names no category
   * (stapel-search 0.14.4+, `facets.url_keys`). Derived per request, never
   * stored: the slug remains the feature's identity and both forms are
   * accepted inside the scope, which is what lets a client write the short
   * one without a migration behind it.
   *
   * WHY IT IS NOT THE GENERATED SHAPE: 0.14.5 declares it REQUIRED, and the
   * announced contract is `>=0.14 <0.15` — a 0.14.0 server in that range
   * states no `url_key`, and the codec's whole point is that such a link
   * still works. `Omit`ted from the generated member and re-declared
   * optional here. Measured on a live answer 2026-09-04:
   * `make_ref_select` → `make`, `fuel_type_ref_select` → `fuel_type`,
   * `model` → `model`.
   */
  readonly url_key?: string | null;
  /**
   * The vocabulary this group's values are drawn from, when the server names
   * one.
   *
   * The one fact that decides whether an axis is a DICTIONARY rather than a
   * list, and the client's second-best source for it: the first is the
   * category schema's own `optionsRef`, which a host that threaded no schema
   * does not have. Absent on every server that does not state it — absence
   * is not "inline", it is "unsaid", and the schema is asked next.
   *
   * WHY IT IS NOT THE GENERATED SHAPE: stapel-search 0.14.9 added it and
   * declares it REQUIRED, and the announced contract is `>=0.14 <0.15` — a
   * 0.14.0 server inside that range sends no `vocabulary` at all. Same
   * treatment as `url_key` above: `Omit`ted from the generated member and
   * re-declared optional here, because a type must not promise a field a
   * server the pair says it supports does not send. `level` is generated
   * optional already and is inherited unchanged.
   */
  readonly vocabulary?: string | null;
};

/** `facet_labels` as a whole: `{slug: {label, translatable, values}}`. */
export type FacetLabelsMap = Readonly<Record<string, FacetLabels>>;

/** `GET /query` 200 — the whole envelope. Corrected in two places: see
 * {@link FacetMeta} and {@link FacetLabels}. */
export type SearchResponse = Omit<
  Schemas["SearchResponse"],
  "facet_meta" | "facet_labels"
> & {
  readonly facet_meta: FacetMeta;
  readonly facet_labels: FacetLabelsMap;
};

/** One result row. `promoted` is present on EVERY item under EVERY sort — a
 * mandatory marking (DSA Art. 26), not an optional field, which is why the
 * card slot's contract carries it and why the default skin renders it. */
export type SearchItem = Schemas["SearchItem"];

/**
 * One axis the server PLANNED and then did not offer, and why
 * (stapel-search 0.16.0's `WithheldAxis`).
 *
 * The existence of this list is what makes "this search offers no filters"
 * a false sentence whenever it is not empty (D175). Two things 0.16.0 added,
 * and both matter to a panel:
 *
 *  - `axis` says WHICH HALF the row is about. One slug can be a choice and a
 *    measurement at once — an imported `year` is both — and the two are
 *    decided by different quantities over the same page, so a withheld
 *    `group` row does not mean the slider is gone. A surface that counts the
 *    list filters by `axis`; a surface that hides an axis reads only the rows
 *    for its own half.
 *  - `reason` is a CLOSED set. `coverage` is the old case (it describes too
 *    little of the result set, and then the two numbers are present).
 *    `unlabelled` is the new one: no caption could be resolved anywhere, so
 *    the only thing a client could draw above the picker is the storage slug
 *    — `doors`, `kilometrage`, printed at a buyer. That axis is withheld
 *    rather than shipped bare, and this row is how the panel knows it existed.
 *
 * `coverage` and `candidates` are therefore OPTIONAL: they are the
 * measurement that decided a `coverage` row and mean nothing on an
 * `unlabelled` one.
 */
export type FacetWithheldAxis = Schemas["WithheldAxis"];

/**
 * @deprecated The 0.15-era name, kept for one minor so a host that imported
 * it still compiles. It now denotes {@link FacetWithheldAxis}, which is the
 * same row plus `axis` and `reason`.
 */
export type FacetWithheldGroup = FacetWithheldAxis;

/** Which half of the panel a {@link FacetWithheldAxis} row is about. */
export type FacetAxisKind = Schemas["AxisEnum"];

/** Why an axis was withheld — a closed set; an unknown value means the client
 * is older than the server. */
export type FacetWithheldReason = Schemas["ReasonEnum"];

/**
 * The slugs one half of the panel must NOT draw, out of the answer's
 * `withheld` list.
 *
 * Filtering by `axis` is the whole reason the field exists: a `year` withheld
 * as a GROUP is still a slider, and a `year` withheld as a RANGE is still a
 * bucket list. Reading the list without the discriminator hides both.
 */
export function withheldSlugs(
  withheld: readonly FacetWithheldAxis[] | undefined,
  axis: FacetAxisKind
): readonly string[] {
  return (withheld ?? [])
    .filter((row) => row.axis === axis)
    .map((row) => row.slug);
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
 * One numeric axis a from/to picker is drawn from — its two ENDS, measured
 * over this answer's candidate set with the range filters removed, AND its
 * caption (stapel-search 0.16.0's `RangeAxis`).
 *
 * `min`/`max` are numbers, not strings: a slider end is arithmetic a client
 * does immediately, and a price re-parsed from a formatted string is a price
 * that has already been rounded once.
 *
 * The other three are 0.16.0's, and they are why a client stopped needing the
 * category schema to write a heading:
 *
 *  - `label` comes from the same source a facet group's heading does — the
 *    category's own `FeatureDef.name`, or this library's own key for a core
 *    axis — and is never null, because an axis nobody could name is WITHHELD
 *    (`facet_meta.withheld`, reason `unlabelled`) rather than shipped as a
 *    bare `doors`. `label_translatable` says whether it is a key or literal
 *    text the catalogue wrote, exactly as it does for a group.
 *  - `unit` is the definition's `postfix`, or the family's BASE unit for a
 *    `convertible_unit` — the stored value is in the base unit, so naming the
 *    input unit would label metres as kilometres. ABSENT, never `""`, for an
 *    axis whose definition names none (`price` among them: a price's unit is
 *    the corpus's currency, a property of each document rather than of the
 *    axis).
 *  - `order` numbers this axis in the SAME sequence as `facet_labels`, so a
 *    panel that sorts both halves by it lands the picker where the category
 *    authored it.
 *
 * `label`, `label_translatable` and `order` are OPTIONAL here while the
 * generated shape declares them required: a fixture captured off a 0.15
 * server, and a map a host or a demo builds by hand, carry two numbers and
 * nothing else. A type that promised the caption would compile while reading
 * `undefined` from a field the compiler swore was there — and the label is
 * exactly the field a panel must not guess at.
 */
export type FacetRangeAxis = Omit<
  Schemas["RangeAxis"],
  "label" | "label_translatable" | "order"
> & {
  readonly label?: string;
  readonly label_translatable?: boolean;
  readonly order?: number | null;
};

/**
 * @deprecated The 0.14-era name for the two bounds alone. It now denotes
 * {@link FacetRangeAxis}, which is the same two numbers plus the caption.
 */
export type FacetRangeBounds = FacetRangeAxis;

/**
 * `facet_meta.ranges` — `{slug: RangeAxis}` for every axis this answer has
 * numbers behind, core columns and attribute axes in ONE report because one
 * rail draws both.
 *
 * An axis ABSENT from the map either has no numbers behind it on this page —
 * a different fact from a bound of zero — or was WITHHELD, and then it is
 * named in `facet_meta.withheld` with the reason. The map itself absent is a
 * different fact again: the server predates 0.14.7, or its engine has no
 * `ranges` verb and said so as `facet_ranges` in `degraded[]`. The panel tells
 * them apart — see `state/ranges.ts`.
 */
export type FacetRangesMap = Readonly<Record<string, FacetRangeAxis>>;

/**
 * The honesty block beside the counts: `approximate`, `candidates`,
 * `counted`, `skipped`, and (stapel-search 0.12.0+) where the facet plan came
 * from. Rendered, never swallowed (spec §4.2).
 *
 * WHAT THE GENERATOR LOST: drf-spectacular describes `categories` as a bare
 * `object` array, so the generated member is `{[key: string]: unknown}[]` — a
 * field a panel has to read row by row arrives with no rows in the type. It is
 * corrected here to the documented row shape. `withheld` was in the same state
 * until stapel-search 0.16.0 gave it a named `WithheldAxis`; it is now
 * generated, and is re-declared only to keep the `readonly` array this pair
 * hands around.
 *
 * `ranges` (stapel-search 0.14.7) is now GENERATED, and is corrected here for
 * both of the reasons the two fields above are. The generator lost the row
 * shape — `additionalProperties: {}` becomes `{[key: string]: unknown}`, so
 * the map a slider reads two numbers out of arrives with no numbers in the
 * type — and drf-spectacular declares it required while the announced
 * contract is `>=0.14 <0.15`, inside which a 0.14.0..0.14.6 server measures
 * no bounds at all. Optional is the deployment truth: absent means "this
 * server does not measure bounds", and a required field would compile while
 * reading `undefined` from a key the compiler swore was there.
 */
export type FacetMeta = Omit<
  Schemas["FacetMeta"],
  "withheld" | "categories" | "ranges"
> & {
  readonly withheld: readonly FacetWithheldAxis[];
  readonly categories: readonly FacetCategoryCount[];
  readonly ranges?: FacetRangesMap;
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
