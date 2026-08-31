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
import type {
  FeatureDef,
  FeaturesDto,
  VocabularyClient,
  VocabularyTerm,
} from "../src/index.js";

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

// ── rules, sections and the two vocabulary-backed types ─────────────────────

/**
 * The controlling field of every rule below. It is an ordinary `select`: a
 * rule is a sibling of `mandatory` on the CONTROLLED feature, and nothing on
 * the controller says it controls anything.
 */
export const PHONE_CONDITION: FeatureDef = feature("condition", "Condition", {
  type: "select",
  maxSelected: 1,
  uiStyle: "chips",
  options: [
    { value: "new", label: "demo.condition.new" },
    { value: "used", label: "demo.condition.used" },
  ],
});

/** Shown AND required only when the phone is used — one field, two effects. */
export const SCREEN_STATE: FeatureDef = feature(
  "screen_state",
  "Screen condition",
  { type: "string", maxLength: 120 },
  {
    description: "demo.help.screen_state",
    example: "demo.example.screen_state",
    rules: [
      { effect: "show", when: { all: [{ feature: "condition", op: "in", values: ["used"] }] } },
      { effect: "require", when: { all: [{ feature: "condition", op: "in", values: ["used"] }] } },
    ],
  }
);

/** A used phone cannot be sent by post: the option is not offered, rather than
 * offered and then refused. */
export const DELIVERY: FeatureDef = feature(
  "delivery",
  "Delivery",
  {
    type: "select",
    maxSelected: 1,
    uiStyle: "checkboxes",
    options: [
      { value: "pickup", label: "demo.delivery.pickup" },
      { value: "post", label: "demo.delivery.post" },
    ],
  },
  {
    rules: [
      {
        effect: "forbid_option",
        option: "post",
        when: { all: [{ feature: "condition", op: "in", values: ["used"] }] },
      },
    ],
  }
);

export const RULE_FEATURES: readonly FeatureDef[] = [PHONE_CONDITION, SCREEN_STATE, DELIVERY];

export const RULES_NEW_VALUES: Readonly<Record<string, unknown>> = { condition: ["new"] };
export const RULES_USED_VALUES: Readonly<Record<string, unknown>> = {
  condition: ["used"],
  screen_state: "two hairline scratches, no chips",
};

/**
 * Sections, help and hints: the metadata 99.9 % of imported fields carry.
 * `group` is key-or-literal exactly like `name`, and section order is the
 * order each group's FIRST feature appears — not alphabetical, because the
 * catalogue's order is the order a person is asked.
 */
export const SECTION_FEATURES: readonly FeatureDef[] = [
  feature(
    "title",
    "Headline",
    { type: "string", maxLength: 60 },
    { description: "demo.help.title", example: "demo.example.title" }
  ),
  feature(
    "power",
    "Power",
    { type: "int", min: 20, max: 800, postfix: "demo.unit.hp" },
    {
      group: "demo.group.engine",
      description: "demo.help.power",
      example: "demo.example.power",
      hints: [{ title: "demo.hint.power.title", content: "demo.hint.power.content" }],
    }
  ),
  feature(
    "engine",
    "Engine volume",
    { type: "float", min: 0.5, max: 8, precision: 1, postfix: "demo.unit.litre" },
    { group: "demo.group.engine", example: "demo.example.engine" }
  ),
  feature(
    "scratches",
    "Scratches and dents",
    { type: "string", multiline: true, maxLength: 300 },
    {
      group: "demo.group.condition",
      description: "demo.help.scratches",
      hints: [
        { title: "demo.hint.honest.title", content: "demo.hint.honest.content" },
        { title: "", content: "demo.hint.photos.content" },
      ],
    }
  ),
];

// ── vocabulary-backed features and the mock client that feeds them ──────────

export const VENDOR: FeatureDef = feature("vendor", "Brand", {
  type: "ref_select",
  optionsRef: { vocabulary: "avito-phones", level: "Vendor" },
  maxSelected: 1,
});

