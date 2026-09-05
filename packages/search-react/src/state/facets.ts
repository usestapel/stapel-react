/**
 * The facet panel's data model — and the two things about stapel-search's
 * facets a panel is obliged to show.
 *
 * 1. **They are DRILL-DOWN.** Every facet is counted over the candidate set
 *    with ITS OWN filter removed (`stapel-search/facets.py`). So picking
 *    "Bosch" does not zero its neighbours: the other brands keep the counts
 *    they would have if you swapped to them. A panel that greys the siblings
 *    out has silently converted a drill-down facet into a naive one, and the
 *    e2e leg in the spec (§7.2) exists to catch exactly that.
 * 2. **LABELS have one stated order: ANSWER, then schema, then the raw
 *    term** — for the group's heading and for every option alike, with a host
 *    resolver between the last two for options, applied by
 *    `useHostFacetLabels` on what this module could not name. The bottom of
 *    that order is not a label and is marked as such: `labelSource: "none"`,
 *    a warning in development, and a data attribute on the drawn group.
 *
 *    The answer leads because it is the only source that always exists and
 *    the only one that has RESOLVED anything: `categoryFeatures` is an
 *    optional slot a live classified board never filled, and even where it is
 *    filled a `ref_select` config carries a pointer to a vocabulary and no
 *    option table at all — so the schema cannot name `apple` or `chernyy` no
 *    matter who threads it through. `facet_labels` (stapel-search 0.4.0+,
 *    vocabulary-backed from 0.6.0) is the server reading that vocabulary
 *    against the snapshot the documents were written with, and answering in
 *    the request's own language. The schema is the floor under it, for a
 *    server too old to send captions and for a slug the answer omits.
 *
 *    Neither invents a label: a value nobody names renders as itself. A page
 *    against a pre-0.4.0 server therefore behaves exactly as it did — the key
 *    is absent, every option falls through to the schema, and nothing
 *    crashes on the missing key.
 *
 * A slug the server SKIPPED (`facet_meta.skipped`, dropped at
 * `MAX_FACET_FIELDS`) is not counted at all. Its options carry `count: null`,
 * never `0` — "we did not count this" and "there are none" are different
 * sentences and the honest one has to survive to the screen. Its options come
 * from the CATEGORY SCHEMA, because a count is not a licence to filter: the
 * server accepts `f.<slug>` whether or not it counted it, so an uncounted
 * facet is a filter that exists and a number that is missing, not a filter
 * that does not exist. See {@link buildFacetGroups}.
 *
 * 3. **Not every counted slug is a FILTER.** The plan is built from the leaf
 *    category's feature defs and the counter counts whatever is indexed, so a
 *    live classified deployment answers with `imei: {"355971829187494": 1}`
 *    and `video_file_url: {}` beside its brand and its condition. Neither is
 *    something a person narrows by — one is unique per document, the other is
 *    a URL — and on a 390px chip row a chip offering one IMEI with a count of
 *    one pushes the chips that DO narrow off the screen. Which slugs can be
 *    chipped is therefore decided from the category's own feature defs, by
 *    value TYPE (see {@link FACETABLE_FEATURE_TYPES}), not by what came back.
 */
import {
  VOCABULARY_BACKED_TYPES,
  featureConfig,
  featureType,
  formatFeatureValue,
  optionsRefOf,
} from "@stapel/attributes-react";
import type { FeatureDef } from "@stapel/attributes-react";
import type { FacetLabelsMap, FacetMeta, SearchQueryState } from "../api/types.js";
import { facetKeyMapFromLabels } from "./urlState.js";

/**
 * Where a caption came from — the group's heading and every option carry it,
 * because "did anybody actually name this?" is a question two surfaces have
 * to answer and neither can answer by looking at the string.
 *
 * `"none"` is the honest bottom: the raw slug for a heading, the raw index
 * term for an option. It is not a label, it is what is printed when there is
 * none, and it is the one value a storefront's own test asserts against.
 */
export type FacetLabelSource = "server" | "schema" | "host" | "none";

declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * Is this a DEVELOPMENT build — i.e. may this module talk to the console?
 *
 * Asked as "is it dev", never as "is it not production", because the second
 * form fails open: a browser bundle with no `process` shim leaves `NODE_ENV`
 * undefined, `undefined !== "production"` is true, and a buyer's console gets
 * `facet group "complectation" has no values to draw` on every page load of a
 * live board. A warning nobody who can fix it will ever read is noise in
 * somebody else's browser.
 */
function inDevelopment(): boolean {
  const env = typeof process === "undefined" ? undefined : process.env;
  return env?.NODE_ENV === "development" || env?.NODE_ENV === "test";
}

/** Slugs already complained about — one warning per slug per page load, not
 * one per render. */
const warnedSlugs = new Set<string>();

