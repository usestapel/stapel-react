/**
 * The client-side mirror — it must agree with `stapel_attributes
 * .validate_dto_structured`, rule for rule, and stand down where it cannot.
 *
 * Two of these tests exist because getting them wrong is invisible until a
 * person is staring at a refusal they cannot understand:
 *
 *  - `pattern` is a FULL match (`re.fullmatch`). A prefix match here would
 *    pass a value the server refuses — the mirror telling someone their input
 *    is fine right before the submit bounces.
 *  - string length is counted in Unicode CODE POINTS on both sides. The emoji
 *    below are not decoration: `"👍👍👍👍👍"` is 5 code points and 10 UTF-16
 *    code units, so a `maxLength: 6` field either accepts it (correct) or
 *    refuses it (JavaScript's `.length`, wrong).
 */
import { describe, expect, it } from "vitest";
import {
  codePointLength,
  featureAnswerRequired,
  isBlank,
  mirrorValidate,
  patternFullMatch,
  validateFeatureValue,
} from "../src/validate.js";
import { defaultFeatureValue, initialFeatureValues } from "../src/useFeatureFields.js";
import { featureErrorsBySlug } from "../src/errors.js";
import type { FeaturesDto, Rule } from "../src/types.js";
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

/** A rule set that deliberately breaks the grammar — see `test/rules.test.ts`
 * for why a cast is the only way to write one. */
function brokenRules(raw: readonly unknown[]): readonly Rule[] {
  return raw as readonly Rule[];
}

function refuse(f: Parameters<typeof validateFeatureValue>[0], value: unknown): string | undefined {
  const result = validateFeatureValue(f, { type: String(f.config?.type), value });
  return result?.status === "validation_failed" ? (result.error ?? undefined) : undefined;
}

describe("blankness — the one shape the mandatory rule fires on", () => {
  it("matches the engine's predicate exactly", () => {
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank("")).toBe(true);
    expect(isBlank([])).toBe(true);
    // Answers, not absences.
    expect(isBlank(false)).toBe(false);
    expect(isBlank(0)).toBe(false);
    expect(isBlank(" ")).toBe(false);
  });

  it("an empty mandatory feature is missing; an empty optional one is fine", () => {
    const required = { ...STRING_FEATURE, mandatory: true };
    expect(refuse(required, "")).toBe("mandatory_missing");
    expect(refuse(STRING_FEATURE, "")).toBeUndefined();
  });
});

describe("string", () => {
  it("counts length in Unicode code points, not UTF-16 code units", () => {
    expect(codePointLength("👍👍👍👍👍")).toBe(5);
    expect("👍👍👍👍👍".length).toBe(10); // what a naive mirror would count
    const f = feature("t", { type: "string", maxLength: 6 });
    expect(refuse(f, "👍👍👍👍👍")).toBeUndefined();
    expect(refuse(f, "👍👍👍👍👍👍👍")).toBe("above_maximum");
  });

  it("enforces minLength in code points too", () => {
    const f = feature("t", { type: "string", minLength: 4 });
    expect(refuse(f, "👍👍👍")).toBe("below_minimum");
    expect(refuse(f, "👍👍👍👍")).toBeUndefined();
  });

  it("matches `pattern` against the WHOLE value (re.fullmatch), not a prefix", () => {
    const f = feature("t", { type: "string", pattern: "[A-Z]{3}" });
    expect(refuse(f, "ABC")).toBeUndefined();
    // A prefix match would let this through; fullmatch does not.
    expect(refuse(f, "ABCD")).toBe("invalid_format");
    expect(refuse(f, "xABC")).toBe("invalid_format");
  });

  it("stands down on a pattern JavaScript cannot compile — the server refuses it, not us", () => {
    const f = feature("t", { type: "string", pattern: "(?<=a)b" + "[" });
    expect(patternFullMatch("[", "x")).toBeUndefined();
    expect(refuse(f, "anything")).toBeUndefined();
  });

  it("treats an options list as OPEN unless allowCustom is explicitly false", () => {
    const open = feature("t", { type: "string", options: ["a", "b"] });
    expect(refuse(open, "z")).toBeUndefined(); // allowCustom defaults to true
    const closed = feature("t", { type: "string", options: ["a", "b"], allowCustom: false });
    expect(refuse(closed, "z")).toBe("not_in_options");
    expect(refuse(closed, "a")).toBeUndefined();
  });
});