/** The child level. `parentFeature` is read off the form's other answers, so
 * choosing a brand narrows this to that brand's models — and changing the
 * brand clears whatever was chosen here. */
export const MODEL: FeatureDef = feature(
  "model",
  "Model",
  {
    type: "ref_select",
    optionsRef: { vocabulary: "avito-phones", level: "Model", parentFeature: "vendor" },
    maxSelected: 1,
  },
  { description: "demo.help.model" }
);

export const REF_SELECT_FEATURES: readonly FeatureDef[] = [VENDOR, MODEL];

export const CAR_TREE: FeatureDef = feature("make_model", "Make and model", {
  type: "ref_hierarchical_select",
  vocabulary: "avito-cars",
  levels: ["Make", "Model", "Generation"],
  minDepth: 1,
  maxDepth: 3,
});

export const REF_HIERARCHICAL_FEATURES: readonly FeatureDef[] = [CAR_TREE];

/** The in-memory vocabulary the demo's client answers from: two levels of
 * phones and three of cars, which is the smallest thing that shows a parent
 * narrowing a child and a cascader loading a level at a time. */
const TERMS: Readonly<Record<string, Readonly<Record<string, readonly VocabularyTerm[]>>>> = {
  "avito-phones": {
    Vendor: [
      { code: "apple", label: "Apple", has_children: true },
      { code: "samsung", label: "Samsung", has_children: true },
      { code: "xiaomi", label: "Xiaomi", has_children: true },
    ],
    "Model:apple": [
      { code: "iphone-15", label: "iPhone 15" },
      { code: "iphone-15-pro", label: "iPhone 15 Pro" },
      { code: "iphone-14", label: "iPhone 14" },
    ],
    "Model:samsung": [
      { code: "galaxy-s24", label: "Galaxy S24" },
      { code: "galaxy-a55", label: "Galaxy A55" },
    ],
    "Model:xiaomi": [{ code: "redmi-note-13", label: "Redmi Note 13" }],
  },
  "avito-cars": {
    Make: [
      { code: "volkswagen", label: "Volkswagen", has_children: true },
      { code: "skoda", label: "Škoda", has_children: true },
    ],
    "Model:volkswagen": [
      { code: "golf", label: "Golf", has_children: true },
      { code: "passat", label: "Passat", has_children: true },
    ],
    "Model:skoda": [{ code: "octavia", label: "Octavia", has_children: true }],
    "Generation:golf": [
      { code: "mk7", label: "Mk7 (2012—2020)" },
      { code: "mk8", label: "Mk8 (2019—)" },
    ],
    "Generation:passat": [{ code: "b8", label: "B8 (2014—)" }],
    "Generation:octavia": [{ code: "a7", label: "A7 (2013—2020)" }],
  },
};

/**
 * A `VocabularyClient` over {@link TERMS} — what a host hands the provider,
 * with `@stapel/vocabularies-react`'s HTTP client swapped for a table.
 *
 * It is a legitimate stand-in and not a mock of the module under test: the
 * seam IS two functions, `vocabularies-react` satisfies it structurally
 * without importing it, and a demo that reached for a real endpoint could not
 * be photographed offline.
 */
export const DEMO_VOCABULARY_CLIENT: VocabularyClient = {
  async search(vocabulary, level, query, parent) {
    const table = TERMS[vocabulary] ?? {};
    const rows = table[parent === undefined ? level : `${level}:${parent}`] ?? [];
    const needle = query.trim().toLowerCase();
    return needle.length === 0
      ? rows
      : rows.filter((row) => row.label.toLowerCase().includes(needle));
  },
  async resolve(vocabulary, level, codes) {
    const table = TERMS[vocabulary] ?? {};
    const out: Record<string, string> = {};
    for (const rows of Object.values(table)) {
      for (const row of rows) {
        if (row.label.length > 0 && codes.includes(row.code) && level.length > 0) {
          out[row.code] = row.label;
        }
      }
    }
    return out;
  },
};