/**
 * A heading nobody named, said once, in development only.
 *
 * A raw slug in a filter panel is a wiring fault — the category has no
 * feature definition for the slug and the server sent no label — and it is
 * invisible to everyone but the buyer who meets it. The group still renders,
 * because a heading a person cannot read still beats options with no heading
 * at all; `FacetGroup.labelSource` is how a surface marks it up for a test.
 */
function warnUnnamedGroup(slug: string): void {
  if (!inDevelopment()) return;
  if (warnedSlugs.has(slug)) return;
  warnedSlugs.add(slug);
  console.warn(
    `[search-react] facet group "${slug}" has no label: the answer sent none ` +
      `and no category feature defines it, so the heading is the raw slug.`
  );
}

/** Slugs already reported as undrawable — one warning per slug per page. */
const warnedUndrawable = new Set<string>();

/**
 * An axis that reached the panel with nothing to draw, said once, in
 * development only.
 *
 * Measured on a live classified's cars branch: `make_ref_select`,
 * `model` and `generation` are `ref_select` features whose config is a bare
 * `optionsRef` pointer into a vocabulary — there is no option table in the
 * schema and there never will be — so whenever the server's facet plan does
 * not COUNT them there is nothing on the client to enumerate, and the group
 * left the rail without a word while every `select`-typed comfort option
 * (steering side, power steering, heating) drew its schema table and stayed.
 * buyer's report was "I cannot pick a make".
 *
 * The panel still refuses to draw a heading over nothing — that is the right
 * call — but the disappearance is a WIRING FAULT with two possible owners
 * (the server's plan skipped a required axis, or the host threaded the wrong
 * category's schema), and neither of them can see it from the page.
 */
function warnUndrawableGroup(group: FacetGroup): void {
  if (!inDevelopment()) return;
  if (warnedUndrawable.has(group.slug)) return;
  warnedUndrawable.add(group.slug);
  console.warn(
    `[search-react] facet group "${group.slug}" is not drawn: no candidate in ` +
      `this answer carries any of its values${
        group.options.length === 0
          ? " and it has no options at all (the answer did not count it and " +
            "the schema passed to this page enumerates nothing for it)"
          : ` (${String(group.options.length)} options, every count zero or null)`
      }, and nothing is selected on it.` +
      (group.feature?.mandatory === true && !facetGroupIsVocabularyBacked(group)
        ? " The schema marks this axis REQUIRED — a required axis with no" +
          " evidence is a plan or a schema fault, not an empty shelf."
        : "")
  );
}

/**
 * Value types whose values are a BOUNDED OPTION SET — the only kind of
 * feature a person can be offered as a filter.
 *
 * The list is not invented here: the ref/vocabulary-backed half is
 * `@stapel/attributes-react`'s own `VOCABULARY_BACKED_TYPES` (the one place
 * that knows which types are drawn from a vocabulary), and the rest are the
 * select family plus `bool`. Everything else a category can declare — a
 * `string`, an `int`, a `date`, a `hex_color`, a `group` — enumerates as many
 * terms as there are documents, which is a list, not a choice.
 *
 * `int`/`float`/`convertible_unit` are absent here and present in
 * `RANGE_FEATURE_TYPES` (`state/ranges.ts`): a number is narrowed with two
 * bounds, not with a checkbox per value. They are not dropped from the panel,
 * they are drawn by the other half of the model.
 */
export const FACETABLE_FEATURE_TYPES: readonly string[] = [
  "bool",
  "hierarchical_select",
  ...VOCABULARY_BACKED_TYPES,
  "select",
];

/**
 * Can a person filter by the slug this feature def describes?
 *
 * **A missing feature def is not a "no".** `categoryFeatures` is an OPTIONAL
 * slot and a whole deployment can run without it; a feature can also be
 * retired between the write that indexed a value and the read that counts it.
 * Answering "not facetable" for an absent def would blank the entire chip row
 * for every host that never threaded the schema through — the same empty row
 * this rule exists to fix, arrived at from the other side. So the schema can
 * only ever REMOVE a chip it names and disowns; silence removes nothing.
 *
 * The same reasoning covers a def with no `config.type` at all: an untyped
 * feature is a def that says nothing, and nothing is not a verdict.
 */
export function isFacetableFeature(feature: FeatureDef | undefined): boolean {
  if (feature === undefined) return true;
  const type = featureType(feature);
  if (type === undefined) return true;
  return FACETABLE_FEATURE_TYPES.includes(type);
}

/** One value of one facet. */
export interface FacetOption {
  readonly value: string;
  /**
   * How many candidates carry this value with the slug's own filter removed —
   * or `null` when the slug was not counted (skipped, or facets off).
   */
  readonly count: number | null;
  /** Resolved through the category schema; the raw value when there is none. */
  readonly label: string;
  /** Which of the three sources named it — `"none"` means {@link label} IS
   * the raw index term. The host seam reads this rather than comparing the
   * two strings. */
  readonly labelSource: FacetLabelSource;
  readonly selected: boolean;
}

