/**
 * A facet group is drawn the way its OWN SCHEMA says, and the schema is the
 * one the composer already reads.
 *
 * Three claims, each of which was false before this release — every group was
 * a flat, unbounded column of checkboxes:
 *
 *  1. `maxSelected: 1` is a single-choice facet, and a single-choice facet is
 *     pills with `aria-pressed`, not boxes that say "pick any";
 *  2. `hierarchical_select` carries a TREE, and a child belongs under its
 *     parent rather than beside it in alphabetical order;
 *  3. a twelve-option group is a wall, and folds behind "Show all (12)".
 *
 * The counts stay on every option through all three shapes. A facet without
 * its remaining count is a drill-down facet that has been turned naive, which
 * is the defect this pair's whole facet layer exists to prevent.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { buildFacetGroups, parseSearchState } from "../src/index.js";
import type { FacetGroup } from "../src/index.js";
import {
  FacetGroupControl,
  facetGroupShape,
  facetOptionNodes,
} from "../src/default/index.js";
import { CLASSIFIED_FEATURES, MANY_BRANDS, searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

const OPTIONS = { defaultType: "listing" } as const;

function groupsFor(
  facets: Record<string, Record<string, number>>,
  search = "type=listing"
): readonly FacetGroup[] {
  return buildFacetGroups({
    facets,
    meta: {
      approximate: false,
      candidates: 30,
      counted: Object.keys(facets),
      skipped: [], dropped_filters: [], core_ranges: [],
    },
    state: parseSearchState(new URLSearchParams(search), OPTIONS).state,
    categoryFeatures: CLASSIFIED_FEATURES,
  });
}

function groupFor(
  facets: Record<string, Record<string, number>>,
  slug: string,
  search = "type=listing"
): FacetGroup {
  const group = groupsFor(facets, search).find(
    (candidate) => candidate.slug === slug
  );
  if (group === undefined) throw new Error(`no group ${slug}`);
  return group;
}

function mount(node: ReactElement): void {
  render(
    <TestHarness server={mockServer({ "/query": { body: searchResponse() } })}>
      {node}
    </TestHarness>
  );
}

describe("the shape is derived from the schema, never configured at the call site", () => {
  it("reads `maxSelected: 1` as single-choice", () => {
    expect(facetGroupShape(groupFor({ condition: { new: 7, used: 18 } }, "condition"))).toBe(
      "segmented"
    );
  });

  it("reads a hierarchical_select as nested", () => {
    expect(
      facetGroupShape(groupFor({ body: { cars: 40, sedan: 12 } }, "body"))
    ).toBe("nested");
  });

  it("falls back to checkboxes for an unconstrained facet", () => {
    expect(facetGroupShape(groupFor({ brand: MANY_BRANDS }, "brand"))).toBe(
      "checkbox"
    );
  });

  it("falls back to checkboxes when the host passed NO schema at all", () => {
    const [group] = buildFacetGroups({
      facets: { colour: { red: 2, blue: 9 } },
      meta: { approximate: false, candidates: 11, counted: ["colour"], skipped: [], dropped_filters: [], core_ranges: [] },
      state: parseSearchState(new URLSearchParams("type=listing"), OPTIONS).state,
    });
    expect(group).toBeDefined();
    // An absent `maxSelected` means UNLIMITED — the engine's own default.
    // Reading it as 1 would turn every unlabelled facet into a radio group.
    expect(facetGroupShape(group as FacetGroup)).toBe("checkbox");
  });
});

describe("a single-choice facet is pills, and the pills keep their counts", () => {
  it("renders each option as a pressed/unpressed toggle carrying its count", async () => {
    mount(
      <FacetGroupControl
        group={groupFor(
          { condition: { new: 7, used: 18 } },
          "condition",
          "type=listing&f.condition=used"
        )}
        onToggle={() => undefined}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-group-condition")).toBeTruthy()
    );
    expect(
      screen.getByTestId("facet-group-condition").getAttribute("data-shape")
    ).toBe("segmented");

    const used = screen.getByTestId("facet-option-condition-used");
    const fresh = screen.getByTestId("facet-option-condition-new");
    // `aria-pressed` is what makes a styled button a TOGGLE to a screen reader
    // rather than a link-shaped thing that mysteriously changes the page.
    expect(used.getAttribute("aria-pressed")).toBe("true");
    expect(fresh.getAttribute("aria-pressed")).toBe("false");
    // The remaining count is IN the pill: a sibling without one has had its
    // drill-down count taken away.
    expect(fresh.textContent).toContain("7");
    expect(used.textContent).toContain("18");
  });

  it("toggles through the same callback the checkboxes use", async () => {
    const seen: string[] = [];
    mount(
      <FacetGroupControl
        group={groupFor({ condition: { new: 7, used: 18 } }, "condition")}
        onToggle={(slug, value) => seen.push(`${slug}=${value}`)}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-option-condition-new")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("facet-option-condition-new"));
    expect(seen).toEqual(["condition=new"]);
  });
});

describe("a hierarchical facet keeps its tree", () => {
  const FACETS = { body: { cars: 40, sedan: 12, hatchback: 9, vans: 5 } };

  it("puts each child under its own parent, at the schema's depth", () => {
    const nodes = facetOptionNodes(groupFor(FACETS, "body"));
    expect(nodes.map((node) => [node.option.value, node.depth])).toEqual([
      ["cars", 0],
      ["sedan", 1],
      ["hatchback", 1],
      ["vans", 0],
    ]);
  });

  it("keeps a value the schema does not know, at the root rather than hidden", () => {
    const nodes = facetOptionNodes(
      groupFor({ body: { cars: 40, coupe: 3 } }, "body")
    );
    expect(nodes.map((node) => node.option.value)).toContain("coupe");
    expect(nodes.find((node) => node.option.value === "coupe")?.depth).toBe(0);
  });

  it("indents the children on screen, and marks the depth for a stylesheet", async () => {
    mount(
      <FacetGroupControl group={groupFor(FACETS, "body")} onToggle={() => undefined} />
    );
    await waitFor(() => expect(screen.getByTestId("facet-group-body")).toBeTruthy());
    const group = within(screen.getByTestId("facet-group-body"));
    const child = group
      .getByTestId("facet-option-body-sedan")
      .closest("[data-depth]") as HTMLElement;
    expect(child.getAttribute("data-depth")).toBe("1");
    expect(child.style.paddingInlineStart).not.toBe("");
    const parent = group
      .getByTestId("facet-option-body-cars")
      .closest("[data-depth]") as HTMLElement;
    expect(parent.getAttribute("data-depth")).toBe("0");
    expect(parent.style.paddingInlineStart).toBe("");
  });
});

describe("a long group folds, and says how much is behind the fold", () => {
  it("shows eight of twelve and offers the rest by name", async () => {
    mount(
      <FacetGroupControl
        group={groupFor({ brand: MANY_BRANDS }, "brand")}
        onToggle={() => undefined}
      />
    );
    await waitFor(() => expect(screen.getByTestId("facet-more-brand")).toBeTruthy());
    expect(screen.getByTestId("facet-option-brand-brand-7")).toBeTruthy();
    expect(screen.queryByTestId("facet-option-brand-brand-8")).toBeNull();
    // The count is the WHOLE group, not the hidden tail: "Show all (12)"
    // answers "how many are there", which is what the reader is asking.
    expect(screen.getByTestId("facet-more-brand").textContent).toBe("Show all (12)");

    fireEvent.click(screen.getByTestId("facet-more-brand"));
    await waitFor(() =>
      expect(screen.getByTestId("facet-option-brand-brand-11")).toBeTruthy()
    );
    expect(screen.getByTestId("facet-more-brand").textContent).toBe("Show fewer");
  });

  it("does not fold a group that is one row over the limit", async () => {
    const nine = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [`brand-${String(i)}`, 9 - i])
    );
    mount(
      <FacetGroupControl
        group={groupFor({ brand: nine }, "brand")}
        onToggle={() => undefined}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-option-brand-brand-8")).toBeTruthy()
    );
    // Hiding a single option behind "Show all (9)" costs a tap to reveal
    // exactly one thing.
    expect(screen.queryByTestId("facet-more-brand")).toBeNull();
  });

  it("shows everything when the surface is devoted to one group", async () => {
    mount(
      <FacetGroupControl
        group={groupFor({ brand: MANY_BRANDS }, "brand")}
        onToggle={() => undefined}
        visibleOptions={null}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-option-brand-brand-11")).toBeTruthy()
    );
    expect(screen.queryByTestId("facet-more-brand")).toBeNull();
  });
});

describe("a slug the server skipped still says so, in every shape", () => {
  it("prints 'not counted' rather than a zero", async () => {
    const [group] = buildFacetGroups({
      facets: {},
      meta: {
        approximate: false,
        candidates: 0,
        counted: [],
        skipped: ["condition"], dropped_filters: [], core_ranges: [],
      },
      state: parseSearchState(
        new URLSearchParams("type=listing&f.condition=new"),
        OPTIONS
      ).state,
      categoryFeatures: CLASSIFIED_FEATURES,
    });
    expect(group).toBeDefined();
    mount(
      <FacetGroupControl group={group as FacetGroup} onToggle={() => undefined} />
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-option-condition-new")).toBeTruthy()
    );
    // A single-choice group draws pills, and the pill of an uncounted option
    // carries its label alone — never a fabricated 0.
    expect(screen.getByTestId("facet-option-condition-new").textContent).not.toContain(
      "0"
    );
  });
});
