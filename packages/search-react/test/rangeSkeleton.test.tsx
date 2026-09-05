/**
 * D361 (desktop pass 13): a category feed page at 1536px had a 53px layout
 * shift inside the rail, the instant `search-ranges-attributes` (the
 * schema's numeric axes — year, mileage…) arrived with the answer. Nothing
 * reserved its box before that: the block simply did not exist, then did.
 *
 * This suite pins the reservation, not the visual: the box is on screen
 * from the first paint, sized by whatever is already known —
 *  - the schema known, the answer not yet: as many skeleton rows as the
 *    schema declares range axes for, each row's own final height;
 *  - the schema itself not known yet: one row's floor, a guess rather than
 *    nothing.
 * And the swap to the real rows changes nothing about the count, so nothing
 * about the height.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { FacetPanelPane } from "../src/default/index.js";
import { PHONE_FACETS, PHONE_RANGE_FEATURES, searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

afterEach(() => {
  cleanup();
});

function phoneServer(): ReturnType<typeof mockServer> {
  return mockServer({
    "/query": {
      body: searchResponse({
        facets: PHONE_FACETS,
        facet_meta: {
          approximate: false,
          candidates: 43,
          counted: Object.keys(PHONE_FACETS),
          skipped: [],
          dropped_filters: [],
          core_ranges: ["price"],
          plan: "category",
          withheld: [],
          categories: [],
        },
      }),
    },
    "/suggest": { body: { items: [], backend: "postgres" } },
  });
}

/** The schema's own count of numeric-range attributes on the phone leaf —
 * seven: battery health, four parcel dimensions, two wholesale counts. */
const PHONE_RANGE_AXES = 7;

describe("the attribute-range block reserves its box before the answer lands", () => {
  it("draws one skeleton row per schema axis before the query resolves", () => {
    render(
      <TestHarness server={phoneServer()}>
        <FacetPanelPane categoryFeatures={PHONE_RANGE_FEATURES} />
      </TestHarness>
    );
    // No `await` yet — the fetch mock has not resolved, so this is the
    // panel's first paint, exactly the moment D361 measured the jump.
    const box = screen.getByTestId("search-ranges-attributes");
    expect(within(box).getAllByTestId("facet-range-skeleton")).toHaveLength(
      PHONE_RANGE_AXES
    );
    // Reserved, not empty: every skeleton row claims real block-size.
    for (const row of within(box).getAllByTestId("facet-range-skeleton")) {
      expect(row.style.minBlockSize).not.toBe("");
    }
  });

  it("swaps to the same count of real rows once the answer lands — no jump", async () => {
    render(
      <TestHarness server={phoneServer()}>
        <FacetPanelPane categoryFeatures={PHONE_RANGE_FEATURES} />
      </TestHarness>
    );
    expect(
      within(screen.getByTestId("search-ranges-attributes")).getAllByTestId(
        "facet-range-skeleton"
      )
    ).toHaveLength(PHONE_RANGE_AXES);

    await waitFor(() =>
      expect(screen.getByTestId("facet-range-akb")).toBeTruthy()
    );

    // The reservation is a box for rows that have not arrived; once they have,
    // it is gone and the rows themselves stand in the panel's one order.
    expect(screen.queryByTestId("search-ranges-attributes")).toBeNull();
    expect(screen.queryAllByTestId("facet-range-skeleton")).toHaveLength(0);
    // Same axis count, now as real rows — every ATTRIBUTE axis the schema
    // declared, drawn among the groups rather than fenced below them.
    expect(
      screen
        .getByTestId("search-facets")
        .querySelectorAll('[data-core="false"]')
    ).toHaveLength(PHONE_RANGE_AXES);
  });

  it("keeps the whole reservation INSIDE the loading arm — nothing after it travels", () => {
    render(
      <TestHarness server={phoneServer()}>
        <FacetPanelPane categoryFeatures={PHONE_RANGE_FEATURES} />
      </TestHarness>
    );
    // The numeric band and its skeleton used to be SIBLINGS of the loading
    // arm, at positions nothing had decided yet, and travelled to their real
    // places the instant the plan landed: 0.34 CLS on the live host. One box,
    // and the pane draws nothing after it until there is an order to draw in.
    const arm = screen.getByTestId("facets-loading");
    expect(arm.contains(screen.getByTestId("search-ranges-attributes"))).toBe(
      true
    );
    // Nothing between the busy region and the pane's floor.
    const pane = screen.getByTestId("search-facets");
    const after = [...pane.children].slice([...pane.children].indexOf(arm) + 1);
    expect(after.map((node) => node.getAttribute("data-testid"))).toEqual([]);
  });

  it("reserves one row's floor when the schema itself is not known yet", () => {
    render(
      <TestHarness server={phoneServer()}>
        <FacetPanelPane />
      </TestHarness>
    );
    const reserve = screen.getByTestId("search-ranges-attributes-reserve");
    expect(reserve.style.minBlockSize).not.toBe("");
    expect(screen.queryByTestId("search-ranges-attributes")).toBeNull();
  });
});