describe("int / float", () => {
  it("refuses a non-number and honours min/max", () => {
    expect(refuse(INT_FEATURE, "not a year")).toBe("invalid_type");
    expect(refuse(INT_FEATURE, 1800)).toBe("below_minimum");
    expect(refuse(INT_FEATURE, 2100)).toBe("above_maximum");
    expect(refuse(INT_FEATURE, 2010)).toBeUndefined();
  });

  it("truncates a fractional int the way Python's int() does, rather than inventing a refusal", () => {
    // `int(1899.9)` is 1899 — below the fixture's min, so the refusal that
    // fires is the RANGE one the server would report, not a type error.
    expect(refuse(INT_FEATURE, 1899.9)).toBe("below_minimum");
    expect(refuse(INT_FEATURE, 2010.7)).toBeUndefined();
  });

  it("checks float ranges and refuses a boolean posing as a number", () => {
    expect(refuse(FLOAT_FEATURE, 0.1)).toBe("below_minimum");
    expect(refuse(FLOAT_FEATURE, 9)).toBe("above_maximum");
    expect(refuse(FLOAT_FEATURE, 2.5)).toBeUndefined();
    expect(refuse(FLOAT_FEATURE, true)).toBe("invalid_type");
  });
});

describe("bool", () => {
  it("accepts the engine's whole truthy vocabulary and refuses the rest", () => {
    for (const value of [true, false, 1, 0, "yes", "no", "ON", "off", "TRUE"]) {
      expect(refuse(BOOL_FEATURE, value)).toBeUndefined();
    }
    expect(refuse(BOOL_FEATURE, "maybe")).toBe("invalid_type");
    expect(refuse(BOOL_FEATURE, {})).toBe("invalid_type");
  });
});

describe("select", () => {
  it("wants a LIST even for a single choice", () => {
    expect(refuse(SELECT_FEATURE, "petrol")).toBe("invalid_type");
    expect(refuse(SELECT_FEATURE, ["petrol"])).toBeUndefined();
  });

  it("refuses an option outside the config's list", () => {
    expect(refuse(SELECT_FEATURE, ["kerosene"])).toBe("not_in_options");
  });

  it("enforces minSelected / maxSelected and refuses duplicates", () => {
    expect(refuse(MULTI_SELECT_FEATURE, ["abs", "esp", "ac", "gps"])).toBe("above_maximum");
    expect(refuse(MULTI_SELECT_FEATURE, ["abs", "abs"])).toBe("invalid_format");
    expect(refuse(MULTI_SELECT_FEATURE, ["abs", "esp"])).toBeUndefined();
  });
});

describe("date — a Unix timestamp, not an ISO string", () => {
  const day = 24 * 60 * 60;

  it("enforces minDate / maxDate in seconds", () => {
    const f = feature("d", { type: "date", minDate: 1000 * day, maxDate: 2000 * day });
    expect(refuse(f, 500 * day)).toBe("below_minimum");
    expect(refuse(f, 3000 * day)).toBe("above_maximum");
    expect(refuse(f, 1500 * day)).toBeUndefined();
  });

  it("enforces allowFuture / allowPast against now", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(refuse(feature("d", { type: "date", allowFuture: false }), now + day)).toBe(
      "above_maximum"
    );
    expect(refuse(feature("d", { type: "date", allowPast: false }), now - day)).toBe(
      "below_minimum"
    );
  });

  it("mirrors the engine's coercion of an unparseable value to null — including that it PASSES", () => {
    // `normalize_dto` turns anything unparseable into None and `validate_dto`
    // returns early on None. Refusing here would block a submit the server
    // accepts, which is the one thing a mirror may never do.
    expect(refuse(DATE_FEATURE, "not a date")).toBeUndefined();
  });
});

