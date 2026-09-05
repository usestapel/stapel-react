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
 * the rows come from three places:
 *
 *  - the ANSWER's `facet_meta.ranges` (stapel-search 0.14.7+, a whole axis
 *    rather than two numbers since 0.16.0) — `{slug: {min, max, label,
 *    label_translatable, unit?, order}}` for every axis this page has NUMBERS
 *    behind, measured with the range filters removed. When the answer reports
 *    it, it is the authority on which attribute axes exist, where their ends
 *    are, WHAT THEY ARE CALLED and where in the panel they sit: the schema
 *    says an axis COULD be numeric, and this says it IS, on these documents,
 *    under this name. It reaches axes the schema's own type cannot — a
 *    vocabulary-backed `year`, a `floor`, a `doors` are CHOICES in the
 *    catalogue and from/to's to a buyer, and both are served.
 *  - the ANSWER's `facet_meta.withheld` (0.16.0), which is the same authority
 *    used in the negative: an axis it names as a withheld `range` is one this
 *    answer planned and declined to offer, and no schema row resurrects it.
 *  - the CATEGORY SCHEMA — the same `categoryFeatures` slot that gives the
 *    checkboxes their labels — filtered to the numeric value types. It is the
 *    FALLBACK, and the only source against a server that reports no `ranges`
 *    (older, or an engine that listed `facet_ranges` in `degraded[]`).
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
import type {
  FacetRangesMap,
  FacetWithheldAxis,
  SearchQueryState,
  SearchRange,
} from "../api/types.js";
import { withheldSlugs } from "../api/types.js";

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
  /**
   * What to write above the picker: the ANSWER's own caption first (0.16.0
   * resolves it from the same definition a group heading comes from), the
   * schema's display name next, this package's key for a core axis, and — only
   * for a slug the URL constrains that none of them explain — the slug itself.
   * {@link named} says which of those two worlds the row is in.
   */
  readonly label: string;
  /** The schema entry behind the slug, when the host supplied one. */
  readonly feature: FeatureDef | undefined;
  /** The applied bounds, exactly as the URL carries them (strings — the wire
   * never promised a number, and re-formatting one would rewrite the link). */
  readonly from: string | undefined;
  readonly to: string | undefined;
  /** The axis's ends: the ANSWER's measured bounds when it reported any for
   * this slug, the schema's declared ones otherwise. */
  readonly min: number | undefined;
  readonly max: number | undefined;
  /**
   * `true` when {@link min}/{@link max} were MEASURED over this answer
   * (`facet_meta.ranges`) rather than declared by the schema.
   *
   * The difference is what a picker may be drawn from: a catalogue's
   * `1900..2027` is what a year could be, and `2015..2020` is what this page
   * has. Never set on a core axis — see {@link BuildRangeGroupsInput.ranges}.
   */
  readonly measured: boolean;
  /** What the numbers are measured in: the ANSWER's `unit` (the definition's
   * `postfix`, or the BASE unit of a convertible family) when it states one,
   * the schema's own affixes otherwise. Absent, never `""`, on an axis nobody
   * gave a unit — a price among them. */
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
   * and the reference classified draws it as two pickers. {@link min}/{@link
   * max} bound the list — the answer's measured ends when it reported any
   * (`year: 1990..2024` over these documents), the schema's declared ones
   * otherwise (`year: 1900..2027` on a live cars leaf);
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
  /**
   * Where this axis sits in the ONE sequence the panel draws — the answer's
   * `facet_meta.ranges[<slug>].order`, numbered together with the groups'
   * `facet_labels[<slug>].order` (stapel-search 0.16.0+).
   *
   * `undefined` means the answer stated no position (an older server, an axis
   * the plan has no place for, or a row that came from the schema alone), and
   * a panel then falls back to the band order it has always used: core axes
   * first, then the groups, then the rest of the measurements. See
   * `orderPanelItems`.
   */
  readonly order: number | undefined;
  /**
   * `true` when {@link label} is a name SOMEBODY GAVE the axis — the answer's
   * own caption, the schema's `FeatureDef.name`, or this package's key for a
   * core axis — and `false` when it is the storage slug standing in for a name
   * nobody has.
   *
   * A row is only ever unlabelled when the URL already constrains the slug: a
   * constraint must keep the control that removes it, even one captioned
   * `power_w`. Every other unnamed axis is dropped before it reaches a
   * surface, which is the client half of the rule stapel-search 0.16.0 states
   * on the wire by WITHHOLDING an axis it could not caption.
   */
  readonly named: boolean;
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
  /**
   * `facet_meta.ranges` — the axes this ANSWER measured, and their ends
   * (stapel-search 0.14.7+).
   *
   * Two jobs, and the second is the one the schema cannot do:
   *  - BOUNDS. `min`/`max` come from here when the axis is in it, and from
   *    the schema's `config` otherwise. A catalogue's `1900..2027` is what a
   *    year COULD be; `2015..2020` is what this page has.
   *  - EXISTENCE. An axis the schema types as a CHOICE — a vocabulary-backed
   *    `year`, a `floor`, a `doors` — is a from/to to a buyer, and the server
   *    now says so by measuring it. Reported axes get a row whatever the
   *    schema calls them.
   *
   * `undefined` means the server said nothing: it predates 0.14.7, or its
   * engine has no `ranges` verb and listed `facet_ranges` in `degraded[]`.
   * The schema's bounds are the fallback then — never an empty rail, which
   * would read as "this category has no numbers".
   *
   * A CORE axis is left alone by it. The price field is not clamped to the
   * corpus's current ends: those ends move with every other filter, and an
   * input that refuses the number a person meant to type is worse than an
   * unbounded one. The measured price is still on the envelope for a host
   * that wants to draw a histogram over it.
   */
  readonly ranges?: FacetRangesMap;
  /**
   * `facet_meta.withheld` — the axes the server planned and then did NOT
   * offer (stapel-search 0.16.0+).
   *
   * Only the rows whose `axis` is `"range"` are read here, and reading them is
   * not optional: an axis withheld for `coverage` describes three of fifty-two
   * documents and an axis withheld as `unlabelled` has no caption anyone could
   * print, and the server leaving it out of `ranges` is only half the
   * statement — the CATEGORY SCHEMA still names the same slug, so a rail that
   * ignored this list would draw from the schema exactly the row the answer
   * just declined to offer.
   *
   * The one exemption is a slug the URL constrains. The server promises never
   * to withhold one (that would leave a filter applied with no control to undo
   * it) and this module keeps the row anyway if it ever does, for the same
   * reason it keeps a row the schema cannot explain.
   */
  readonly withheld?: readonly FacetWithheldAxis[];
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
 * Is this axis a WHOLE-NUMBER one — the question both the picker and the
 * input's step ask?
 *
 * The schema answers it for a typed feature (`int`, and never `float` or a
 * convertible unit, whose values are 1.4 litres). For an axis the schema
 * types as a CHOICE, or does not describe at all, the ANSWER answers it: the
 * server measured two ends over the real documents, and whole ends over a
 * vocabulary of numeric codes is what a `year` or a `floor` is.
 */