/** One facet slug, with its options. */
export interface FacetGroup {
  readonly slug: string;
  /**
   * What this axis is called in the ADDRESS — the answer's own `url_key`, the
   * slug when it states none.
   *
   * Carried on the group rather than looked up per surface: the chip row, the
   * rail, the popular-values block and the applied chips all act by slug and
   * all end up in the same query string, and a second place that decides how
   * to spell a key is a second place that can disagree with the codec.
   *
   * OPTIONAL so a hand-built group (a demo, a fixture, a host's own list)
   * still type-checks; `buildFacetGroups` always sets it.
   */
  readonly urlKey?: string;
  /**
   * The vocabulary this axis draws its values from, when anything says so —
   * the answer's `vocabulary`, else the schema's `optionsRef`.
   *
   * The difference between a list and a DICTIONARY, and the reason a group
   * with three buckets on a thin stand still gets a search field: what is
   * behind it is the catalogue's hundreds, not the three the stand happens to
   * hold. `undefined` means nobody said, not "inline".
   */
  readonly vocabulary?: string;
  /**
   * Where this group sits in the ONE sequence the panel draws — the answer's
   * `facet_labels[<slug>].order`, numbered together with the numeric axes'
   * `facet_meta.ranges[<slug>].order` (stapel-search 0.16.0+).
   *
   * The point of the field is that a group and a range are two ways of
   * narrowing one authored feature, so they share a scale: drawn sorted by it,
   * "Price" and "Year" land among the makes and models instead of above and
   * below all of them. `undefined` (an older server, or a group the plan has
   * no place for, which the wire says as `null`) means "no stated position",
   * and `orderPanelItems` sorts those after everything that has one.
   */
  readonly order?: number | undefined;
  /** The group's heading: the answer's own `label`, else the feature's
   * display name, else — with a dev warning — the raw slug. */
  readonly label: string;
  /** Which source named the heading. `"none"` is the slug standing in for a
   * name nobody has; a surface marks it so a storefront test can fail on it. */
  readonly labelSource: FacetLabelSource;
  /** The category-schema entry behind the slug, when the host supplied one. */
  readonly feature: FeatureDef | undefined;
  /** `false` when the server skipped this slug — counts are `null`. */
  readonly counted: boolean;
  readonly options: readonly FacetOption[];
  /** The values currently chosen for this slug (URL state, not the response). */
  readonly selected: readonly string[];
}

/**
 * How many candidate documents carry ANY value of this axis — the evidence
 * that people actually fill this field in. Uncounted options are `null`
 * (never `0` — different sentences) and contribute nothing, so a group the
 * server did not count sums to zero.
 *
 * Two surfaces rank by it, for the same reason: the chip row orders its
 * counted band by coverage (D16 reopen — an imported catalogue gave the
 * phones leaf option tables for its wholesale plumbing, and schema order put
 * them ahead of the brand), and the filter panel opens its top-coverage
 * groups and collapses the rest (the 5717px rail). One definition, or the
 * two surfaces drift into two opinions about which axes matter.
 */
export function facetCoverage(group: FacetGroup): number {
  let total = 0;
  for (const option of group.options) total += option.count ?? 0;
  return total;
}

/**
 * The order two surfaces put COUNTED facet groups in: what the person has
 * already answered, then what the corpus has evidence for.
 *
 * Stated once, because it was stated twice and the second surface never got
 * it. The chip row has ranked by coverage since D16; the RAIL rendered
 * `buildFacetGroups`' output in schema order, and on the deployed phones leaf
 * that put battery health, four parcel dimensions and two wholesale packing
 * counts above the brand — so a buyer looking at the category page's 280px
 * rail saw seven axes of parcel logistics and not one brand (walker D120/D121
 * on the desktop, D74 on the phone).
 *
 * Stable by construction: equal-ranked groups keep the order
 * `buildFacetGroups` gave them, so a closed set's authored order survives.
 */
export function compareFacetsByEvidence(a: FacetGroup, b: FacetGroup): number {
  const answered = Number(b.selected.length > 0) - Number(a.selected.length > 0);
  if (answered !== 0) return answered;
  return facetCoverage(b) - facetCoverage(a);
}

/** {@link compareFacetsByEvidence}, applied. Never mutates the input. */
export function orderFacetGroups(
  groups: readonly FacetGroup[]
): readonly FacetGroup[] {
  return [...groups].sort(compareFacetsByEvidence);
}

/**
 * Does the ANSWER have evidence for this axis — at least one value some
 * candidate actually carries?
 *
 * The one fact that outranks every other rule in this module. A bucket with a
 * count above zero is the server saying "documents in this result set have
 * this value", and no schema opinion, no missing feature list and no type
 * table may take an axis like that off the screen.
 */
export function facetGroupHasEvidence(group: FacetGroup): boolean {
  return group.options.some((option) => (option.count ?? 0) > 0);
}

