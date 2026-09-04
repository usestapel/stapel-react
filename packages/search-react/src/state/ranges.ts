/**
 * The RANGE half of the filter model — `r.<slug>=from..to`.
 *
 * The codec has carried ranges since 0.1 (`setRangeValue`, `RANGE_PREFIX`) and
 * nothing ever drew one: a marketplace shipped without a price filter because
 * the panel only knew how to draw checkboxes. This module is the missing half:
 * which slugs a range row exists for, and what the row is called.
 *
 * ── Where a range row comes from ──────────────────────────────────────────
 *
 * A facet answer (`facets: {slug: {value: count}}`) enumerates DISCRETE
 * values; a range is not enumerable and no bucket is ever sent for one. So
 * the rows come from two places:
 *
 *  - the CATEGORY SCHEMA — the same `categoryFeatures` slot that gives the
 *    checkboxes their labels — filtered to the numeric value types;
 *  - the ANSWER's `facet_meta.core_ranges` (stapel-search 0.4.0+), which
 *    names the range slugs addressing a COLUMN of the document rather than
 *    an attribute. `price` is the shipped one, and it is why this module
 *    exists at all: a live classified board offered seven numeric ranges,
 *    every one of them a shipping or wholesale input, and no price — because
 *    price is not a category feature anywhere, and a row was only ever drawn
 *    for a feature.
 *
 * Plus every slug the URL already carries a range for.
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
  /**
   * `true` when the axis is a CORE document column the server declared in
   * `facet_meta.core_ranges` rather than a category feature. Price is the
   * shipped one. A core axis is drawn first and is never absent because a
   * category forgot to declare an attribute for it.
   */
  readonly core: boolean;
  /**
   * The values this axis can take, when it is a BOUNDED INTEGER small enough
   * to pick from — `undefined` for every other axis, including price.
   *
   * A year is not a number a person types, it is one of a hundred-odd values,
   * and the reference classified draws it as two pickers. `min`/`max` from
   * the schema (`year: 1900..2027` on a live cars leaf) bound the list;
   * {@link RANGE_PICKER_MAX_VALUES} is where a picker stops being one and
   * becomes a scroll with a search box in it, at which point two typed fields
   * are the better control. Descending, because the busy end of a bounded
   * axis is its top: a year picker that opens on 1900 is a picker nobody uses.
   */
  readonly picker: readonly number[] | undefined;
  /**
   * ISO 4217 code when the row is money, so the control can read as money
   * instead of as a bare integer. Only ever set on a core axis: an attribute
   * carries a `postfix`, not a currency.
   */
  readonly currency: string | undefined;
}

/**
 * i18n key for a core axis's own name.
 *
 * A core axis has no FeatureDef and therefore no `name` to translate. The
 * label is this package's, because the axis is this package's.
 */
export function coreRangeLabelKey(slug: string): string {
  return `search.range.${slug}`;
}

export interface BuildRangeGroupsInput {
  readonly state: SearchQueryState;
  readonly categoryFeatures?: readonly FeatureDef[];
  /**
   * `facet_meta.core_ranges` — range slugs that address a column of the
   * document rather than an attribute (stapel-search 0.4.0+).
   *
   * It comes from the ANSWER on purpose. A live classified board offered
   * seven numeric ranges — parcel weight, length, height, width, packing
   * quantity, minimum-order quantity, battery condition — and no price,
   * because a row was only ever drawn for a category feature and price is a
   * column of the listing. Hardcoding `"price"` here would have fixed that
   * board and broken the next one, where `r.price` still answers zero
   * because the server predates the axis. So the server says which axes it
   * can actually serve, and this list is empty against an older one.
   */
  readonly coreRanges?: readonly string[];
  /** ISO 4217 code for the money axes, when the surface knows one. */
  readonly currency?: string;
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

/**
 * How many values a bounded integer may have and still be a PICKER.
 *
 * 300 covers every year range a catalogue declares (a live cars leaf is
 * 1900..2027, 128 values) and a door count, a seat count, a floor number,
 * and stops well short of a mileage (1..1000000), which is a number people
 * type and never a list.
 */
export const RANGE_PICKER_MAX_VALUES = 300;

/**
 * The value list for a bounded integer axis, or `undefined`.
 *
 * A CORE axis never gets one: price is unbounded by construction and the
 * server does not declare bounds for it.
 */
function pickerValues(
  feature: FeatureDef | undefined,
  min: number | undefined,
  max: number | undefined
): readonly number[] | undefined {
  if (feature === undefined) return undefined;
  if (featureType(feature) !== "int") return undefined;
  if (min === undefined || max === undefined) return undefined;
  if (!Number.isInteger(min) || !Number.isInteger(max)) return undefined;
  const span = max - min + 1;
  if (span < 2 || span > RANGE_PICKER_MAX_VALUES) return undefined;
  return Array.from({ length: span }, (_, i) => max - i);
}

/** Is this feature one a numeric range row is drawn for? */
export function isRangeFeature(feature: FeatureDef): boolean {
  const type = featureType(feature);
  return type !== undefined && RANGE_FEATURE_TYPES.includes(type);
}

/**
 * The range rows for the current search, in the order they should be read:
 * the CORE axes the answer declares, then every numeric feature of the
 * category in the schema's own order, then any slug the URL constrains that
 * neither explains.
 *
 * Core first is not cosmetic. On the board this was measured against, the
 * seven numeric attributes a phone category happens to declare are all
 * shipping and wholesale inputs; the one number a phone buyer narrows by is
 * the price, and it belongs above them.
 */
export function buildRangeGroups(
  input: BuildRangeGroupsInput
): readonly RangeGroup[] {
  const bySlug = new Map<string, FeatureDef>();
  for (const feature of input.categoryFeatures ?? []) bySlug.set(feature.slug, feature);

  const core = new Set(input.coreRanges ?? []);
  const slugs: string[] = [...core];
  for (const feature of input.categoryFeatures ?? []) {
    // A core slug shadows a same-named attribute — which is exactly what the
    // server does with it (`index_schema.CORE_RANGE_FIELDS` reserves the
    // slug), so drawing both would put two controls over one filter.
    if (isRangeFeature(feature) && !core.has(feature.slug)) slugs.push(feature.slug);
  }
  for (const slug of Object.keys(input.state.ranges)) {
    if (!slugs.includes(slug)) slugs.push(slug);
  }

  return slugs.map((slug) => {
    const isCore = core.has(slug);
    const feature = isCore ? undefined : bySlug.get(slug);
    const config = feature === undefined ? {} : featureConfig(feature);
    const applied: SearchRange | undefined = input.state.ranges[slug];
    return {
      slug,
      label: isCore
        ? translate(input.t, coreRangeLabelKey(slug))
        : feature === undefined
          ? slug
          : translate(input.t, featureName(feature)),
      feature,
      from: applied?.from,
      to: applied?.to,
      min: num(config["min"]),
      max: num(config["max"]),
      // A core money axis carries a CURRENCY, not a unit suffix: "₽" is
      // formatted from the code for the reader's locale, a unit suffix is a literal
      // the category author typed.
      unit: isCore
        ? undefined
        : (str(config["postfix"]) ?? str(config["unit_m"]) ?? str(config["unit_i"])),
      step: feature !== undefined && featureType(feature) === "int" ? 1 : undefined,
      picker: isCore ? undefined : pickerValues(feature, num(config["min"]), num(config["max"])),
      active: applied !== undefined,
      core: isCore,
      currency: isCore ? str(input.currency) : undefined,
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
