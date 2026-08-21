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

/** A type no build of this package knows — the third rung's fixture. */
export const UNKNOWN_TYPE_FEATURE: FeatureDef = feature("size_grid", {
  type: "size_grid",
  table: "clothing_women",
});

/** A row whose config declares no type at all. */
export const UNTYPED_FEATURE_DEF: FeatureDef = feature("broken", {});

/** Every builtin, in registry order — the ten-type sweep. */
export const ALL_BUILTIN_FEATURES: readonly FeatureDef[] = [
  BOOL_FEATURE,
  CONVERTIBLE_FEATURE,
  DATE_FEATURE,
  FLOAT_FEATURE,
  HEADER_FEATURE,
  HEX_COLOR_FEATURE,
  HIERARCHICAL_FEATURE,
  INT_FEATURE,
  SELECT_FEATURE,
  STRING_FEATURE,
];