/**
 * Is this axis one a person can SEARCH even with no evidence behind it — an
 * axis whose values live in a VOCABULARY?
 *
 * The one thing a zero-evidence group can still be. A `ref_select` whose
 * config is a pointer into a vocabulary is a dictionary of hundreds; the
 * control for it is a field with a search box, and that box searches the
 * DICTIONARY, not the buckets — so it is worth opening on a leaf holding one
 * listing exactly as it is on one holding thirty thousand. The stand being
 * thin is a fact about the stand.
 *
 * `mandatory` is deliberately NOT asked. It was, for one round, and on the
 * live laptops leaf not one of `vendor`, `model`, `screen_size` is marked
 * required — so the rule that was meant to save the make picker deleted the
 * vendor picker one category over. What makes the field usable is the
 * dictionary behind it; whether the composer forces a seller to fill the
 * field says nothing about that.
 */
function isSearchableVocabularyAxis(group: FacetGroup): boolean {
  return facetGroupIsVocabularyBacked(group);
}

/**
 * Does this axis draw its values from a VOCABULARY rather than an inline
 * option table?
 *
 * Asked of the schema first (`ref_select`/`ref_hierarchical_select` — the
 * types whose whole config is an `optionsRef` pointer), and of the answer
 * when there is no schema to ask: a host that threaded no feature list still
 * gets the right control if the server named the vocabulary. A def of any
 * other type is a NO however it is configured — a bounded `int` carrying an
 * `optionsRef` (the live cars `year`) is a range, and a range is not a
 * dictionary.
 */
export function facetGroupIsVocabularyBacked(group: FacetGroup): boolean {
  const type = group.feature === undefined ? undefined : featureType(group.feature);
  if (type !== undefined) return VOCABULARY_BACKED_TYPES.includes(type);
  return group.vocabulary !== undefined;
}

/**
 * Is there anything for a surface to DRAW here?
 *
 * Shared by the rail and the chip row, which each used to hold their own
 * `options.length > 0` — one predicate, or the two surfaces drift into two
 * opinions about what an empty group is.
 *
 * ── An axis with no evidence is not a filter, it is a heading ─────────────
 *
 * The predicate used to ask `options.length > 0`, and on a live laptops leaf
 * (D249, `/c/noutbuki`) that drew six of six groups as accordions with
 * nothing a person could narrow by: the answer counted every axis and gave
 * every bucket a zero, and the axes the budget skipped kept their authored
 * option tables with `count: null` on every row. Six headings, no filter, and
 * the results below them unchanged whichever box was ticked.
 *
 * So the question is EVIDENCE, not option count: at least one value some
 * candidate in this result set actually carries. Three exemptions, and they
 * are the whole rule:
 *
 *  - a group the reader has already FILTERED on, whatever its counts say —
 *    a constraint with no control to remove it is worse than a bare heading;
 *  - a vocabulary-backed axis (see {@link isSearchableVocabularyAxis}): its
 *    control is a FIELD, the field searches a dictionary the answer never
 *    enumerated, and it works with no buckets at all — this is the make on a
 *    cars leaf with three cars and the vendor on a laptops leaf with one;
 *  - nothing else. An authored `select` with no evidence is three checkboxes
 *    guaranteed to return nothing, and it costs a heading in a 280px rail and
 *    a chip on a 390px row to say so.
 *
 * A dropped axis is NAMED in development — a required axis disappearing out
 * of a rail is a fault this pair spent a release chasing, and it must not
 * disappear silently a second time.
 */
export function facetGroupIsDrawable(group: FacetGroup): boolean {
  if (group.selected.length > 0) return true;
  if (facetGroupHasEvidence(group)) return true;
  if (isSearchableVocabularyAxis(group)) return true;
  warnUndrawableGroup(group);
  return false;
}

/**
 * The order the RAIL puts groups in: the category's own schema order, with
 * the axes the schema calls required in front of it.
 *
 * Evidence order ({@link compareFacetsByEvidence}) answers "which axis does
 * this corpus fill in", which is the right question for a chip row that has
 * room for four. It is the wrong question for a rail: on a cars leaf with
 * three listings the busiest axis is whichever three values happen to be
 * counted, so the rail opened on condition and colour while make, model and
 * year — the three fields the schema marks
 * `mandatory`, i.e. the three every seller had to fill and every buyer
 * narrows by first — sat below them or off the fold entirely.
 *
 * So: the schema's own order, which is the order the composer asks the
 * seller to fill the form in, with required first. Four bands:
 *
 *  1. `pinned` slugs, in the order given — the axis a page has already
 *     decided is its subject (a partition's own field).
 *  2. schema-required (`mandatory: true`), in schema order.
 *  3. everything else the schema names, in schema order.
 *  4. what the schema does not name at all — including EVERY group when the
 *     host passed no feature list, which is the live parent-node case — in
 *     evidence order, because with no schema there is no other order to have.
 *
 * Stable: within a band the comparator falls through to evidence and then to
 * the order `buildFacetGroups` gave, so equal-ranked groups never reshuffle.
 */
