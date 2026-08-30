/**
 * The rule engine's edges — the parts the shared corpus cannot reach.
 *
 * `test/rules.golden.test.ts` proves the SEMANTICS against Python's own
 * recording. What it cannot prove is the refusal path: the corpus contains
 * only well-formed rules, because a malformed one is a `FeatureValidationError`
 * upstream and never gets an `expect` block recorded for it. So the grammar's
 * refusals, `narrowConfig`'s "replace, never introduce" rule and the number
 * canonicalization at the edges of the double are asserted here.
 */
import { describe, expect, it } from "vitest";
import type { FeatureDef, Rule } from "../src/types.js";
import {
  FeatureRulesError,
  VISIBLE_STATE,
  evaluateRules,
  featureRuleState,
  narrowConfig,
  narrowFeature,
  parseRules,
  ruleErrors,
  stringify,
} from "../src/rules.js";

const REQUIRE_WHEN_USED: Rule = {
  effect: "require",
  when: { all: [{ feature: "condition", op: "in", values: ["used"] }] },
};

function feature(slug: string, extra: Partial<FeatureDef> = {}): FeatureDef {
  return { slug, config: { type: "string" }, ...extra };
}

/** A rule set that deliberately does NOT satisfy the grammar. The generated
 * `Rule` type describes a VALID rule, so a violation has to be cast in — which
 * is itself the point: the only way to get one into a running form is off the
 * wire, where nothing type-checks it. */
function brokenRules(raw: readonly unknown[]): readonly Rule[] {
  return raw as readonly Rule[];
}

describe("parseRules refuses everything outside the closed grammar", () => {
  const cases: readonly [string, unknown][] = [
    ["not a list", { effect: "require" }],
    ["not an object", ["require"]],
    ["unknown rule key", [{ ...REQUIRE_WHEN_USED, nope: 1 }]],
    ["unknown effect", [{ effect: "colour", when: REQUIRE_WHEN_USED.when }]],
    ["missing when", [{ effect: "require" }]],
    ["when with neither connective", [{ effect: "require", when: {} }]],
    [
      "when with both connectives",
      [{ effect: "require", when: { all: [{ feature: "a", op: "filled" }], any: [] } }],
    ],
    ["empty condition list", [{ effect: "require", when: { all: [] } }]],
    ["unknown condition key", [{ effect: "require", when: { all: [{ feature: "a", op: "filled", x: 1 }] } }]],
    ["unknown operator", [{ effect: "require", when: { all: [{ feature: "a", op: "gt", values: ["1"] }] } }]],
    ["`in` without values", [{ effect: "require", when: { all: [{ feature: "a", op: "in" }] } }]],
    ["`in` with empty values", [{ effect: "require", when: { all: [{ feature: "a", op: "in", values: [] }] } }]],
    ["non-string values", [{ effect: "require", when: { all: [{ feature: "a", op: "in", values: [1] }] } }]],
    ["`filled` with values", [{ effect: "require", when: { all: [{ feature: "a", op: "filled", values: ["x"] }] } }]],
    ["option outside forbid_option", [{ ...REQUIRE_WHEN_USED, option: "x" }]],
    ["forbid_option without option", [{ effect: "forbid_option", when: REQUIRE_WHEN_USED.when }]],
    ["min/max outside limit", [{ ...REQUIRE_WHEN_USED, max: 3 }]],
    ["limit with neither bound", [{ effect: "limit", when: REQUIRE_WHEN_USED.when }]],
    ["limit with a non-number bound", [{ effect: "limit", max: "3", when: REQUIRE_WHEN_USED.when }]],
  ];

  it.each(cases)("%s", (_name, raw) => {
    expect(() => parseRules(raw)).toThrow(FeatureRulesError);
  });

  it("carries the engine's own code and key, so a caller can surface it", () => {
    try {
      parseRules([{ effect: "nope" }], "screen_state");
      expect.unreachable("should have thrown");
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(FeatureRulesError);
      const error = thrown as FeatureRulesError;
      expect(error.code).toBe("invalid_rules");
      expect(error.localizable_error).toBe("error.400.feature_invalid_rules");
      expect(error.slug).toBe("screen_state");
    }
  });

  it("treats null, undefined and [] as no rules — and nothing else", () => {
    expect(parseRules(null)).toEqual([]);
    expect(parseRules(undefined)).toEqual([]);
    expect(parseRules([])).toEqual([]);
  });
});