describe("hex_color — an object, not a hex string", () => {
  it("refuses a bare hex string", () => {
    expect(refuse(HEX_COLOR_FEATURE, "#FF0000")).toBe("invalid_type");
  });

  it("requires `simple`, and requires it to be a known colour category", () => {
    expect(refuse(HEX_COLOR_FEATURE, { hex: "#FF0000" })).toBe("invalid_format");
    expect(refuse(HEX_COLOR_FEATURE, { simple: "chartreuse" })).toBe("not_in_options");
    expect(refuse(HEX_COLOR_FEATURE, { simple: "red", hex: "#FF0000" })).toBeUndefined();
  });

  it("refuses a malformed hex", () => {
    expect(refuse(HEX_COLOR_FEATURE, { simple: "red", hex: "FF0000" })).toBe("invalid_format");
    expect(refuse(HEX_COLOR_FEATURE, { simple: "red", hex: "#F00" })).toBeUndefined();
  });

  it("closes the option set when allowCustom is off", () => {
    const closed = feature("c", {
      type: "hex_color",
      allowCustom: false,
      options: [{ simple: "red", hex: "#FF0000" }],
    });
    expect(refuse(closed, { simple: "blue" })).toBe("not_in_options");
    expect(refuse(closed, { simple: "red" })).toBeUndefined();
  });
});

describe("hierarchical_select", () => {
  it("walks the path level by level and refuses a step that is not a child of the previous one", () => {
    expect(refuse(HIERARCHICAL_FEATURE, ["passenger", "sedan"])).toBeUndefined();
    expect(refuse(HIERARCHICAL_FEATURE, ["commercial", "sedan"])).toBe("not_in_options");
    expect(refuse(HIERARCHICAL_FEATURE, ["spaceship"])).toBe("not_in_options");
  });

  it("enforces minDepth / maxDepth", () => {
    const deep = feature("b", {
      type: "hierarchical_select",
      minDepth: 2,
      options: HIERARCHICAL_FEATURE.config?.["options"],
    });
    expect(refuse(deep, ["passenger"])).toBe("below_minimum");
    expect(refuse(deep, ["passenger", "sedan"])).toBeUndefined();
  });
});

describe("convertible_unit", () => {
  it("checks the number and the unit code", () => {
    expect(
      validateFeatureValue(CONVERTIBLE_FEATURE, {
        type: "convertible_unit",
        value: "nope",
        unit: "m",
      })?.error
    ).toBe("invalid_type");
    expect(
      validateFeatureValue(CONVERTIBLE_FEATURE, {
        type: "convertible_unit",
        value: 4.2,
        unit: "furlong",
      })?.error
    ).toBe("not_in_options");
    expect(
      validateFeatureValue(CONVERTIBLE_FEATURE, {
        type: "convertible_unit",
        value: 4.2,
        unit: "ft",
      })?.status
    ).toBe("ok");
  });

  it("leaves the RANGE to the server, because min/max are in the base unit", () => {
    // 500 ft is over the fixture's max of 100 — but only after converting to
    // metres, and the conversion table is Python-side. Refusing here would
    // report "too large" for a number the server accepts in the other system.
    expect(
      validateFeatureValue(CONVERTIBLE_FEATURE, {
        type: "convertible_unit",
        value: 500,
        unit: "ft",
      })?.status
    ).toBe("ok");
  });
});

describe("header", () => {
  it("produces no row at all — it is a caption, never an answer", () => {
    expect(validateFeatureValue(HEADER_FEATURE, { type: "header", value: "x" })).toBeUndefined();
    const batch = mirrorValidate([{ ...HEADER_FEATURE, mandatory: true }], {});
    expect(batch.results).toEqual([]);
    expect(batch.valid).toBe(true);
  });
});

