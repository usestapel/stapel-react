/**
 * Demo fixtures — feature ROWS shaped exactly as a category's
 * `GET /categories/{id}/features/` sends them
 * (`FeatureCompactSerializer`: slug, name, comment, config, mandatory,
 * show_as_badge, show_at_title, translate), plus the stored `{slug: {type,
 * value}}` envelopes a detail page reads back.
 *
 * Two properties of these fixtures are the pair's whole subject and are kept
 * deliberately, not incidentally:
 *
 *  - **`config` carries only the keys an admin actually set.** That endpoint
 *    serializes `obj.config` verbatim rather than `get_config_with_defaults()`,
 *    so a fixture carrying every default would document a payload no
 *    storefront ever receives — and would hide the inverted defaults
 *    (`uiStyle` absent means `dropdown`, `allowCustom` absent means "closed
 *    only if there are options") that the editors exist to get right.
 *  - **`name` is admin content and option labels are translation KEYS.**
 *    `featureName` renders `name` verbatim — the catalogue author typed it —
 *    while `optionLabel` resolves an option's `label` through the host's
 *    catalogue unless `translatable_options` is off. So the names below are
 *    words and the option labels are `demo.*` keys the harness registers; a
 *    demo that photographed `demo.fuel.petrol` would be documenting a bug.
 */
import type { FeatureDef, FeaturesDto } from "../src/index.js";

function feature(
  slug: string,
  name: string,
  config: Record<string, unknown>,
  extra: Partial<FeatureDef> = {}
): FeatureDef {
  return {
    slug,
    name,
    config,
    mandatory: false,
    show_as_badge: false,
    show_at_title: false,
    translate: "all",
    ...extra,
  };
}

// ── text and numbers ────────────────────────────────────────────────────────

/** A section caption. Not a question: no label, no asterisk, no value. */
export const SECTION: FeatureDef = feature("engine_section", "Engine and body", {
  type: "header",
  style: "l",
});

/**
 * `maxLength` is drawn as a CODE-POINT counter rather than a cap — the DOM
 * counts UTF-16 units and the engine counts code points, so a hard cap stops a
 * person two emoji short of the real limit with no explanation.
 */
export const TITLE: FeatureDef = feature(
  "title",
  "Headline",
  { type: "string", maxLength: 60, minLength: 4 },
  { mandatory: true, comment: "As it should read on the card, not the paperwork" }
);

export const YEAR: FeatureDef = feature(
  "year",
  "Year of manufacture",
  { type: "int", min: 1900, max: 2030 },
  { show_as_badge: true }
);

/** `postfix` is a translation key upstream, never literal copy. */
export const ENGINE: FeatureDef = feature(
  "engine",
  "Engine size",
  { type: "float", min: 0.5, max: 8, precision: 1, postfix: "demo.unit.litre" },
  { show_as_badge: true }
);

/** `trueLabel`/`falseLabel` are keys too — a Russian storefront was reading
 * `Negotiable` off an English catalogue until they went through `t()`. */
export const NEGOTIABLE: FeatureDef = feature(
  "negotiable",
  "Price",
  { type: "bool", trueLabel: "demo.price.negotiable", falseLabel: "demo.price.fixed" },
  { show_as_badge: true }
);

// ── choices ─────────────────────────────────────────────────────────────────

/** `uiStyle: "chips"` with four or fewer options — a `Segmented` bar, not the
 * dropdown an ABSENT `uiStyle` would (correctly) mean. */
export const FUEL: FeatureDef = feature("fuel", "Fuel", {
  type: "select",
  maxSelected: 1,
  uiStyle: "chips",
  options: [
    { value: "petrol", label: "demo.fuel.petrol" },
    { value: "diesel", label: "demo.fuel.diesel" },
    { value: "electric", label: "demo.fuel.electric" },
  ],
});

/** Multiple + `checkboxes`: every option visible, and the floor antd's
 * `Select` cannot enforce said in words beside the control. */
export const EXTRAS: FeatureDef = feature("extras", "Equipment", {
  type: "select",
  minSelected: 1,
  maxSelected: 3,
  uiStyle: "checkboxes",
  options: [
    { value: "abs", label: "demo.extra.abs" },
    { value: "esp", label: "demo.extra.esp" },
    { value: "ac", label: "demo.extra.ac" },
    { value: "gps", label: "demo.extra.gps" },
    { value: "roof", label: "demo.extra.roof" },
  ],
});

/** `lockUserInput` — the catalogue fixed this answer. A switched-off control
 * with nothing beside it is the dead rectangle §83 forbids, so the editor
 * renders the reason under it through `GatedControl`. */
export const CONDITION: FeatureDef = feature("condition", "Condition", {
  type: "select",
  maxSelected: 1,
  lockUserInput: true,
  options: [
    { value: "used", label: "demo.condition.used" },
    { value: "new", label: "demo.condition.new" },
  ],
});

export const BODY: FeatureDef = feature("body", "Body type", {
  type: "hierarchical_select",
  minDepth: 2,
  options: [
    {
      value: "passenger",
      label: "demo.body.passenger",
      children: [
        { value: "sedan", label: "demo.body.sedan" },
        { value: "hatchback", label: "demo.body.hatchback" },
      ],
    },
    {
      value: "commercial",
      label: "demo.body.commercial",
      children: [{ value: "van", label: "demo.body.van" }],
    },
  ],
});