describe("a malformed rule set is never silently 'no rules'", () => {
  const broken = feature("screen_state", { rules: brokenRules([{ effect: "nope" }]), mandatory: true });

  it("evaluateRules throws, naming the feature", () => {
    expect(() => evaluateRules([broken], {})).toThrow(FeatureRulesError);
  });

  it("ruleErrors reports it per slug so the other rows still draw", () => {
    const errors = ruleErrors([feature("title"), broken]);
    expect(Object.keys(errors)).toEqual(["screen_state"]);
    expect(errors["screen_state"]).toContain("effect");
  });

  it("a header's rules are not parsed at all — it is always visible", () => {
    const header = feature("section", {
      config: { type: "header" },
      rules: brokenRules([{ effect: "nope" }]),
    });
    expect(ruleErrors([header])).toEqual({});
    expect(evaluateRules([header], {})["section"]).toEqual(VISIBLE_STATE);
  });
});

describe("stringify at the edges of a double", () => {
  it("prints an integral float in full rather than in exponent form", () => {
    expect(stringify(1e20)).toEqual(["100000000000000000000"]);
    expect(stringify(1e21)).toEqual(["1000000000000000000000"]);
  });

  it("expands a tiny float instead of using an exponent", () => {
    expect(stringify(1e-7)).toEqual(["0.0000001"]);
    expect(stringify(1.5e-7)).toEqual(["0.00000015"]);
  });

  it("keeps false and zero FILLED — they are answers, not absences", () => {
    expect(stringify(false)).toEqual(["false"]);
    expect(stringify(0)).toEqual(["0"]);
    expect(stringify("")).toEqual([]);
    expect(stringify([])).toEqual([]);
  });

  it("unwraps a DTO envelope and drops any other object", () => {
    expect(stringify({ type: "select", value: ["a", "b"] })).toEqual(["a", "b"]);
    expect(stringify({ other: 1 })).toEqual([]);
  });
});

describe("narrowConfig replaces, and never introduces", () => {
  const bounded = { type: "int", min: 1, max: 100 };

  it("replaces a declared bound", () => {
    const narrowed = narrowConfig(bounded, { ...VISIBLE_STATE, max: 10 });
    expect(narrowed).toEqual({ type: "int", min: 1, max: 10 });
  });

  it("adds nothing to a config that declares no bound", () => {
    const open = { type: "int" };
    expect(narrowConfig(open, { ...VISIBLE_STATE, min: 5, max: 10 })).toBe(open);
  });

  it("drops a forbidden option and keeps object identity when it drops none", () => {
    const config = {
      type: "select",
      options: [
        { value: "pickup", label: "pickup" },
        { value: "post", label: "post" },
      ],
    };
    expect(narrowConfig(config, { ...VISIBLE_STATE, forbiddenOptions: ["post"] })).toEqual({
      type: "select",
      options: [{ value: "pickup", label: "pickup" }],
    });
    expect(narrowConfig(config, { ...VISIBLE_STATE, forbiddenOptions: ["ferry"] })).toBe(config);
  });

  it("narrowFeature hands the editor a feature, not a config", () => {
    const int = feature("weight", { config: bounded });
    const narrowed = narrowFeature(int, { ...VISIBLE_STATE, max: 10 });
    expect(narrowed.config["max"]).toBe(10);
    expect(narrowed.slug).toBe("weight");
    expect(narrowFeature(int, VISIBLE_STATE)).toBe(int);
  });
});

describe("featureRuleState — one row, out of context", () => {
  const screen = feature("screen_state", { rules: [REQUIRE_WHEN_USED] });

  it("reads the controlling answer straight off the form's values", () => {
    expect(featureRuleState(screen, { condition: ["used"] }).required).toBe(true);
    expect(featureRuleState(screen, { condition: ["new"] }).required).toBe(false);
  });

  it("agrees with the whole-set evaluation when the controller is in the set", () => {
    const features = [feature("condition", { config: { type: "select" } }), screen];
    const values = { condition: ["used"] };
    expect(featureRuleState(screen, values)).toEqual(evaluateRules(features, values)["screen_state"]);
  });
});
