/**
 * A GROUP FED BY SEVERAL DICTIONARIES IS STILL A DICTIONARY.
 *
 * `facet_labels[slug].vocabulary` names the one dictionary a group's codes
 * come from, and the server sets it to null in two different situations: an
 * inline `select` (no vocabulary at all), and — the case this file is about —
 * a group fed by SEVERAL, where there is genuinely no single address. The
 * measured shape is a parent over children whose same-named axis comes out of
 * different catalogues: a pets root over a cat-breed level and a dog-breed
 * level.
 *
 * Why it mattered: `facetGroupIsVocabularyBacked` asks the SCHEMA first and
 * falls back to the answer when there is none — and a parent page has no
 * schema by construction. So the union case made the singular field null, the
 * fallback concluded "not a dictionary", and the panel drew a checkbox per
 * breed where the searchable sheet belongs, on exactly the pages whose lists
 * are longest.
 */
import { describe, expect, it } from "vitest";
import { buildFacetGroups, facetGroupIsVocabularyBacked } from "../src/index.js";
import type { SearchQueryState } from "../src/index.js";

const STATE: SearchQueryState = {
  type: "listing", q: "", filters: {}, ranges: {},
} as SearchQueryState;

const META = {
  approximate: false, candidates: 40, counted: ["breed"], skipped: [],
  dropped_filters: [], core_ranges: [], plan: "evidence" as const,
  withheld: [], categories: [],
};

describe("a union-fed group", () => {
  it("is vocabulary-backed even though no single vocabulary is named", () => {
    const [group] = buildFacetGroups({
      facets: { breed: { british: 4, husky: 3 } },
      meta: META,
      facetLabels: {
        breed: {
          translatable: true,
          values: { british: "British", husky: "Husky" },
          // Both null: there is no single address, which is the server
          // saying "several", not "none".
          vocabulary: null,
          level: null,
          vocabularies: [
            { vocabulary: "cats-212", level: "Breed" },
            { vocabulary: "dogs-215", level: "Breed" },
          ],
        },
      },
      state: STATE,
    });
    if (group === undefined) throw new Error("no group was built");
    // The panel's only question, and the answer does not depend on how many.
    expect(facetGroupIsVocabularyBacked(group)).toBe(true);
  });

  it("carries the contributors rather than collapsing to the first", () => {
    /* "No single address" is a true and useful fact. A client that fetched
       from a first-of-many address would be reading ONE catalogue for a group
       drawn from several — so the plural is carried whole and `vocabulary`
       stays undefined, exactly as the wire has it. */
    const [group] = buildFacetGroups({
      facets: { breed: { british: 4 } },
      meta: META,
      facetLabels: {
        breed: {
          translatable: true, values: { british: "British" },
          vocabulary: null, level: null,
          vocabularies: [
            { vocabulary: "cats-212", level: "Breed" },
            { vocabulary: "dogs-215", level: "Breed" },
          ],
        },
      },
      state: STATE,
    });
    expect(group?.vocabulary).toBeUndefined();
    expect(group?.vocabularies?.map((v) => v.vocabulary)).toEqual([
      "cats-212",
      "dogs-215",
    ]);
  });

  it("still says NO for an inline select, which is the other null", () => {
    // The whole point of the field: two different facts used to share one
    // null, and only one of them means "not a dictionary".
    const [group] = buildFacetGroups({
      facets: { condition: { new: 9 } },
      meta: { ...META, counted: ["condition"] },
      facetLabels: {
        condition: { translatable: true, values: { new: "New" }, vocabulary: null, level: null },
      },
      state: STATE,
    });
    if (group === undefined) throw new Error("no group was built");
    expect(facetGroupIsVocabularyBacked(group)).toBe(false);
  });
});