/** The value is an OBJECT `{simple, hex?}` — `simple` drawn from the engine's
 * eighteen categories, `hex` an optional refinement of it. */
export const COLOUR: FeatureDef = feature(
  "colour",
  "Colour",
  {
    type: "hex_color",
    allowCustom: true,
    options: [
      { simple: "red", label: "demo.colour.red" },
      { simple: "blue", label: "demo.colour.blue" },
      { simple: "silver", label: "demo.colour.silver" },
    ],
  },
  { show_as_badge: true }
);

// ── dates and units ─────────────────────────────────────────────────────────

/** Stored as a Unix timestamp (an integer), not an ISO string — the axis on
 * which this package differs from `@stapel/forms-react`. */
export const REGISTERED: FeatureDef = feature("registered", "First registered", {
  type: "date",
  precision: "date",
  allowFuture: false,
});

/** "Year only" is a number, not a date: a date input would force a month and a
 * day the admin explicitly said they do not want. */
export const MODEL_YEAR: FeatureDef = feature("model_year", "Model year", {
  type: "date",
  precision: "year",
});

/** `{value, unit}` — the number AS TYPED, tagged with the unit. The editor
 * converts nothing: the server converts to the family's base unit first. */
export const LENGTH: FeatureDef = feature("length", "Length", {
  type: "convertible_unit",
  unitType: "length",
  unit_m: "m",
  unit_i: "ft",
  precision: 2,
  min: 0,
  max: 100,
});

// ── the third rung ──────────────────────────────────────────────────────────

/** A type no build of this package knows. Legal in a catalogue, and the whole
 * reason the ladder has a loud last rung. */
export const SIZE_GRID: FeatureDef = feature(
  "size_grid",
  "Size grid",
  { type: "size_grid", table: "clothing_women" },
  { mandatory: true }
);

/** A row whose config declares no type at all — misconfigured, not exotic, and
 * said with a different sentence for that reason. */
export const BROKEN: FeatureDef = feature("warranty", "Warranty", {});

// ── the sets each demo variant draws ────────────────────────────────────────

export const TEXT_FEATURES: readonly FeatureDef[] = [SECTION, TITLE, YEAR, ENGINE, NEGOTIABLE];
export const CHOICE_FEATURES: readonly FeatureDef[] = [FUEL, EXTRAS, CONDITION, BODY, COLOUR];
export const UNIT_FEATURES: readonly FeatureDef[] = [REGISTERED, MODEL_YEAR, LENGTH];
/** Every builtin type, in one category — the ten-type sweep. */
export const ALL_FEATURES: readonly FeatureDef[] = [
  ...TEXT_FEATURES,
  ...CHOICE_FEATURES,
  ...UNIT_FEATURES,
];

/** A catalogue this build can only draw most of. */
export const MIXED_FEATURES: readonly FeatureDef[] = [SECTION, TITLE, SIZE_GRID, BROKEN];

// ── seeded answers ──────────────────────────────────────────────────────────

/** 2019-06-15T00:00 UTC and 2018-01-01T00:00 UTC, as the engine stores them. */
const REGISTERED_AT = 1_560_556_800;
const MODEL_YEAR_AT = 1_514_764_800;

export const TEXT_VALUES: Readonly<Record<string, unknown>> = {
  title: "Golf 1.6 TDI, one owner",
  year: 2019,
  engine: 1.6,
  negotiable: true,
};

export const CHOICE_VALUES: Readonly<Record<string, unknown>> = {
  fuel: ["diesel"],
  extras: ["abs", "ac"],
  condition: ["used"],
  body: ["passenger", "hatchback"],
  colour: { simple: "blue", hex: "#1E88E5" },
};

export const UNIT_VALUES: Readonly<Record<string, unknown>> = {
  registered: REGISTERED_AT,
  model_year: MODEL_YEAR_AT,
  length: { value: 4.28, unit: "m" },
};

/**
 * Answers a person could type and the mirror refuses — the refusal variant's
 * seed. Each one is a different error CODE, so the row copy differs per field
 * instead of four copies of one sentence.
 */
export const REFUSED_VALUES: Readonly<Record<string, unknown>> = {
  title: "Gol",
  year: 1888,
  engine: 12,
};

/** What a detail page reads back: the same envelope the composer submitted. */
export const STORED: FeaturesDto = {
  title: { type: "string", value: "Golf 1.6 TDI, one owner" },
  year: { type: "int", value: 2019 },
  engine: { type: "float", value: 1.6 },
  negotiable: { type: "bool", value: true },
  fuel: { type: "select", value: ["diesel"] },
  extras: { type: "select", value: ["abs", "ac"] },
  body: { type: "hierarchical_select", value: ["passenger", "hatchback"] },
  colour: { type: "hex_color", value: { simple: "blue", hex: "#1E88E5" } },
  registered: { type: "date", value: REGISTERED_AT },
  length: { type: "convertible_unit", value: 4.28, unit: "m" },
};

/**
 * A stored listing this build cannot fully read: one value of an unknown type,
 * and one feature nobody ever answered. They are DIFFERENT absences and the
 * spec table says so differently — an empty cell would read as "this car has
 * no size grid", which is a third and false statement.
 */
export const STORED_WITH_GAPS: FeaturesDto = {
  title: { type: "string", value: "Golf 1.6 TDI, one owner" },
  size_grid: { type: "size_grid", value: { rowIndex: 2 } },
};
