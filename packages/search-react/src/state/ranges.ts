/**
 * The RANGE half of the filter model — `r.<slug>=from..to`.
 *
 * The codec has carried ranges since 0.1 (`setRangeValue`, `RANGE_PREFIX`) and
 * nothing ever drew one: a marketplace shipped without a price filter because
 * the panel only knew how to draw checkboxes. This module is the missing half:
 * which slugs a range row exists for, and what the row is called.
 *
 * ── Where a range row comes from, and why it is not the response ───────────
 *
 * A facet answer (`facets: {slug: {value: count}}`) enumerates DISCRETE values;
 * a range is not enumerable and the server never sends one. So the rows come
 * from the CATEGORY SCHEMA — the same `categoryFeatures` slot that gives the
 * checkboxes their labels — filtered to the numeric value types, plus every
 * slug the URL already carries a range for.
 *
 * That last clause is the same rule `buildFacetGroups` follows for a filtered
 * slug that fell out of the plan: a constraint that is ACTIVE must always have
 * a control that removes it, even when the schema no longer explains it.
 * Otherwise a shared link narrows the search with nothing on screen to widen it
 * again.
 *
 * `date` is range-capable on the wire and is deliberately NOT here: a date
 * range needs a date editor, the editor lives in `@stapel/attributes-react`'s
 * registry, and a numeric input over a Unix timestamp would be worse than no
 * control at all. The codec still round-trips one a host sets.
 */
import { featureConfig, featureName, featureType } from "@stapel/attributes-react";
import type { FeatureDef } from "@stapel/attributes-react";
import type { SearchQueryState, SearchRange } from "../api/types.js";

/**
 * Value types a numeric range row is drawn for (`config.type`, the
 * stapel-attributes value-type slug).
 */
export const RANGE_FEATURE_TYPES: readonly string[] = [
  "int",
  "float",
  "convertible_unit",
];

/** One `r.<slug>` row of the filter panel. */
export interface RangeGroup {
  readonly slug: string;
  /** The feature's display name (translated when it is a key), else the slug. */
  readonly label: string;
  /** The schema entry behind the slug, when the host supplied one. */
  readonly feature: FeatureDef | undefined;
  /** The applied bounds, exactly as the URL carries them (strings — the wire
   * never promised a number, and re-formatting one would rewrite the link). */
  readonly from: string | undefined;
  readonly to: string | undefined;
  /** Bounds the schema declares, for the input's own limits. */
  readonly min: number | undefined;
  readonly max: number | undefined;
  /** Unit suffix the schema declares (`postfix`, or a convertible unit). */
  readonly unit: string | undefined;
  /** `1` for an integer feature — a whole-number input for a whole number. */
  readonly step: number | undefined;
  /** Whether the URL currently constrains this slug. */
  readonly active: boolean;
}

export interface BuildRangeGroupsInput {
  readonly state: SearchQueryState;
  readonly categoryFeatures?: readonly FeatureDef[];
  /** Translator for label keys (the schema's `name` is often one). */
  readonly t?: (key: string) => string;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function translate(t: ((key: string) => string) | undefined, key: string): string {
  if (t === undefined) return key;
  const resolved = t(key);
  return resolved.length > 0 ? resolved : key;
}

/** Is this feature one a numeric range row is drawn for? */
export function isRangeFeature(feature: FeatureDef): boolean {
  const type = featureType(feature);
  return type !== undefined && RANGE_FEATURE_TYPES.includes(type);
}

/**
 * The range rows for the current search: every numeric feature of the
 * category, in the schema's own order, plus any slug the URL constrains that
 * the schema does not explain.
 */
export function buildRangeGroups(
  input: BuildRangeGroupsInput
): readonly RangeGroup[] {
  const bySlug = new Map<string, FeatureDef>();
  for (const feature of input.categoryFeatures ?? []) bySlug.set(feature.slug, feature);

  const slugs: string[] = [];
  for (const feature of input.categoryFeatures ?? []) {
    if (isRangeFeature(feature)) slugs.push(feature.slug);
  }
  for (const slug of Object.keys(input.state.ranges)) {
    if (!slugs.includes(slug)) slugs.push(slug);
  }

  return slugs.map((slug) => {
    const feature = bySlug.get(slug);
    const config = feature === undefined ? {} : featureConfig(feature);
    const applied: SearchRange | undefined = input.state.ranges[slug];
    return {
      slug,
      label:
        feature === undefined ? slug : translate(input.t, featureName(feature)),
      feature,
      from: applied?.from,
      to: applied?.to,
      min: num(config["min"]),
      max: num(config["max"]),
      unit: str(config["postfix"]) ?? str(config["unit_m"]) ?? str(config["unit_i"]),
      step: feature !== undefined && featureType(feature) === "int" ? 1 : undefined,
      active: applied !== undefined,
    };
  });
}

/**
 * Is a from/to pair one the server could ever match?
 *
 * `100..50` is syntactically fine and semantically empty, and the backend does
 * not refuse it — it answers zero results, which reads as "there is nothing
 * like this" rather than "you typed it backwards". So the panel refuses to
 * apply it and says why, beside the button (`search.facets.range_invalid`).
 */
export function isRangeUsable(range: SearchRange): boolean {
  if (range.from === undefined || range.to === undefined) return true;
  const from = Number(range.from);
  const to = Number(range.to);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return true;
  return from <= to;
}
