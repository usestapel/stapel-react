/**
 * Display — the read-only half. Every builtin type formats, and the two
 * absences stay distinguishable: "nothing was entered" versus "this build
 * cannot read this type".
 */
import { describe, expect, it } from "vitest";
import { FORMATTABLE_TYPES, formatFeatureValue, hexColorSwatch } from "../src/format.js";
import {
  BOOL_FEATURE,
  CONVERTIBLE_FEATURE,
  DATE_FEATURE,
  FLOAT_FEATURE,
  HEADER_FEATURE,
  HEX_COLOR_FEATURE,
  HIERARCHICAL_FEATURE,
  INT_FEATURE,
  MULTI_SELECT_FEATURE,
  SELECT_FEATURE,
  STRING_FEATURE,
  UNKNOWN_TYPE_FEATURE,
  feature,
} from "./fixtures.js";

describe("every builtin type formats", () => {
  it("string, with its prefix and postfix", () => {
    expect(formatFeatureValue(STRING_FEATURE, { type: "string", value: "Golf" })).toBe("Golf");
    const priced = feature("price", { type: "string", prefix: "$", postfix: "each" });
    expect(formatFeatureValue(priced, { type: "string", value: "9" })).toBe("$9 each");
  });

  it("int with no decimals, float with the config's precision and unit", () => {
    expect(formatFeatureValue(INT_FEATURE, { type: "int", value: 2010 })).toBe("2010");
    expect(formatFeatureValue(FLOAT_FEATURE, { type: "float", value: 2 })).toBe("2.0 L");
  });

  it("bool, through the config's own captions", () => {
    expect(formatFeatureValue(BOOL_FEATURE, { type: "bool", value: true })).toBe("Negotiable");
    expect(formatFeatureValue(BOOL_FEATURE, { type: "bool", value: false })).toBe("Fixed price");
  });

  it("select, as the option LABELS rather than the stored values", () => {
    expect(formatFeatureValue(SELECT_FEATURE, { type: "select", value: ["petrol"] })).toBe(
      "Petrol"
    );
    expect(
      formatFeatureValue(MULTI_SELECT_FEATURE, { type: "select", value: ["abs", "gps"] })
    ).toBe("ABS, Navigation");
  });

  it("select labels go through the host's catalogue when the options are translatable", () => {
    const f = feature("fuel", {
      type: "select",
      options: [{ value: "petrol", label: "catalog.fuel.petrol" }],
    });
    expect(
      formatFeatureValue(f, { type: "select", value: ["petrol"] }, { t: () => "Бензин" })
    ).toBe("Бензин");
  });

  it("date, from the Unix timestamp it is stored as", () => {
    const seconds = Math.floor(new Date(2010, 5, 15, 12).getTime() / 1000);
    const text = formatFeatureValue(DATE_FEATURE, { type: "date", value: seconds }, {
      locale: "en-GB",
    });
    expect(text).toContain("2010");
    expect(
      formatFeatureValue(
        feature("built", { type: "date", precision: "year" }),
        { type: "date", value: seconds },
        { locale: "en-GB" }
      )
    ).toBe("2010");
  });

  it("hierarchical_select, as the path — the catalogue's LABELS, not the stored values", () => {
    expect(
      formatFeatureValue(HIERARCHICAL_FEATURE, {
        type: "hierarchical_select",
        value: ["passenger", "sedan"],
      })
    ).toBe("Passenger / Sedan");
  });

  it("hierarchical_select keeps a stored value the tree no longer contains", () => {
    expect(
      formatFeatureValue(HIERARCHICAL_FEATURE, {
        type: "hierarchical_select",
        value: ["passenger", "retired_body_style"],
      })
    ).toBe("Passenger / retired_body_style");
  });

  it("hierarchical_select labels go through the catalogue when translatable", () => {
    const f = feature("body", {
      type: "hierarchical_select",
      options: [{ value: "passenger", label: "catalog.body.passenger" }],
    });
    expect(
      formatFeatureValue(f, { type: "hierarchical_select", value: ["passenger"] }, {
        t: () => "Легковой",
      })
    ).toBe("Легковой");
  });

  it("hex_color, by its label when it has one and its category otherwise", () => {
    expect(
      formatFeatureValue(HEX_COLOR_FEATURE, {
        type: "hex_color",
        value: { simple: "red", hex: "#FF0000", label: "Ruby" },
      })
    ).toBe("Ruby");
    expect(
      formatFeatureValue(HEX_COLOR_FEATURE, {
        type: "hex_color",
        value: { simple: "blue" },
      })
    ).toBe("blue");
  });

  it("convertible_unit, with the unit it was entered in", () => {
    expect(
      formatFeatureValue(CONVERTIBLE_FEATURE, {
        type: "convertible_unit",
        value: 4.2,
        unit: "ft",
      })
    ).toBe("4.20 ft");
  });

  it("header — nothing: it is a caption, and it holds no value", () => {
    expect(formatFeatureValue(HEADER_FEATURE, { type: "header", value: "x" })).toBeUndefined();
  });
});

describe("the two absences stay different", () => {
  it("returns undefined for a blank value", () => {
    expect(formatFeatureValue(STRING_FEATURE, undefined)).toBeUndefined();
    expect(formatFeatureValue(STRING_FEATURE, { type: "string", value: "" })).toBeUndefined();
  });

  it("returns undefined for a type it cannot read — the caller says WHICH", () => {
    expect(
      formatFeatureValue(UNKNOWN_TYPE_FEATURE, { type: "size_grid", value: { rowIndex: 2 } })
    ).toBeUndefined();
  });
});

describe("hexColorSwatch", () => {
  it("extracts a well-formed hex, and nothing else", () => {
    expect(hexColorSwatch({ type: "hex_color", value: { simple: "red", hex: "#FF0000" } })).toBe(
      "#FF0000"
    );
    expect(hexColorSwatch({ type: "hex_color", value: { simple: "red" } })).toBeUndefined();
    expect(
      hexColorSwatch({ type: "hex_color", value: { simple: "red", hex: "not a colour" } })
    ).toBeUndefined();
    expect(hexColorSwatch(undefined)).toBeUndefined();
  });
});

describe("FORMATTABLE_TYPES", () => {
  it("is sorted and complete", () => {
    expect([...FORMATTABLE_TYPES].sort()).toEqual([...FORMATTABLE_TYPES]);
    // Thirteen since stapel-attributes 0.6.0: the two vocabulary-backed types
    // format from the DAO's label snapshot, so a card renders a term without
    // ever reaching a vocabulary, and the composite formats each cell through
    // its own child's type.
    expect(FORMATTABLE_TYPES).toHaveLength(13);
  });
});
