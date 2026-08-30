/**
 * THE SHARED CORPUS — the only thing that keeps two rule evaluators honest.
 *
 * `stapel_attributes.rules.evaluate_rules` and this package's `evaluateRules`
 * are two implementations of one closed grammar. Python RECORDS its answers
 * into `tests/golden/rules/{cases,pipeline}/*.json`
 * (`GOLDEN_RECORD=1 pytest tests/test_rules_golden.py`); `pnpm gen:rules`
 * copies that corpus here as a generated artefact under `gen:check`; this file
 * runs EVERY case through the TypeScript half.
 *
 * There is deliberately **no `skipIf`**. A gate that stands down when the
 * fixture is missing is a gate that passes on the day it matters — and the
 * fixture cannot be missing, because it is committed and drift-gated rather
 * than read out of a sibling checkout at test time.
 *
 * Two sets, two claims:
 *
 *  - `cases` — pure `evaluateRules` semantics, compared to Python's recorded
 *    `expect` EXACTLY, through `ruleStateToJson` (the corpus's own spelling).
 *  - `pipeline` — the end-to-end effect. The Python side runs
 *    `validate_dto_structured` + `normalize_to_dao`; the mirror's job is the
 *    part a browser can answer before a round trip, and the expectations below
 *    are read off the SAME recorded blocks:
 *      · `expect.valid`   — does the mirror agree the draft is publishable?
 *      · `expect.results` — the same rows, by slug, with the same error codes
 *        (`mandatory_missing` from the rules, `not_in_options` from a narrowed
 *        option list, `above_maximum`/`below_minimum` from a narrowed bound).
 *      · `expect.dao`     — which answers actually reach the wire, which is
 *        `toFeaturesDto` dropping the hidden ones.
 */
// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { FeatureDef, FeaturesDto, FeatureValueDto } from "../src/types.js";
import { featureType } from "../src/types.js";
import { evaluateRules, ruleStateToJson } from "../src/rules.js";
import { mirrorValidate } from "../src/validate.js";
import { toFeaturesDto } from "../src/dto.js";
import corpus from "./fixtures/rules-corpus/index.json" with { type: "json" };

interface StateExpectation {
  readonly visible: boolean;
  readonly required: boolean;
  readonly forbidden_options: readonly string[];
  readonly min: number | null;
  readonly max: number | null;
}

interface RuleCase {
  readonly id: string;
  readonly note: string;
  readonly features: readonly FeatureDef[];
  readonly values: Readonly<Record<string, unknown>>;
  readonly expect: Readonly<Record<string, StateExpectation>>;
}

interface PipelineCase {
  readonly id: string;
  readonly note: string;
  readonly features: readonly FeatureDef[];
  readonly values: Readonly<Record<string, unknown>>;
  readonly expect: {
    readonly valid: boolean;
    readonly dao: readonly string[];
    readonly results: Readonly<Record<string, { status: string; error: string | null }>>;
  };
}

const cases = corpus.cases as readonly RuleCase[];
const pipeline = corpus.pipeline as readonly PipelineCase[];
/** The generated Avito set (`stapel-avito-import --emit-rule-cases`): one case
 * per distinct parsed dependency sentence. Empty until stapel-tools commits
 * it, which is why it is a separate, non-empty-asserted block. */
const avito = (corpus as { avito?: readonly RuleCase[] }).avito ?? [];

/**
 * What the browser SENT — every answer in the case, tagged with its type.
 *
 * Deliberately not `toFeaturesDto`: that function drops hidden answers (it
 * builds the payload a composer saves), and the pipeline cases are about what
 * the ENGINE does with a payload that contains one. So the submission is
 * modelled here and the dropping is asserted separately, below.
 */
function submitted(one: PipelineCase): FeaturesDto {
  const out: Record<string, FeatureValueDto> = {};
  for (const feature of one.features) {
    const type = featureType(feature);
    if (type === undefined || type === "header") continue;
    if (!(feature.slug in one.values)) continue;
    out[feature.slug] = { type, value: one.values[feature.slug] };
  }
  return out;
}

describe("the corpus is the contract", () => {
  it("carries the hand-written cases and the pipeline set", () => {
    // An empty directory would make every parametrized test below vacuously
    // green — the same guard `test_corpus_is_not_empty` puts upstream.
    expect(cases.length).toBeGreaterThanOrEqual(40);
    expect(pipeline.length).toBeGreaterThan(0);
  });

  it("was generated, not hand-edited", () => {
    expect(corpus.$generated).toContain("gen-rules-corpus.mjs");
    expect(corpus.source).toBe("stapel-attributes tests/golden/rules");
  });
});

describe.each(cases.map((one) => [one.id, one] as const))(
  "evaluateRules · %s",
  (_id, one) => {
    it(one.note, () => {
      const state = evaluateRules(one.features, one.values);
      const actual = Object.fromEntries(
        Object.entries(state).map(([slug, value]) => [slug, ruleStateToJson(value)])
      );
      expect(actual).toEqual(one.expect);
    });
  }
);

describe.each(pipeline.map((one) => [one.id, one] as const))(
  "the mirror, end to end · %s",
  (_id, one) => {
    const batch = mirrorValidate(one.features, submitted(one));

    it(`${one.note} — the same verdict`, () => {
      expect(batch.valid).toBe(one.expect.valid);
    });

    it(`${one.note} — the same rows, by slug and error code`, () => {
      const rows = Object.fromEntries(
        batch.results.map((row) => [row.slug, { status: row.status, error: row.error ?? null }])
      );
      expect(rows).toEqual(one.expect.results);
    });

    it(`${one.note} — the same answers reach the wire`, () => {
      expect(Object.keys(toFeaturesDto(one.features, one.values)).sort()).toEqual([
        ...one.expect.dao,
      ]);
    });
  }
);

describe.runIf(avito.length > 0)("the generated Avito set", () => {
  it.each(avito.map((one) => [one.id, one] as const))("%s", (_id, one) => {
    const state = evaluateRules(one.features, one.values);
    const actual = Object.fromEntries(
      Object.entries(state).map(([slug, value]) => [slug, ruleStateToJson(value)])
    );
    expect(actual).toEqual(one.expect);
  });
});
