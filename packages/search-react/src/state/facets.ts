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
 * 2. **The server does not send option LABELS** (`facets.py` returns
 *    `{value: count}` and nothing else). The labels are in the category's
 *    feature schema, which is why {@link buildFacetGroups} takes
 *    `categoryFeatures` — the second slot-seam of the pair, filled by the
 *    container from `categories-react` (spec §6.2 item 2). Without it the
 *    panel still works and shows raw values; it does not invent labels.
 *
 * A slug the server SKIPPED (`facet_meta.skipped`, dropped at
 * `MAX_FACET_FIELDS`) is not counted at all. Its options carry `count: null`,
 * never `0` — "we did not count this" and "there are none" are different
 * sentences and the honest one has to survive to the screen.
 */
import { featureConfig, featureName, featureType, formatFeatureValue } from "@stapel/attributes-react";
import type { FeatureDef } from "@stapel/attributes-react";
import type { FacetMeta, SearchQueryState } from "../api/types.js";

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

export interface BuildFacetGroupsInput {
  /** The envelope's `facets`: `{slug: {value: count}}`. */
  readonly facets: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly meta: FacetMeta;
  /** Current URL state — the source of what is selected. */
  readonly state: SearchQueryState;
  /** The category's feature schema, for labels and option order. */
  readonly categoryFeatures?: readonly FeatureDef[];
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
    slugs.push(slug);
  }

  return slugs.map((slug) => {
    const feature = bySlug.get(slug);
    const counts = input.facets[slug] ?? {};
    const counted = !skipped.has(slug) && slug in input.facets;
    const selected = input.state.filters[slug] ?? [];

    const declared = declaredOptionValues(feature);
    const values: string[] = [];
    const push = (value: string): void => {
      if (!values.includes(value)) values.push(value);
    };
    // Declared order first (closed sets), then whatever else the counter
    // returned, then anything selected that neither of them mentioned.
    for (const value of declared) if (value in counts) push(value);
    const remaining = Object.keys(counts)
      .filter((value) => !declared.includes(value))
      .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b));
    for (const value of remaining) push(value);
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
        label: facetOptionLabel(feature, value, labelOptions),
        selected: selected.includes(value),
      })),
    };
  });
}