export function orderFacetGroupsBySchema(input: {
  readonly groups: readonly FacetGroup[];
  /** The category schema, in the order the category declares it. */
  readonly categoryFeatures?: readonly FeatureDef[];
  /** Slugs pinned above everything, in the order given. */
  readonly pinned?: readonly string[];
}): readonly FacetGroup[] {
  const schemaIndex = new Map<string, number>();
  (input.categoryFeatures ?? []).forEach((feature, index) => {
    if (!schemaIndex.has(feature.slug)) schemaIndex.set(feature.slug, index);
  });
  const pinnedIndex = new Map<string, number>();
  (input.pinned ?? []).forEach((slug, index) => {
    if (!pinnedIndex.has(slug)) pinnedIndex.set(slug, index);
  });

  const band = (group: FacetGroup): number => {
    if (pinnedIndex.has(group.slug)) return 0;
    if (!schemaIndex.has(group.slug)) return 3;
    return group.feature?.mandatory === true ? 1 : 2;
  };
  const within = (group: FacetGroup): number =>
    pinnedIndex.get(group.slug) ?? schemaIndex.get(group.slug) ?? 0;

  return [...input.groups].sort((a, b) => {
    const byBand = band(a) - band(b);
    if (byBand !== 0) return byBand;
    const byOrder = within(a) - within(b);
    if (byOrder !== 0) return byOrder;
    return compareFacetsByEvidence(a, b);
  });
}

export interface BuildFacetGroupsInput {
  /** The envelope's `facets`: `{slug: {value: count}}`. */
  readonly facets: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly meta: FacetMeta;
  /** Current URL state — the source of what is selected. */
  readonly state: SearchQueryState;
  /** The category's feature schema, for labels and option order. */
  readonly categoryFeatures?: readonly FeatureDef[];
  /**
   * The envelope's `facet_labels` (stapel-search 0.4.0+, vocabulary-backed
   * from 0.6.0): `{slug: {translatable, values: {value: caption}}}`.
   *
   * The PRIMARY caption source, above `categoryFeatures`. Two reasons, and
   * the second is the one that cannot be worked around:
   *
   *  - it is always there. The schema slot is optional and a live classified
   *    board never filled it, so its buyers read "Condition: **b-u**" and
   *    "Listing kind: **prodayu-svoe**" on the SERP and in the filter chips.
   *  - it is the only source that RESOLVED anything. A `ref_select`'s config
   *    carries an `optionsRef` pointer and no option table, so a host that
   *    threads the entire schema through still has nothing to print for
   *    `apple` or `chernyy`. The server read that vocabulary against the
   *    snapshot the documents were written with.
   *
   * Each entry also carries the GROUP's own `label` — the heading, resolved
   * from the feature definition server-side and localized like everything
   * else. It leads for the same two reasons, and it is what a category whose
   * host passed no feature list has instead of a rail full of index slugs.
   *
   * ABSENT on a server older than 0.4.0 — absent, not empty — which is why
   * every read of it here is optional-chained and every option falls through
   * to the schema and then to its raw self. No labels are invented at any
   * step.
   */
  readonly facetLabels?: FacetLabelsMap;
  /** Translator for label keys. */
  readonly t?: (key: string) => string;
  /** BCP-47 tag, forwarded to `formatFeatureValue` for `date` options. */
  readonly locale?: string;
}

function translate(t: ((key: string) => string) | undefined, key: string): string {
  if (t === undefined) return key;
  const resolved = t(key);
  return resolved.length > 0 ? resolved : key;
}

/**
 * The caption the ANSWER carries for one option, or `undefined`.
 *
 * `translatable` is the server saying whether `values` holds translation
 * KEYS or literal captions, and it has to be said rather than sniffed:
 * `b.apple` and a rendered caption are both strings, and guessing wrong prints either a
 * dotted key or an untranslated word at a buyer.
 */
function serverLabel(
  labels: BuildFacetGroupsInput["facetLabels"],
  slug: string,
  value: string,
  t: ((key: string) => string) | undefined
): string | undefined {
  const entry = labels?.[slug];
  const caption = entry?.values[value];
  if (caption === undefined || caption.length === 0) return undefined;
  return entry?.translatable === true ? translate(t, caption) : caption;
}

/**
 * The declared option ORDER for a closed set, if the schema declares one.
 *
 * Closed sets arrive zero-filled from the server (`fill_zero_options`), and a
 * closed set is a list somebody authored: showing it in count order reshuffles
 * a size chart on every click. Open sets have no authored order, so they fall
 * back to count-descending.
 */
function declaredOptionValues(feature: FeatureDef | undefined): readonly string[] {
  if (feature === undefined) return [];
  const raw = featureConfig(feature)["options"];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const option of raw) {
    if (option !== null && typeof option === "object") {
      const value = (option as { value?: unknown }).value;
      if (value !== undefined && value !== null) out.push(String(value));
    } else if (typeof option === "string") {
      out.push(option);
    }
  }
  return out;
}