describe("an unknown type is the server's to judge", () => {
  it("passes a value of a type the mirror cannot read", () => {
    expect(
      validateFeatureValue(UNKNOWN_TYPE_FEATURE, { type: "size_grid", value: { rowIndex: 3 } })
        ?.status
    ).toBe("ok");
  });

  it("but still reports it missing when it is mandatory and blank", () => {
    expect(
      validateFeatureValue({ ...UNKNOWN_TYPE_FEATURE, mandatory: true }, {
        type: "size_grid",
        value: null,
      })?.error
    ).toBe("mandatory_missing");
  });
});

describe("mirrorValidate — the batch, and the engine's two passes", () => {
  const features = [
    { ...STRING_FEATURE, mandatory: true },
    INT_FEATURE,
    { ...SELECT_FEATURE, mandatory: true },
  ];

  it("returns the engine's own envelope shape", () => {
    const batch = mirrorValidate(features, {
      title: { type: "string", value: "ok" },
      year: { type: "int", value: 2010 },
      fuel: { type: "select", value: ["petrol"] },
    });
    expect(batch).toEqual({
      valid: true,
      results: [
        { slug: "title", status: "ok" },
        { slug: "year", status: "ok" },
        { slug: "fuel", status: "ok" },
      ],
    });
  });

  it("reports a mandatory feature that was never submitted at all", () => {
    const batch = mirrorValidate(features, { year: { type: "int", value: 2010 } });
    expect(batch.valid).toBe(false);
    expect(batch.results.map((r) => [r.slug, r.error])).toEqual([
      ["year", undefined],
      ["title", "mandatory_missing"],
      ["fuel", "mandatory_missing"],
    ]);
  });

  it("ignores a submitted slug the category does not allow — the engine's documented behaviour", () => {
    const batch = mirrorValidate([INT_FEATURE], {
      year: { type: "int", value: 2010 },
      not_a_feature: { type: "string", value: "x" },
    } as FeaturesDto);
    expect(batch.results.map((r) => r.slug)).toEqual(["year"]);
  });

  it("carries the engine's own localizable key and params on every refusal", () => {
    const batch = mirrorValidate([{ ...INT_FEATURE, mandatory: true }], {
      year: { type: "int", value: 1800 },
    });
    expect(batch.results[0]).toEqual({
      slug: "year",
      status: "validation_failed",
      error: "below_minimum",
      localizable_error: "error.400.feature_below_minimum",
      params: { feature: "year", slug: "year" },
      ref_value: 1900,
    });
  });
});

describe("featureErrorsBySlug — a verdict, laid out on the controls", () => {
  it("keys refusals by slug and adds the `field` the fleet's field-error convention routes on", () => {
    const batch = mirrorValidate([{ ...STRING_FEATURE, mandatory: true }, INT_FEATURE], {
      year: { type: "int", value: 9999 },
    });
    const errors = featureErrorsBySlug(batch);
    expect(Object.keys(errors).sort()).toEqual(["title", "year"]);
    expect(errors["year"]?.code).toBe("error.400.feature_above_maximum");
    expect(errors["year"]?.params["field"]).toBe("year");
    expect(errors["year"]?.params["ref_value"]).toBe(2030);
    expect(errors["title"]?.code).toBe("error.400.feature_mandatory_missing");
  });

  it("carries nothing for the rows that passed", () => {
    const batch = mirrorValidate([INT_FEATURE], { year: { type: "int", value: 2010 } });
    expect(featureErrorsBySlug(batch)).toEqual({});
  });

  it("reads a SERVER verdict the same way it reads a mirrored one — one shape, one step", () => {
    const fromServer = {
      valid: false,
      results: [
        {
          slug: "year",
          status: "validation_failed" as const,
          error: "not_in_options" as const,
          localizable_error: "error.400.feature_not_in_options",
          params: { feature: "Year", slug: "year" },
          ref_value: [2010, 2011],
        },
      ],
    };
    const errors = featureErrorsBySlug(fromServer);
    expect(errors["year"]?.code).toBe("error.400.feature_not_in_options");
    expect(errors["year"]?.params["feature"]).toBe("Year");
    expect(errors["year"]?.params["field"]).toBe("year");
  });
});

// ── requiredness once the RULES are in the picture ───────────────────────────

