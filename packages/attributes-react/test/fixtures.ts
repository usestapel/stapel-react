/**
 * Feature fixtures — one per builtin type, each shaped like a row of
 * `GET /categories/api/v1/categories/{id}/features/`
 * (`FeatureCompactSerializer`: id, tn_parent, name, slug, icon, comment,
 * config, mandatory, show_as_badge, show_at_title, translate).
 *
 * The configs carry only the keys a real admin would set, NOT the type's full
 * defaulted config — deliberately, because that endpoint serializes
 * `obj.config` verbatim rather than `get_config_with_defaults()`. A fixture
 * carrying every default would test a payload the storefront never receives.
 */
import type { FeatureDef } from "../src/types.js";
import type { VocabularyClient } from "../src/vocabulary.js";

export function feature(
  slug: string,
  config: Record<string, unknown>,
  extra: Partial<FeatureDef> = {}
): FeatureDef {
  return {
    slug,
    name: slug.replace(/_/g, " "),
    config,
    mandatory: false,
    show_as_badge: false,
    show_at_title: false,
    translate: "all",
    ...extra,
  };
}

export const STRING_FEATURE: FeatureDef = feature("title", {
  type: "string",
  maxLength: 10,
});

export const INT_FEATURE: FeatureDef = feature("year", {
  type: "int",
  min: 1900,
  max: 2030,
});

export const FLOAT_FEATURE: FeatureDef = feature("engine", {
  type: "float",
  min: 0.5,
  max: 8,
  precision: 1,
  postfix: "L",
});

export const BOOL_FEATURE: FeatureDef = feature("negotiable", {
  type: "bool",
  trueLabel: "Negotiable",
  falseLabel: "Fixed price",
});

export const SELECT_FEATURE: FeatureDef = feature("fuel", {
  type: "select",
  maxSelected: 1,
  uiStyle: "chips",
  translatable_options: false,
  options: [
    { value: "petrol", label: "Petrol" },
    { value: "diesel", label: "Diesel" },
  ],
});

export const MULTI_SELECT_FEATURE: FeatureDef = feature("extras", {
  type: "select",
  minSelected: 1,
  maxSelected: 3,
  translatable_options: false,
  options: [
    { value: "abs", label: "ABS" },
    { value: "esp", label: "ESP" },
    { value: "ac", label: "Air conditioning" },
    { value: "gps", label: "Navigation" },
    { value: "roof", label: "Sunroof" },
  ],
});

export const DATE_FEATURE: FeatureDef = feature("registered", {
  type: "date",
  precision: "date",
});

export const HEADER_FEATURE: FeatureDef = feature("engine_section", {
  type: "header",
  style: "l",
});

export const HEX_COLOR_FEATURE: FeatureDef = feature("colour", {
  type: "hex_color",
  allowCustom: true,
  options: [
    { simple: "red", hex: "#FF0000", label: "Red" },
    { simple: "blue", hex: "#0000FF", label: "Blue" },
  ],
});

export const HIERARCHICAL_FEATURE: FeatureDef = feature("body", {
  type: "hierarchical_select",
  translatable_options: false,
  options: [
    {
      value: "passenger",
      label: "Passenger",
      children: [
        { value: "sedan", label: "Sedan" },
        { value: "hatchback", label: "Hatchback" },
      ],
    },
    { value: "commercial", label: "Commercial" },
  ],
});

export const CONVERTIBLE_FEATURE: FeatureDef = feature("length", {
  type: "convertible_unit",
  unitType: "length",
  unit_m: "m",
  unit_i: "ft",
  precision: 2,
  min: 0,
  max: 100,
});

export const REF_SELECT_FEATURE: FeatureDef = feature("vendor", {
  type: "ref_select",
  optionsRef: { vocabulary: "phone-models", level: "Vendor" },
  maxSelected: 1,
});

/** The child of {@link REF_SELECT_FEATURE}: its level is narrowed to the
 * vendor's children, and its own answer is cleared when the vendor moves. */
export const REF_SELECT_CHILD_FEATURE: FeatureDef = feature("model", {
  type: "ref_select",
  optionsRef: { vocabulary: "phone-models", level: "Model", parentFeature: "vendor" },
  maxSelected: 1,
});

export const REF_HIERARCHICAL_FEATURE: FeatureDef = feature("make_model", {
  type: "ref_hierarchical_select",
  vocabulary: "car-models",
  levels: ["Make", "Model", "Generation"],
  minDepth: 1,
  maxDepth: 3,
});

/** A type no build of this package knows — the third rung's fixture. */
export const UNKNOWN_TYPE_FEATURE: FeatureDef = feature("size_grid", {
  type: "size_grid",
  table: "clothing_women",
});

/**
 * The composite: a wholesale discount ladder — "quantity from N, discount
 * M %", up to five steps. Children are full feature definitions of ordinary
 * kinds; the parent's row cap lives in `repeat`, never in a child's bounds.
 */
export const GROUP_FEATURE: FeatureDef = feature("discount_ladder", {
  type: "group",
  fields: [
    feature("quantity", { type: "int", min: 1, max: 10000000 }, { mandatory: true }),
    feature("discount", { type: "int", min: 1, max: 30, postfix: "%" }),
  ],
  repeat: { min: 1, max: 5 },
});

/** A single-row composite: no `repeat`, so no add/remove chrome at all. */
export const SINGLE_ROW_GROUP_FEATURE: FeatureDef = feature("warranty", {
  type: "group",
  fields: [
    feature("months", { type: "int", min: 1, max: 60 }),
    feature("provider", { type: "string", maxLength: 40 }),
  ],
  repeat: null,
});

/** A row whose config declares no type at all. */
export const UNTYPED_FEATURE_DEF: FeatureDef = feature("broken", {});

/** Every builtin, in registry order — the thirteen-type sweep. */
export const ALL_BUILTIN_FEATURES: readonly FeatureDef[] = [
  BOOL_FEATURE,
  CONVERTIBLE_FEATURE,
  DATE_FEATURE,
  FLOAT_FEATURE,
  GROUP_FEATURE,
  HEADER_FEATURE,
  HEX_COLOR_FEATURE,
  HIERARCHICAL_FEATURE,
  INT_FEATURE,
  REF_HIERARCHICAL_FEATURE,
  REF_SELECT_FEATURE,
  SELECT_FEATURE,
  STRING_FEATURE,
];

/**
 * A vocabulary source for the suites that only need the ref editors to DRAW.
 *
 * Not a mock of the module under test: the seam IS two functions
 * (`@stapel/vocabularies-react` satisfies it structurally, without importing
 * it), so a table is exactly the shape a host hands in. The behavioural claims
 * — debounce, supersede, parent narrowing — live in
 * `test/vocabulary.test.tsx`, against a client whose calls are counted.
 */
export const STUB_VOCABULARY_CLIENT: VocabularyClient = {
  async search() {
    return [{ code: "apple", label: "Apple", has_children: true }];
  },
  async resolve() {
    return { apple: "Apple" };
  },
};