/**
 * One option's caption: the ANSWER, then the schema, then the raw value.
 *
 * The answer leads because it is the source that always exists and the only
 * one that can name a vocabulary-backed value at all: a `ref_select`'s config
 * is a POINTER (`optionsRef`), so a host who threaded the whole schema through
 * still has nothing to print for `apple`. The server read that vocabulary
 * against the snapshot the documents carry and answered in the request's own
 * language, which is a strictly better-informed caption than the option table
 * the schema may or may not hold.
 *
 * The schema is the floor: a server too old to send `facet_labels`, a slug the
 * answer omits, a value the vocabulary has since dropped. Below both, the raw
 * value — never a blank, and never a guess.
 */
function resolveLabel(
  input: BuildFacetGroupsInput,
  feature: FeatureDef | undefined,
  slug: string,
  value: string,
  labelOptions: { t?: (key: string) => string; locale?: string }
): { readonly label: string; readonly labelSource: FacetLabelSource } {
  const answer = serverLabel(input.facetLabels, slug, value, input.t);
  if (answer !== undefined) return { label: answer, labelSource: "server" };
  const schema = facetOptionLabel(feature, value, labelOptions);
  // `facetOptionLabel` hands back the value unchanged for an option it
  // cannot name, and that identity is the whole test — a formatter that
  // returned the term is a formatter that named nothing.
  return schema === value
    ? { label: value, labelSource: "none" }
    : { label: schema, labelSource: "schema" };
}

/**
 * The group's HEADING, in the one order the fleet states: the answer, then
 * the category schema, then the slug under a dev warning.
 *
 * The answer leads because it is the only source that always exists. The
 * schema slot is optional, and at a live classified's cars branch the
 * storefront passed an empty feature list, so every heading in the rail was
 * a raw index slug — the make group was on screen, unlabelled, and the
 * complaint that came back was "I cannot pick a make".
 *
 * The slug is not a fallback anyone may ship: it renders, because a heading
 * beats no heading, and it renders MARKED — `labelSource: "none"`, a warning
 * in development, and a data attribute on the drawn group.
 */
/**
 * Which vocabulary an axis draws from: the answer's word for it, then the
 * schema's `optionsRef`. Neither invents one — `undefined` is "nobody said".
 */
/** `exactOptionalPropertyTypes` makes an absent key and an `undefined` one
 * different types; this spreads to nothing when nobody named a vocabulary. */
function optionalVocabulary(
  vocabulary: string | undefined
): { vocabulary?: string } {
  return vocabulary === undefined ? {} : { vocabulary };
}

/**
 * The group's stated place in the panel, when the answer states one.
 *
 * `null` on the wire is the server's own "the plan has no position for this
 * group", which reads exactly like a server too old to state one: both mean
 * "sort me after everything that does have a place". So both spread to
 * nothing, and `FacetGroup.order` is a number or absent — never a `null` a
 * comparator would have to remember to special-case.
 */
function optionalOrder(order: number | null | undefined): { order?: number } {
  return typeof order === "number" ? { order } : {};
}

function resolveVocabulary(
  input: BuildFacetGroupsInput,
  feature: FeatureDef | undefined,
  slug: string
): string | undefined {
  const stated = input.facetLabels?.[slug]?.vocabulary;
  if (typeof stated === "string" && stated.length > 0) return stated;
  if (feature === undefined) return undefined;
  const ref = optionsRefOf(featureConfig(feature));
  return ref === undefined || ref.vocabulary.length === 0 ? undefined : ref.vocabulary;
}

function resolveGroupLabel(
  input: BuildFacetGroupsInput,
  feature: FeatureDef | undefined,
  slug: string
): { readonly label: string; readonly labelSource: FacetLabelSource } {
  const answer = input.facetLabels?.[slug]?.label;
  if (typeof answer === "string" && answer.length > 0) {
    return { label: translate(input.t, answer), labelSource: "server" };
  }
  // `featureName` falls back to the slug itself, so the def has to be asked
  // for a NAME rather than for a name-or-slug: a def with none names nothing.
  const declared = feature?.name;
  if (typeof declared === "string" && declared.length > 0) {
    return { label: translate(input.t, declared), labelSource: "schema" };
  }
  warnUnnamedGroup(slug);
  return { label: slug, labelSource: "none" };
}

/**
 * A facet value as a person reads it, through
 * `@stapel/attributes-react`'s `formatFeatureValue` — the same formatter the
 * card and the spec table use, so a value cannot read one way in the filter
 * and another way in the result.
 *
 * The wire carries facet values as STRINGS (they are index terms), so the raw
 * value is coerced back into the shape the type's formatter expects before
 * being handed over. `select` is a list even for one value
 * (`types/select/dto.py`), `date` is a Unix timestamp integer, numbers are
 * numbers. A type the formatter cannot read gives back the raw value — never
 * an empty label, which would leave an unnameable checkbox on screen.
 */