function isIntegerAxis(
  feature: FeatureDef | undefined,
  min: number | undefined,
  max: number | undefined,
  measured: boolean
): boolean {
  const type = feature === undefined ? undefined : featureType(feature);
  if (type === "int") return true;
  if (type === "float" || type === "convertible_unit") return false;
  return (
    measured &&
    min !== undefined &&
    max !== undefined &&
    Number.isInteger(min) &&
    Number.isInteger(max)
  );
}

/**
 * The value list for a bounded integer axis, or `undefined`.
 *
 * A CORE axis never gets one: price is unbounded by construction and the
 * server does not declare bounds for it.
 */
function pickerValues(
  feature: FeatureDef | undefined,
  min: number | undefined,
  max: number | undefined,
  measured: boolean
): readonly number[] | undefined {
  if (!isIntegerAxis(feature, min, max, measured)) return undefined;
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
  const bounds = input.ranges;
  const reported = new Set(Object.keys(bounds ?? {}));
  // The axes this answer planned and declined to offer — sparse, or with no
  // caption anyone could print. Dropped unless the URL constrains them.
  const withheld = new Set(withheldSlugs(input.withheld, "range"));
  const slugs: string[] = [...core];
  for (const feature of input.categoryFeatures ?? []) {
    // A core slug shadows a same-named attribute — which is exactly what the
    // server does with it (`index_schema.CORE_RANGE_FIELDS` reserves the
    // slug), so drawing both would put two controls over one filter.
    if (core.has(feature.slug)) continue;
    // The schema's own numeric types, PLUS anything this answer measured: a
    // vocabulary-backed `year` is a choice in the catalogue and a from/to on
    // the page, and the server measuring it is the fact that settles it.
    // Schema ORDER either way, so an axis does not move when it is measured.
    if (isRangeFeature(feature) || reported.has(feature.slug)) slugs.push(feature.slug);
  }
  // Measured axes the schema never mentioned — a host that hands in no
  // `categoryFeatures` still gets its rows, labelled by slug.
  for (const slug of reported) {
    if (!slugs.includes(slug)) slugs.push(slug);
  }
  for (const slug of Object.keys(input.state.ranges)) {
    if (!slugs.includes(slug)) slugs.push(slug);
  }

  return slugs
    .map((slug): RangeGroup => {
      const isCore = core.has(slug);
      const feature = isCore ? undefined : bySlug.get(slug);
      const config = feature === undefined ? {} : featureConfig(feature);
      const applied: SearchRange | undefined = input.state.ranges[slug];
      // The ANSWER's row for the slug. Read for its caption on every axis
      // including a core one — the server names `price` out of its own
      // `CORE_RANGE_LABELS` — and for its BOUNDS on an attribute axis only:
      // see `BuildRangeGroupsInput.ranges` for why the price input keeps its
      // own ends.
      const axis = bounds?.[slug];
      const measured = !isCore && axis !== undefined;
      const min = measured ? axis.min : num(config["min"]);
      const max = measured ? axis.max : num(config["max"]);
      // The caption, in the order of who is entitled to give one:
      //  1. the ANSWER. `label` is resolved server-side from the same
      //     definition a group heading comes from, it is present for a core
      //     axis the client has no definition for, and it is the only source
      //     a host that threaded no schema has at all.
      //  2. the SCHEMA's own `name`, for a server too old to send one.
      //  3. this package's key for a core axis, same reason as (2).
      // and never the slug, which is storage. An axis none of the three name
      // is dropped below.
      const answered = str(axis?.label);
      const named =
        answered !== undefined || isCore || feature !== undefined;
      const label =
        answered !== undefined
          ? // `label_translatable: false` is literal text the catalogue wrote
            // and must not be looked up; absent means the server did not say,
            // and a lookup that misses returns the string unchanged.
            axis?.label_translatable === false
            ? answered
            : translate(input.t, answered)
          : isCore
            ? translate(input.t, coreRangeLabelKey(slug))
            : feature === undefined
              ? slug
              : translate(input.t, featureName(feature));
      return {
        slug,
        label,
        named,
        feature,
        from: applied?.from,
        to: applied?.to,
        min,
        max,
        measured,
        // The unit, same precedence and same reason: the answer resolved it
        // off the definition (a `convertible_unit`'s BASE unit, which the
        // client cannot work out from `unit_m`/`unit_i` alone), the schema's
        // own affixes second. Translated, because the server states plainly
        // that it never translates one and the string may be a key.
        //
        // A core money axis carries a CURRENCY, not a unit suffix: "₽" is
        // formatted from the code for the reader's locale, a unit suffix is a
        // literal the category author typed.
        unit: isCore
          ? undefined
          : str(axis?.unit) !== undefined
            ? translate(input.t, str(axis?.unit) ?? "")
            : (str(config["postfix"]) ?? str(config["unit_m"]) ?? str(config["unit_i"])),
        step: !isCore && isIntegerAxis(feature, min, max, measured) ? 1 : undefined,
        picker: isCore ? undefined : pickerValues(feature, min, max, measured),
        active: applied !== undefined,
        core: isCore,
        currency: isCore ? str(input.currency) : undefined,
        order: typeof axis?.order === "number" ? axis.order : undefined,
      };
    })
    .filter((group) => {
      // A CONSTRAINT ALWAYS KEEPS ITS CONTROL. Everything below removes a row
      // the reader has not used; a row they have is never one of them.
      if (group.active) return true;
      // The server planned this axis and declined to offer it — sparse, or
      // unnameable. The schema still declares the same slug, so without this
      // the rail would draw exactly the row the answer withheld.
      if (withheld.has(group.slug)) return false;
      // Nobody named it. A from/to picker captioned `kilometrage` is a control
      // whose meaning a reader has to guess out of the numbers inside it,
      // which is not a filter — the same judgement stapel-search 0.16.0 makes
      // on the wire, made again here for the rows that come from the schema.
      return group.named;
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
