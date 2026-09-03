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
 * 2. **Option LABELS have one stated order: ANSWER, then schema, then the
 *    raw value** — with a host resolver between the last two, applied by
 *    `useHostFacetLabels` on what this module could not name.
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
  featureName,
  featureType,
  formatFeatureValue,
} from "@stapel/attributes-react";
import type { FeatureDef } from "@stapel/attributes-react";
import type { FacetMeta, SearchQueryState } from "../api/types.js";

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
  readonly selected: boolean;
}

/** One facet slug, with its options. */
export interface FacetGroup {
  readonly slug: string;
  /** The feature's display name (translated when it is a key), else the slug. */
  readonly label: string;
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
   * ABSENT on a server older than 0.4.0 — absent, not empty — which is why
   * every read of it here is optional-chained and every option falls through
   * to the schema and then to its raw self. No labels are invented at any
   * step.
   */
  readonly facetLabels?: Readonly<
    Record<
      string,
      { readonly translatable: boolean; readonly values: Readonly<Record<string, string>> }
    >
  >;
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
): string {
  return (
    serverLabel(input.facetLabels, slug, value, input.t) ??
    facetOptionLabel(feature, value, labelOptions)
  );
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
 */
export function buildFacetGroups(input: BuildFacetGroupsInput): readonly FacetGroup[] {
  const bySlug = new Map<string, FeatureDef>();
  for (const feature of input.categoryFeatures ?? []) bySlug.set(feature.slug, feature);

  const skipped = new Set(input.meta.skipped);
  const slugs: string[] = [];
  const seen = new Set<string>();
  for (const slug of [
    ...Object.keys(input.facets),
    ...input.meta.skipped,
    ...Object.keys(input.state.filters),
  ]) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    // Applied first, type second — in that order, so an `imei` somebody
    // somehow got into a link keeps the control that removes it.
    const applied = (input.state.filters[slug] ?? []).length > 0;
    if (!applied && !isFacetableFeature(bySlug.get(slug))) continue;
    slugs.push(slug);
  }

  return slugs.map((slug) => {
    const feature = bySlug.get(slug);
    const counts = input.facets[slug] ?? {};
    const counted = !skipped.has(slug) && slug in input.facets;
    const selected = input.state.filters[slug] ?? [];

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
      label:
        feature === undefined
          ? slug
          : translate(input.t, featureName(feature)),
      feature,
      counted,
      selected,
      options: values.map((value) => ({
        value,
        count: counted ? (counts[value] ?? 0) : null,
        // The host's schema first when it actually resolves the value, the
        // answer's caption when it does not (or when there is no schema at
        // all), the raw value when neither knows. `facetOptionLabel` returns
        // the value unchanged for an option it cannot name, which is what
        // makes "did it resolve?" answerable without a second lookup.
        label: resolveLabel(input, feature, slug, value, labelOptions),
        selected: selected.includes(value),
      })),
    };
  });
}