export function facetOptionLabel(
  feature: FeatureDef | undefined,
  value: string,
  options?: { readonly t?: (key: string) => string; readonly locale?: string }
): string {
  if (feature === undefined) return value;
  const type = featureType(feature);
  if (type === undefined) return value;

  let coerced: unknown = value;
  switch (type) {
    case "select":
    case "hierarchical_select":
      coerced = [value];
      break;
    case "int":
    case "float":
    case "date": {
      const parsed = Number(value);
      coerced = Number.isFinite(parsed) ? parsed : value;
      break;
    }
    case "bool":
      coerced = value === "true" || value === "1";
      break;
    default:
      coerced = value;
  }

  const formatted = formatFeatureValue(
    feature,
    { type, value: coerced },
    {
      ...(options?.t !== undefined ? { t: options.t } : {}),
      ...(options?.locale !== undefined ? { locale: options.locale } : {}),
    }
  );
  return formatted !== undefined && formatted.length > 0 ? formatted : value;
}

/**
 * Fold the response's counts, the URL's selections and the category schema
 * into the panel's groups.
 *
 * Groups appear for every counted slug, every skipped slug, and every slug the
 * person has filtered on — the last one matters: a filter whose slug fell out
 * of the plan must stay visible, or it becomes a constraint with no control to
 * remove it.
 *
 * A slug the category schema names and types as something no one can choose
 * from (see {@link isFacetableFeature}) produces no group at all — not an
 * empty one, because an empty group is still a heading in the panel and still
 * a chip in the row. The APPLIED-filter clause outranks the type rule: a
 * constraint the URL carries always gets its control back, whatever the schema
 * now says about it, or a person is left holding a filter they cannot clear.
 *
 * A COUNTED group with zero coverage goes the same way, and for the same
 * reason — see {@link keepsAnAxisOpen}.
 */
export function buildFacetGroups(input: BuildFacetGroupsInput): readonly FacetGroup[] {
  const bySlug = new Map<string, FeatureDef>();
  for (const feature of input.categoryFeatures ?? []) bySlug.set(feature.slug, feature);

  // The answer's address keys, so a URL carrying `f.make` selects the group
  // called `make_ref_select` instead of inventing a second one beside it.
  // Both forms are read here whatever the codec did upstream: a cold link is
  // parsed before any answer exists, so the state can legitimately hold the
  // short key while the groups are keyed by slug.
  const keys = facetKeyMapFromLabels(input.facetLabels);
  const applied = (slug: string): readonly string[] =>
    input.state.filters[slug] ??
    input.state.filters[keys.write[slug] ?? slug] ??
    [];

  const skipped = new Set(input.meta.skipped);
  const slugs: string[] = [];
  const seen = new Set<string>();
  for (const slug of [
    ...Object.keys(input.facets),
    ...input.meta.skipped,
    ...Object.keys(input.state.filters).map((key) => keys.read[key] ?? key),
  ]) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    // Applied first, type second — in that order, so an `imei` somebody
    // somehow got into a link keeps the control that removes it.
    //
    // EVIDENCE does not enter here, and the reason is worth stating because
    // the opposite was tried: a counted bucket cannot promote a slug the
    // schema NAMES AND DISOWNS. An `imei` the engine counted is still not a
    // filter — a free-text identifier enumerates one term per document — and
    // a `visibility: "owner"` feature is one the canon says is never
    // facetable at all. What evidence does outrank is SILENCE: an absent def,
    // an untyped def, and the whole empty feature list the live cars page
    // passes at its parent node all answer "not a verdict"
    // (see {@link isFacetableFeature}), so a counted axis is never dropped
    // for a schema that says nothing about it. That is the live case; a
    // wrong-schema case where some other category types `make_ref_select` as
    // free text is not one this pair can tell apart from a real `imei`.
    if (applied(slug).length === 0 && !isFacetableFeature(bySlug.get(slug))) continue;
    slugs.push(slug);
  }

  return slugs.map((slug) => {
    const feature = bySlug.get(slug);
    const counts = input.facets[slug] ?? {};
    const counted = !skipped.has(slug) && slug in input.facets;
    const selected = applied(slug);

    // The authored option order, from whichever copy of the category config
    // this page has. An authored list reshuffled by count is a size chart
    // that moves on every click, and until 0.11 a host that passed no schema
    // got exactly that.
    const fromSchema = declaredOptionValues(feature);
    const declared =
      fromSchema.length > 0
        ? fromSchema
        : Object.keys(input.facetLabels?.[slug]?.values ?? {});
    const values: string[] = [];
    const push = (value: string): void => {
      if (!values.includes(value)) values.push(value);
    };
    if (counted) {
      // Declared order first (closed sets), then whatever else the counter
      // returned, then anything selected that neither of them mentioned.
      for (const value of declared) if (value in counts) push(value);
      const remaining = Object.keys(counts)
        .filter((value) => !declared.includes(value))
        .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b));
      for (const value of remaining) push(value);
    } else {
      // A COUNT IS NOT A LICENCE TO FILTER.
      //
      // `counts` is empty here by definition — the counter never looked at
      // this slug (`facet_meta.skipped`, the plan overrunning
      // `MAX_FACET_FIELDS`) or the deployment counts nothing at all. Gating
      // the options on `value in counts` therefore left the facet with NONE,
      // and a group with no options is dropped by every surface that draws
      // one. Measured on a live cars leaf: 26 facetable features declared, 12
      // counted, 14 rendered as a warning naming filters the person could not
      // then use — while `/query` accepts `f.<slug>` for every one of them.
      //
      // So an uncounted facet is built from the SCHEMA: the option table the
      // category config already carries (`config.options`), or the captions
      // the answer sent for it. The counts stay `null` below — "nobody
      // counted this" is still said, in the place it belongs (beside the
      // option), and it no longer decides whether the filter exists.
      //
      // A `ref_select` whose config is a bare `optionsRef` pointer has no
      // table here and no options to draw; naming that gap is
      // `MODULE.md`'s job, inventing values would not be.
      for (const value of declared) push(value);
    }
    for (const value of selected) push(value);

    const labelOptions = {
      ...(input.t !== undefined ? { t: input.t } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
    };

    return {
      slug,
      urlKey: keys.write[slug] ?? slug,
      ...optionalOrder(input.facetLabels?.[slug]?.order),
      ...optionalVocabulary(resolveVocabulary(input, feature, slug)),
      ...resolveGroupLabel(input, feature, slug),
      feature,
      counted,
      selected,
      options: values.map((value) => ({
        value,
        count: counted ? (counts[value] ?? 0) : null,
        // The answer's caption first, then the schema's own option table,
        // then the raw value — and the source is carried rather than
        // re-derived, so "did it resolve?" needs no second lookup.
        ...resolveLabel(input, feature, slug, value, labelOptions),
        selected: selected.includes(value),
      })),
    };
  }).filter(keepsAnAxisOpen);
}

