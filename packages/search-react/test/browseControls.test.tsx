/**
 * The two blocks a browse page is made of, and which this pair only EXPORTS —
 * where they sit on a category page is the storefront's decision.
 *
 *  - `<PopularValues>`: the busiest values of one facet, as `Toyota 802`, so a
 *    feed page answers "what is in this category" before anybody opens a
 *    filter. Hidden on a phone by a prop, because whether a 390px screen has
 *    room is a fact about the page and not about this component.
 *  - `<PartitionChips>`: the children of a `chips` category as one row where
 *    exactly one thing is true — the parent, or one child.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { buildFacetGroups, parseSearchState } from "../src/index.js";
import type { FacetGroup } from "../src/index.js";
import {
  PartitionChips,
  PopularValues,
  popularOptions,
} from "../src/default/index.js";
import type { PartitionChild } from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

const OPTIONS = { defaultType: "listing" } as const;

const COUNTS: Readonly<Record<string, number>> = {
  toyota: 802,
  bmw: 611,
  honda: 540,
  uncounted: 0,
};

function makeGroup(): FacetGroup {
  const groups = buildFacetGroups({
    facets: { vendor: COUNTS },
    meta: {
      approximate: false,
      candidates: 1953,
      counted: ["vendor"],
      skipped: [],
      dropped_filters: [],
      core_ranges: [],
      plan: "category",
      withheld: [],
      categories: [],
    },
    state: parseSearchState(new URLSearchParams("type=listing"), OPTIONS).state,
    facetLabels: {
      vendor: {
        label: "Марка",
        translatable: false,
        values: { toyota: "Toyota", bmw: "BMW", honda: "Honda" },
      },
    },
  });
  const group = groups.find((candidate) => candidate.slug === "vendor");
  if (group === undefined) throw new Error("no vendor group");
  return group;
}

function mount(node: ReactElement): void {
  render(
    <TestHarness server={mockServer({ "/query": { body: searchResponse() } })}>
      {node}
    </TestHarness>
  );
}

describe("PopularValues", () => {
  it("ranks by count and drops the values with no evidence", () => {
    expect(popularOptions(makeGroup()).map((option) => option.value)).toEqual([
      "toyota",
      "bmw",
      "honda",
    ]);
  });

  it("prints the value and its count, and applies it on click", () => {
    const applied: string[] = [];
    mount(
      <PopularValues
        group={makeGroup()}
        onApply={(slug, value) => applied.push(`${slug}=${value}`)}
      />
    );
    expect(screen.getByTestId("popular-value-vendor-toyota").textContent).toBe("Toyota");
    expect(screen.getByTestId("popular-count-vendor-toyota").textContent).toBe("802");
    fireEvent.click(screen.getByTestId("popular-value-vendor-toyota"));
    expect(applied).toEqual(["vendor=toyota"]);
  });

  it("heads the block with the group's own label", () => {
    mount(<PopularValues group={makeGroup()} onApply={() => undefined} />);
    expect(screen.getByTestId("popular-values-vendor").textContent).toContain("Марка");
  });

  it("draws nothing on a phone — by the prop, not by a media query", () => {
    mount(<PopularValues group={makeGroup()} onApply={() => undefined} hidden />);
    expect(screen.queryByTestId("popular-values-vendor")).toBeNull();
  });

  it("offers the way into the whole control only when there is one", () => {
    const opened: string[] = [];
    mount(
      <PopularValues
        group={makeGroup()}
        onApply={() => undefined}
        onShowAll={() => opened.push("all")}
      />
    );
    fireEvent.click(screen.getByTestId("popular-all-vendor"));
    expect(opened).toEqual(["all"]);
  });

  it("draws no block at all when nothing in the group has evidence", () => {
    const group = { ...makeGroup(), options: [] } as FacetGroup;
    mount(<PopularValues group={group} onApply={() => undefined} />);
    expect(screen.queryByTestId("popular-values-vendor")).toBeNull();
  });
});

const CHILDREN: readonly PartitionChild[] = [
  { id: 152, path: "141/151/152", name: "Новые" },
  { id: 153, path: "141/151/153", name: "С пробегом" },
];

describe("PartitionChips", () => {
  it("leads with the parent and follows the catalogue's order", () => {
    mount(
      <PartitionChips items={CHILDREN} value={null} onChange={() => undefined} />
    );
    const chips = Array.from(
      screen.getByTestId("partition-chips").querySelectorAll('[role="radio"]')
    );
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "All",
      "Новые",
      "С пробегом",
    ]);
  });

  it("is a single choice, announced as one", () => {
    mount(
      <PartitionChips
        items={CHILDREN}
        value="141/151/153"
        onChange={() => undefined}
      />
    );
    const row = screen.getByTestId("partition-chips");
    expect(row.getAttribute("role")).toBe("radiogroup");
    expect(row.getAttribute("aria-label")).toBe("Section");
    expect(
      screen.getByTestId("partition-chip-141/151/153").getAttribute("aria-checked")
    ).toBe("true");
    expect(screen.getByTestId("partition-chip-all").getAttribute("aria-checked")).toBe(
      "false"
    );
  });

  it("is controlled: a click reports the path and changes nothing by itself", () => {
    const chosen: (string | null)[] = [];
    mount(
      <PartitionChips
        items={CHILDREN}
        value={null}
        onChange={(path) => chosen.push(path)}
      />
    );
    fireEvent.click(screen.getByTestId("partition-chip-141/151/152"));
    expect(chosen).toEqual(["141/151/152"]);
    // Still the parent: the row draws what it was given, not what was clicked.
    expect(screen.getByTestId("partition-chip-all").getAttribute("aria-checked")).toBe(
      "true"
    );
  });

  it("goes back to the parent, which is a choice and not a clear", () => {
    const chosen: (string | null)[] = [];
    mount(
      <PartitionChips
        items={CHILDREN}
        value="141/151/152"
        onChange={(path) => chosen.push(path)}
      />
    );
    fireEvent.click(screen.getByTestId("partition-chip-all"));
    expect(chosen).toEqual([null]);
  });

  it("is one Tab stop, and the arrows move the choice along it", () => {
    const chosen: (string | null)[] = [];
    mount(
      <PartitionChips
        items={CHILDREN}
        value={null}
        onChange={(path) => chosen.push(path)}
      />
    );
    const all = screen.getByTestId("partition-chip-all");
    expect(all.getAttribute("tabindex")).toBe("0");
    expect(
      screen.getByTestId("partition-chip-141/151/152").getAttribute("tabindex")
    ).toBe("-1");

    fireEvent.keyDown(all, { key: "ArrowRight" });
    expect(chosen).toEqual(["141/151/152"]);
    fireEvent.keyDown(all, { key: "End" });
    expect(chosen).toEqual(["141/151/152", "141/151/153"]);
  });
});