// ── the composite ───────────────────────────────────────────────────────────

/**
 * `group` — the shape 2 468 Avito fields carry and no other kind could hold:
 * a small TABLE. `DiscountLadderList` is "from N units, M % off", repeated up
 * to five times, and its children are full feature definitions of ordinary
 * kinds — so the cells are the same `int` editors a top-level row would get,
 * bounds and postfix included.
 *
 * The parent's own row cap lives in `repeat`, never in a child's bounds: Avito
 * ships it as `values_range: {max: 5}` on the parent, and reading that as a
 * value bound would have produced a field accepting 3 and refusing a 10 %
 * discount.
 */
export const DISCOUNT_LADDER: FeatureDef = feature(
  "discount_ladder",
  "Wholesale discount",
  {
    type: "group",
    fields: [
      feature("quantity", "From, units", { type: "int", min: 1, max: 1000 }, {
        mandatory: true,
        example: "demo.example.quantity",
      }),
      feature("discount", "Discount", { type: "int", min: 1, max: 30, postfix: "%" }),
    ],
    repeat: { min: 1, max: 5 },
  },
  { description: "demo.help.ladder", group: "demo.group.wholesale" }
);

/** A single-row composite: `repeat: null`, so no add, no remove, no row
 * numbers — a plain fieldset with two cells. */
export const WARRANTY: FeatureDef = feature(
  "warranty",
  "Warranty",
  {
    type: "group",
    fields: [
      feature("months", "Months", { type: "int", min: 1, max: 60 }),
      feature("provider", "Provided by", { type: "string", maxLength: 40 }),
    ],
    repeat: null,
  },
  { description: "demo.help.warranty" }
);

export const GROUP_FEATURES: readonly FeatureDef[] = [DISCOUNT_LADDER, WARRANTY];

export const GROUP_VALUES: Readonly<Record<string, unknown>> = {
  discount_ladder: [
    { quantity: 10, discount: 5 },
    { quantity: 50, discount: 12 },
  ],
  warranty: [{ months: 24, provider: "Manufacturer" }],
};

/** One row filled in, one still blank — the state a repeatable subform is in
 * most of the time a person is using it. */
export const GROUP_PARTIAL_VALUES: Readonly<Record<string, unknown>> = {
  discount_ladder: [{ quantity: 10, discount: 5 }, {}],
};

export const REF_SELECT_VALUES: Readonly<Record<string, unknown>> = {
  vendor: ["apple"],
  model: ["iphone-15-pro"],
};

export const REF_HIERARCHICAL_VALUES: Readonly<Record<string, unknown>> = {
  make_model: ["volkswagen", "golf", "mk7"],
};

/**
 * The same table over a wire that has not answered yet — the state defect C23
 * is about.
 *
 * The first page comes back at once (that is what opening a dropdown gets);
 * a TYPED query never resolves, so the control stays in the window the live
 * stand measured at 400–640 ms per field. It exists so the strict skin gate
 * photographs that window instead of only the two states either side of it: a
 * dropdown that still lists the previous query's terms and a dropdown that
 * lists the new ones look almost identical in a shot, and the whole defect is
 * the moment between them.
 */
export const SLOW_VOCABULARY_CLIENT: VocabularyClient = {
  async search(vocabulary, level, query, parent) {
    if (query.trim().length === 0) {
      return DEMO_VOCABULARY_CLIENT.search(vocabulary, level, query, parent);
    }
    // Never within the life of a screenshot. Not `new Promise(() => {})`: a
    // promise nobody can ever settle is a leak in a viewer that keeps a story
    // mounted, and an hour is the same picture.
    await new Promise((resolve) => setTimeout(resolve, 3_600_000));
    return DEMO_VOCABULARY_CLIENT.search(vocabulary, level, query, parent);
  },
  resolve: (vocabulary, level, codes) =>
    DEMO_VOCABULARY_CLIENT.resolve(vocabulary, level, codes),
};