/**
 * Is this group an axis a person can actually move along?
 *
 * The coverage floor stops at the queried category's own schema, on the
 * server, on purpose: `FACET_MIN_COVERAGE` governs only the slugs an
 * evidence plan BORROWED from sibling leaves, because "a closed option set
 * answering with its zeros is a shipped decision". That is right about an
 * option and wrong about a GROUP. A size chart showing `XL — 0` beside
 * `M — 12` is telling the truth about a shape the reader wants to see whole;
 * a group whose every option is 0 is not a shape, it is three checkboxes that
 * are each guaranteed to return nothing, and it costs a heading in the rail
 * and a chip on a 390px row to say so.
 *
 * Measured on the deployed phones leaf: `sim_config`, `device_history` and
 * `set` are authored `select` features that no listing in the leaf fills.
 * The server's `fill_zero_options` creates the slug and zero-fills every
 * authored option, so all three arrive counted, complete and dead, and the
 * withholding loop never looks at them because an authored plan has no
 * `evidence`. Nothing on the wire marks them: the client has to sum the
 * buckets itself, which is exactly what {@link facetCoverage} already does
 * for two other surfaces.
 *
 * Three things this must NOT drop, which is why the predicate is this narrow:
 *
 *  - an UNCOUNTED group (`counted: false`). Its options carry `count: null`,
 *    so it sums to zero for the opposite reason — nobody looked. "We did not
 *    count this" and "there are none" are different sentences, and dropping
 *    on the first is the regression the `MAX_FACET_FIELDS` branch below
 *    exists to prevent (a live cars leaf: 26 facetable features declared, 12
 *    counted, and `/query` accepts `f.<slug>` for all 26).
 *  - a group the reader has ALREADY filtered on, whatever its counts say —
 *    the same clause that outranks the type rule. Withholding that group
 *    leaves a constraint applied with no control to undo it.
 *  - a group with any non-zero option. A zero option beside a live one is
 *    drill-down working as designed: it reports what swapping to that value
 *    would get you, and the answer being "nothing" is information.
 */
function keepsAnAxisOpen(group: FacetGroup): boolean {
  if (!group.counted) return true;
  if (group.selected.length > 0) return true;
  // A vocabulary axis survives its own zero: its control is a field over a
  // dictionary the answer never enumerated, so "this stand holds no Toyotas
  // yet" is not a reason to take the make picker off the page. Same
  // clause as `facetGroupIsDrawable`'s, or the rail would ask a question the
  // builder had already answered by deleting the group.
  if (isSearchableVocabularyAxis(group)) return true;
  if (facetCoverage(group) > 0) return true;
  // Said here as well as in `facetGroupIsDrawable`, because a group withheld
  // at BUILD time never reaches a surface to be named there — and a counted
  // axis whose every bucket is zero is exactly the shape the laptops leaf
  // arrived in. One warning per slug per page load either way.
  warnUndrawableGroup(group);
  return false;
}
