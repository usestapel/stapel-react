/**
 * ONE AXIS, ONE CONTROL — BUT THE COLUMN THAT KEEPS IT MUST BE ABLE TO DRAW IT.
 *
 * Measured on a live flats leaf (2026-09-14): the total-area axis (`square`) was
 * in the answer's `counted` list with thirty-odd bare integers behind it, and
 * the rail drew it NOWHERE — neither `facet-group-square` nor
 * `facet-range-square` was in the document, and an independent walk of the
 * rail's eighteen sections had no area filter in it.
 *
 * The mechanism is one line. `buildRangeGroups` drops a range whose slug
 * already has a bucket list on the rail, and it was told which those were by
 * the SERVER's `counted` list. But an `int` is not in
 * `FACETABLE_FEATURE_TYPES` — a number is narrowed with two bounds, not a
 * checkbox per value — so `buildFacetGroups` never built a group for it. The
 * rule handed the axis to a column that cannot draw it.
 *
 * Fixed as an ORDERING change, not a heuristic: the pane builds its choice
 * groups and filters them to the drawable set FIRST, then builds the ranges
 * with those slugs as `countedFacets`. Two heuristics inside
 * `buildRangeGroups` were tried before this and both were wrong — nothing in
 * a FEATURE separates `square` from an imported `year`, a raw int whose
 * bucket list IS wanted. Only the rail knows, so the rail is what answers.
 *
 * Both halves are asserted here, because a fix that keeps `square` by giving
 * every counted axis its range back would break `year`, and pass a test that
 * only looked at `square`.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { FeatureDef } from "@stapel/attributes-react";
import { FacetPanelPane } from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { DESKTOP_WIDTH, TestHarness, mockServer, setViewport } from "./harness.js";

afterEach(() => {
  cleanup();
  setViewport(DESKTOP_WIDTH);
});

/**
 * The two shapes the rule has to tell apart, and they are the same TYPE.
 *
 * `square` is a measurement: `int`, absent from `FACETABLE_FEATURE_TYPES`, so
 * no bucket list is ever built for it. `year` is declared a `select` by this
 * category, so it gets one — and its from/to row is the duplicate the rule
 * exists to remove.
 */
const FLAT_FEATURES: readonly FeatureDef[] = [
  {
    slug: "square",
    name: "test.feature.square",
    config: { type: "int", postfix: "m²" },
  },
  {
    slug: "year",
    name: "test.feature.year",
    config: {
      type: "select",
      options: [
        { value: "2019", label: "2019" },
        { value: "2020", label: "2020" },
      ],
    },
  },
];

/** Both axes counted, both measured — exactly what the live answer said. */
const FLAT_FACETS = {
  square: { "26": 1, "32": 1, "40": 2, "49": 3 },
  year: { "2019": 3, "2020": 2 },
} as const;

function flatsServer(): ReturnType<typeof mockServer> {
  return mockServer({
    "/query": {
      body: searchResponse({
        facets: FLAT_FACETS,
        facet_meta: {
          approximate: false,
          candidates: 34,
          counted: ["square", "year"],
          skipped: [],
          dropped_filters: [],
          core_ranges: [],
          plan: "category",
          withheld: [],
          categories: [],
          ranges: {
            square: { min: 26, max: 120 },
            year: { min: 2019, max: 2020 },
          },
        },
      }),
    },
    "/suggest": { body: { items: [], backend: "postgres" } },
  });
}

async function mountFlats(): Promise<void> {
  render(
    <TestHarness server={flatsServer()} initialSearch="type=listing">
      <FacetPanelPane categoryFeatures={FLAT_FEATURES} />
    </TestHarness>
  );
  await waitFor(() => expect(screen.getByTestId("facet-group-year")).toBeTruthy());
}

describe("a counted axis the rail cannot draw keeps its range row", () => {
  it("draws the area filter the live rail lost", async () => {
    await mountFlats();

    // The defect: neither column had it.
    expect(screen.queryByTestId("facet-group-square")).toBeNull();
    expect(screen.queryByTestId("facet-range-square")).not.toBeNull();
  });

  it("still takes the range away from an axis that DID get a bucket list", async () => {
    await mountFlats();

    // `year` is counted AND drawable, so the bucket list is the one control
    // it gets. This is the half a "give every counted axis its range back"
    // fix would break, which is why it is asserted beside the other.
    expect(screen.queryByTestId("facet-group-year")).not.toBeNull();
    expect(screen.queryByTestId("facet-range-year")).toBeNull();
  });
});
