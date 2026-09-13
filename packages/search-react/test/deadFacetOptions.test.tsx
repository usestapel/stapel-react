/**
 * A FILTER THAT CAN ONLY RETURN NOTHING IS NOT A FILTER (reviewers, 1024/1440).
 *
 * The walk of the live stand found rails offering values with a zero beside
 * them: a colour axis on a text search where six of its values were `0`, and a
 * condition axis on a laptops leaf whose "new" bucket was `0`. Each one is a
 * pressable control whose only outcome is an empty feed — the drill-down facet
 * reporting what swapping to that value would get you, which reads as an offer
 * and behaves as a dead end.
 *
 * The ruling: a facet option counted at zero is HIDDEN in the rail. What this
 * suite pins is the outcome — which options a person can see and press:
 *
 *  - a counted-zero option is not rendered at all, while its live neighbours
 *    in the same group still are;
 *  - an option the person has ALREADY CHOSEN is rendered whatever its count,
 *    because the control that removes a filter cannot be hidden by the filter
 *    itself. This is not hypothetical: `buildFacetGroups` gives a chosen value
 *    the answer never counted `count: 0`;
 *  - `null` is not `0`. "Nobody counted this" is a different sentence from
 *    "there are none", and a deployment that publishes no counts must keep its
 *    whole option list;
 *  - a group left with nothing to offer leaves no heading behind either.
 *
 * Two count-bearing controls are deliberately NOT in scope and are not touched
 * here: the storefront's partition chips and, under its demo flag, its "all
 * makes" band. Both are owner rulings and both live in the container.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  FacetGroupControl,
  FacetPanelPane,
  facetGroupIsEmptyHeading,
} from "../src/default/index.js";
import type { FacetGroup } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

afterEach(cleanup);

/** The stock fixture already carries the defect: one brand bucket is `0`. */
function server(facets?: Readonly<Record<string, Readonly<Record<string, number>>>>) {
  return mockServer({
    "/query": {
      body:
        facets === undefined ? searchResponse() : searchResponse({ facets }),
    },
    "/suggest": { body: { items: [], backend: "postgres" } },
  });
}

async function mountRail(initialSearch = "type=listing"): Promise<void> {
  render(
    <TestHarness server={server()} initialSearch={initialSearch}>
      <FacetPanelPane />
    </TestHarness>
  );
  await waitFor(() => expect(screen.getByTestId("facet-group-brand")).toBeTruthy());
}

/** A group written by hand: the shapes the wire cannot produce on its own. */
function group(overrides: Partial<FacetGroup>): FacetGroup {
  return {
    slug: "color",
    label: "Color",
    labelSource: "server",
    feature: undefined,
    counted: true,
    selected: [],
    options: [],
    ...overrides,
  };
}

function option(
  value: string,
  count: number | null,
  selected = false
): FacetGroup["options"][number] {
  return { value, count, label: value, labelSource: "server", selected };
}

describe("an option nothing can match is not offered", () => {
  it("draws the live brands and not the one counted at zero", async () => {
    await mountRail();
    expect(screen.getByTestId("facet-option-brand-bosch")).toBeTruthy();
    expect(screen.getByTestId("facet-option-brand-makita")).toBeTruthy();
    // `interskol: 0` in the answer. A checkbox for it is a guaranteed empty
    // feed, so there is no checkbox for it.
    expect(screen.queryByTestId("facet-option-brand-interskol")).toBeNull();
  });

  it("keeps the count beside every option it does draw", async () => {
    await mountRail();
    expect(
      screen.getByTestId("facet-count-brand-bosch").textContent
    ).toBe("12");
  });
});

describe("the value the person has chosen never disappears", () => {
  it("keeps a chosen option whose own count came back zero", async () => {
    // The link says `f.brand=interskol` and the answer counts it `0` — the
    // exact shape that would strand a reader inside a filter with no control
    // to clear it.
    await mountRail("type=listing&f.brand=interskol");
    const box = screen.getByTestId<HTMLInputElement>(
      "facet-option-brand-interskol"
    );
    expect(box).toBeTruthy();
    expect(box.checked).toBe(true);
  });

  it("keeps a chosen option the answer never counted at all", () => {
    // Same rule one layer down, where the group is the whole input: every
    // value is dead and one of them is the constraint in force.
    const chosen = group({
      selected: ["black"],
      options: [option("black", 0, true), option("white", 0)],
    });
    expect(facetGroupIsEmptyHeading(chosen)).toBe(false);
    render(
      <TestHarness server={server()}>
        <FacetGroupControl group={chosen} onToggle={() => undefined} />
      </TestHarness>
    );
    expect(screen.getByTestId("facet-option-color-black")).toBeTruthy();
    expect(screen.queryByTestId("facet-option-color-white")).toBeNull();
  });
});

describe("an uncounted axis is not a zero axis", () => {
  it("draws every option of a group nobody counted", () => {
    const uncounted = group({
      counted: false,
      options: [option("black", null), option("white", null)],
    });
    render(
      <TestHarness server={server()}>
        <FacetGroupControl group={uncounted} onToggle={() => undefined} />
      </TestHarness>
    );
    expect(screen.getByTestId("facet-option-color-black")).toBeTruthy();
    expect(screen.getByTestId("facet-option-color-white")).toBeTruthy();
  });
});

describe("a group with nothing left to offer leaves no heading", () => {
  it("renders nothing at all for an all-zero inline group", () => {
    const dead = group({
      options: [option("black", 0), option("white", 0)],
    });
    expect(facetGroupIsEmptyHeading(dead)).toBe(true);
    render(
      <TestHarness server={server()}>
        <FacetGroupControl group={dead} onToggle={() => undefined} />
      </TestHarness>
    );
    expect(screen.queryByTestId("facet-group-color")).toBeNull();
    expect(screen.queryByText("Color")).toBeNull();
  });

  it("keeps a vocabulary axis, whose control is a field over a dictionary", () => {
    // The one exemption, and it predates this rule: the field searches terms
    // the answer never enumerated, so it works with no live buckets at all.
    const dictionary = group({
      slug: "make",
      label: "Make",
      vocabulary: "fleet-autocatalog",
      options: [option("toyota", 0)],
    });
    expect(facetGroupIsEmptyHeading(dictionary)).toBe(false);
    render(
      <TestHarness server={server()}>
        <FacetGroupControl group={dictionary} onToggle={() => undefined} />
      </TestHarness>
    );
    expect(screen.getByTestId("facet-group-make")).toBeTruthy();
  });
});
