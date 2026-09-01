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
 * Three sets, three claims:
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
 *  - `imported` — the GENERATED set: 3890 distinct rules lifted out of a real
 *    imported catalogue by the catalogue importer, each recorded
 *    at BOTH polarities (a values assignment that fires the rule and one that
 *    does not), with the feature set stored once per pair. A rule is a
 *    TRANSITION, and one frame cannot photograph one — so the pair is the unit
 *    of evidence here, and the shape gate below insists the two frames
 *    actually differ on the feature the rule hangs off. This is where the
 *    hand-written 59 stop being a sample of a grammar and start being a sample
 *    of a grammar somebody's production catalogue really uses.
 */
// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { FeatureDef, FeaturesDto, FeatureValueDto } from "../src/types.js";
import { featureType } from "../src/types.js";
import { evaluateRules, ruleStateToJson } from "../src/rules.js";
import { mirrorValidate } from "../src/validate.js";
import { toFeaturesDto } from "../src/dto.js";
import corpus from "./fixtures/rules-corpus/index.json" with { type: "json" };

// The imported files are megabytes of single-line JSON and are read at run time
// rather than imported: a static import would make vite transform (and hold in
// memory) a 10 MB module for every worker that touches this file.
const CORPUS_DIR = fileURLToPath(new URL("./fixtures/rules-corpus/", import.meta.url));

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
/**
 * One recorded rule, at both polarities. `features` is shared by the two
 * frames — that is the whole compaction — and each frame carries the values
 * that produce it plus the `expect` Python's evaluator wrote for them.
 */
interface ImportedPolarity {
  readonly values: Readonly<Record<string, unknown>>;
  readonly expect: Readonly<Record<string, StateExpectation>>;
}
interface ImportedCase {
  readonly id: string;
  readonly note: string;
  readonly features: readonly FeatureDef[];
  readonly polarities: {
    readonly match: ImportedPolarity;
    readonly nomatch: ImportedPolarity;
  };
}

/** The generated imported set, one entry per DISTINCT rule.
 *
 * `corpus.imported` is a list of FILE NAMES (the driver copies the files verbatim
 * rather than inlining 12 MB into index.json), so the names come from the
 * generated manifest and the contents from disk. */
const importedFiles = (corpus as { imported?: readonly string[] }).imported ?? [];
const importedSets: readonly (readonly [string, readonly ImportedCase[]])[] = importedFiles.map(
  (name) =>
    [name, JSON.parse(readFileSync(`${CORPUS_DIR}imported/${name}`, "utf8")) as readonly ImportedCase[]] as const
);

/** Which slug each entry's rules hang off — the feature the two polarities
 * must disagree about. */
function ruleBearing(one: ImportedCase): readonly string[] {
  return one.features.filter((f) => (f.rules ?? []).length > 0).map((f) => f.slug);
}

/** Every effect named anywhere in an entry's rules. */
function effectsOf(one: ImportedCase): readonly string[] {
  return one.features.flatMap((f) => (f.rules ?? []).map((rule) => rule.effect));
}

const EVERY_EFFECT = ["forbid_option", "hide", "limit", "require", "show"] as const;

/**
 * JSON with its object keys sorted, recursively.
 *
 * The two sides agree on the VALUES and not on the key order — Python's
 * recorder writes `sort_keys=True`, `evaluateRules` returns features in the
 * order they were declared — and `JSON.stringify` is order-sensitive. Sorting
 * both sides is what makes a string comparison mean "same state" rather than
 * "same spelling"; comparing 7780 frames with `toEqual` instead would be
 * correct too, and about forty times slower.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, one]) => `${JSON.stringify(key)}:${canonical(one)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

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

/**
 * The generated imported set.
 *
 * Deliberately NOT `it.each` over 3890 entries: vitest's per-test overhead
 * would turn a two-second comparison into minutes, and a run nobody waits for
 * is a gate nobody keeps. Each file is one test that walks every entry and
 * every polarity, collects the DIVERGENCES, and asserts the list is empty — so
 * a failure still names the exact case, feature and frame, and a green run
 * costs what the arithmetic costs.
 */
describe.runIf(importedSets.length > 0)("the generated imported set", () => {
  it("is the corpus the pin promises", () => {
    expect(importedFiles).toEqual(["prose.json", "values-by-group.json"]);
    for (const [name, entries] of importedSets) {
      expect(entries.length, name).toBeGreaterThan(0);
    }
  });

  it("carries both polarities of every one of the five effects", () => {
    // A corpus that lost an effect would still be green everywhere else — the
    // remaining cases would simply never exercise it. So the SHAPE is asserted
    // before the semantics.
    const seen = new Set<string>();
    for (const [, entries] of importedSets) {
      for (const one of entries) for (const effect of effectsOf(one)) seen.add(effect);
    }
    expect([...seen].sort()).toEqual([...EVERY_EFFECT]);
  });

  it("records two frames that actually differ, for every entry", () => {
    // The pair is the unit of evidence: if `match` and `nomatch` produced the
    // same state, the entry proves nothing about the rule it was emitted for.
    const same: string[] = [];
    for (const [name, entries] of importedSets) {
      for (const one of entries) {
        const bearing = ruleBearing(one);
        const differs = bearing.some(
          (slug) =>
            canonical(one.polarities.match.expect[slug]) !==
            canonical(one.polarities.nomatch.expect[slug])
        );
        if (bearing.length === 0 || !differs) same.push(`${name}:${one.id}`);
      }
    }
    expect(same).toEqual([]);
  });

  for (const [name, entries] of importedSets) {
    it(`${name} — every entry, both polarities, exactly as Python recorded them`, () => {
      const wrong: string[] = [];
      let checked = 0;
      for (const one of entries) {
        for (const polarity of ["match", "nomatch"] as const) {
          const frame = one.polarities[polarity];
          const state = evaluateRules(one.features, frame.values);
          const actual = Object.fromEntries(
            Object.entries(state).map(([slug, value]) => [slug, ruleStateToJson(value)])
          );
          checked += Object.keys(frame.expect).length;
          const got = canonical(actual);
          const want = canonical(frame.expect);
          if (got !== want) wrong.push(`${one.id}/${polarity}: ${got} != ${want}`);
        }
      }
      // Reported, not asserted: the count is what makes "the corpus ran" a
      // number in the log rather than a claim in a commit message.
      console.error(
        `rules corpus [imported/${name}]: ${entries.length} rules, ` +
          `${entries.length * 2} frames, ${checked} feature expectations`
      );
      expect(wrong.slice(0, 5)).toEqual([]);
      expect(wrong).toHaveLength(0);
    });
  }
});
