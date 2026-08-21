/**
 * The `{slug: {type, value}}` envelope. What goes on the wire is what the
 * server routes on, so the three drops below are behaviour, not tidying.
 */
import { describe, expect, it } from "vitest";
import { fromFeaturesDto, toFeaturesDto } from "../src/dto.js";
import {
  CONVERTIBLE_FEATURE,
  HEADER_FEATURE,
  INT_FEATURE,
  SELECT_FEATURE,
  STRING_FEATURE,
  UNTYPED_FEATURE_DEF,
  feature,
} from "./fixtures.js";

describe("toFeaturesDto", () => {
  it("tags each value with the FEATURE's type, not the editor's guess", () => {
    expect(
      toFeaturesDto([STRING_FEATURE, INT_FEATURE], { title: "Golf", year: 2010 })
    ).toEqual({
      title: { type: "string", value: "Golf" },
      year: { type: "int", value: 2010 },
    });
  });

  it("drops a header — the engine regenerates it and refuses an answer to one", () => {
    expect(toFeaturesDto([HEADER_FEATURE], { engine_section: "anything" })).toEqual({});
  });

  it("drops a feature whose config declares no type — an untaggable row the server cannot route", () => {
    expect(toFeaturesDto([UNTYPED_FEATURE_DEF], { broken: "x" })).toEqual({});
  });

  it("drops blanks rather than sending nulls, and keeps false and zero", () => {
    const features = [
      STRING_FEATURE,
      INT_FEATURE,
      SELECT_FEATURE,
      feature("negotiable", { type: "bool" }),
    ];
    expect(
      toFeaturesDto(features, {
        title: "",
        year: 0,
        fuel: [],
        negotiable: false,
      })
    ).toEqual({
      year: { type: "int", value: 0 },
      negotiable: { type: "bool", value: false },
    });
  });

  it("flattens convertible_unit's editor object into the DTO's value+unit", () => {
    expect(
      toFeaturesDto([CONVERTIBLE_FEATURE], { length: { value: 4.2, unit: "ft" } })
    ).toEqual({ length: { type: "convertible_unit", value: 4.2, unit: "ft" } });
  });

  it("omits `unit` when the editor sent none — the engine reads that as 'already in base units'", () => {
    expect(toFeaturesDto([CONVERTIBLE_FEATURE], { length: { value: 4.2 } })).toEqual({
      length: { type: "convertible_unit", value: 4.2 },
    });
  });
});

describe("fromFeaturesDto", () => {
  it("round-trips a draft back into the map the editors read", () => {
    const features = [STRING_FEATURE, INT_FEATURE, CONVERTIBLE_FEATURE];
    const values = { title: "Golf", year: 2010, length: { value: 4.2, unit: "ft" } };
    expect(fromFeaturesDto(toFeaturesDto(features, values))).toEqual(values);
  });

  it("unwraps every other type to its bare value", () => {
    expect(
      fromFeaturesDto({
        fuel: { type: "select", value: ["petrol"] },
        negotiable: { type: "bool", value: false },
      })
    ).toEqual({ fuel: ["petrol"], negotiable: false });
  });
});