describe("featureAnswerRequired, with the form's answers", () => {
  const condition = feature("condition", {
    type: "select",
    maxSelected: 1,
    options: [
      { value: "new", label: "new" },
      { value: "used", label: "used" },
    ],
  });
  const screen = feature(
    "screen_state",
    { type: "string" },
    {
      rules: [
        { effect: "require", when: { all: [{ feature: "condition", op: "in", values: ["used"] }] } },
      ],
    }
  );
  const hiddenMandatory = feature(
    "warranty",
    { type: "string" },
    {
      mandatory: true,
      rules: [
        { effect: "hide", when: { all: [{ feature: "condition", op: "in", values: ["used"] }] } },
      ],
    }
  );

  it("answers from `mandatory` alone when no values are given", () => {
    expect(featureAnswerRequired(screen)).toBe(false);
    expect(featureAnswerRequired(hiddenMandatory)).toBe(true);
  });

  it("answers from the rule state when they are", () => {
    expect(featureAnswerRequired(screen, { condition: ["used"] })).toBe(true);
    expect(featureAnswerRequired(screen, { condition: ["new"] })).toBe(false);
  });

  it("never requires a HIDDEN feature, whatever it was flagged", () => {
    // The publish gate reads this: a mandatory field the rules removed from the
    // page must not block a submit for an answer nobody can give.
    expect(featureAnswerRequired(hiddenMandatory, { condition: ["used"] })).toBe(false);
    expect(featureAnswerRequired(hiddenMandatory, { condition: ["new"] })).toBe(true);
  });

  it("falls back to the static answer when the rules do not parse", () => {
    const broken = feature("broken", { type: "string" }, { mandatory: true, rules: brokenRules([{ x: 1 }]) });
    expect(featureAnswerRequired(broken, { condition: ["used"] })).toBe(true);
  });

  it("keeps `condition` itself untouched — it controls, it is not controlled", () => {
    expect(featureAnswerRequired(condition, { condition: ["used"] })).toBe(false);
  });
});

describe("the mirror refuses a rule set it cannot parse, on _root", () => {
  it("fails the whole batch rather than blaming a value", () => {
    const broken = feature("broken", { type: "string" }, { rules: brokenRules([{ effect: "nope" }]) });
    const batch = mirrorValidate([broken], {});
    expect(batch.valid).toBe(false);
    expect(batch.results).toHaveLength(1);
    expect(batch.results[0]?.slug).toBe("_root");
    expect(batch.results[0]?.error).toBe("invalid_rules");
    expect(batch.results[0]?.localizable_error).toBe("error.400.feature_invalid_rules");
  });
});

describe("initialFeatureValues", () => {
  it("prefers FeatureDef.default over the type's own", () => {
    const withDefault = feature(
      "fuel",
      {
        type: "select",
        options: [
          { value: "petrol", label: "petrol", default: true },
          { value: "diesel", label: "diesel" },
        ],
      },
      { default: ["diesel"] }
    );
    expect(defaultFeatureValue(withDefault)).toEqual(["diesel"]);
  });

  it("falls back to a select option flagged default, and to date.default", () => {
    const flagged = feature("fuel", {
      type: "select",
      options: [
        { value: "petrol", label: "petrol", default: true },
        { value: "diesel", label: "diesel" },
      ],
    });
    expect(defaultFeatureValue(flagged)).toEqual(["petrol"]);
    expect(defaultFeatureValue(feature("when", { type: "date", default: 1_700_000_000 }))).toBe(
      1_700_000_000
    );
  });

  it("invents nothing for a feature that declares no default", () => {
    expect(defaultFeatureValue(STRING_FEATURE)).toBeUndefined();
    expect(initialFeatureValues([STRING_FEATURE, INT_FEATURE])).toEqual({});
  });

  it("keys only the features that HAVE one", () => {
    const seeded = feature("colour", { type: "string" }, { default: "red" });
    expect(initialFeatureValues([STRING_FEATURE, seeded])).toEqual({ colour: "red" });
  });
});
