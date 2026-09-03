/**
 * A vocabulary level is a DICTIONARY, and a dictionary is not a checkbox list
 * with a "Show all (418)" under it.
 *
 * Measured on a live classified's cars leaf: the autocatalog carries 418
 * makes, the group rendered as eight boxes plus a link that printed the other
 * 410, and the storefront passed no feature list at all — so the group was
 * also unnamed. This suite is the control that answers "I want a Toyota" in
 * one gesture: the busiest values, a box that filters them locally and across
 * alphabets, and the chosen values never leaving the screen.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { buildFacetGroups, parseSearchState } from "../src/index.js";
import type { FacetGroup } from "../src/index.js";
import type { FeatureDef } from "@stapel/attributes-react";
import {
  FacetGroupControl,
  facetGroupShape,
  isDictionaryFacet,
} from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

const OPTIONS = { defaultType: "listing" } as const;

/** A vocabulary level as the counter returns one: captions from the answer,
 * counts from the corpus. */
const MAKES: Readonly<Record<string, number>> = {
  toyota: 802,
  bmw: 611,
  honda: 540,
  kia: 480,
  mazda: 430,
  nissan: 390,
  audi: 350,
  ford: 300,
  timberland: 120,
  "land-rover": 90,
  mercedes: 60,
  skoda: 40,
};

const CAPTIONS: Readonly<Record<string, string>> = {
  toyota: "Toyota",
  bmw: "BMW",
  honda: "Honda",
  kia: "Kia",
  mazda: "Mazda",
  nissan: "Nissan",
  audi: "Audi",
  ford: "Ford",
  timberland: "Timberland",
  "land-rover": "Land Rover",
  mercedes: "Mercedes-Benz",
  skoda: "Škoda",
};

const VENDOR: FeatureDef = {
  slug: "vendor",
  name: "test.feature.vendor",
  config: { type: "ref_select", optionsRef: { level: "Vendor", vocabulary: "cars" } },
};

function vendorGroup(options: {
  search?: string;
  features?: readonly FeatureDef[];
  counts?: Readonly<Record<string, number>>;
} = {}): FacetGroup {
  const counts = options.counts ?? MAKES;
  const groups = buildFacetGroups({
    facets: { vendor: counts },
    meta: {
      approximate: false,
      candidates: 4213,
      counted: ["vendor"],
      skipped: [],
      dropped_filters: [],
      core_ranges: [],
      plan: "category",
      withheld: [],
      categories: [],
    },
    state: parseSearchState(
      new URLSearchParams(options.search ?? "type=listing"),
      OPTIONS
    ).state,
    facetLabels: { vendor: { label: "Марка", translatable: false, values: CAPTIONS } },
    ...(options.features !== undefined ? { categoryFeatures: options.features } : {}),
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

function shownValues(): readonly string[] {
  return screen
    .queryAllByTestId(/^facet-option-vendor-/)
    .map((node) => node.getAttribute("data-testid") ?? "")
    .map((id) => id.replace("facet-option-vendor-", ""));
}

describe("which groups are dictionaries", () => {
  it("a ref_select past the fold is one", () => {
    const group = vendorGroup({ features: [VENDOR] });
    expect(isDictionaryFacet(group)).toBe(true);
    expect(facetGroupShape(group)).toBe("dictionary");
  });

  it("a ref_select a person could read whole is not", () => {
    const group = vendorGroup({
      features: [VENDOR],
      counts: { toyota: 802, bmw: 611, honda: 540 },
    });
    expect(isDictionaryFacet(group)).toBe(false);
    expect(facetGroupShape(group)).toBe("checkbox");
  });

  it("a long group with NO schema is one — that is the live case", () => {
    // The storefront passed an empty feature list, so the 418 makes arrived
    // untyped. Refusing the box because the schema is missing punishes the
    // buyer for the wiring.
    expect(facetGroupShape(vendorGroup())).toBe("dictionary");
  });
});

describe("the dictionary draws its busiest values and searches the rest", () => {
  it("shows the top eight by count, not the first eight of the answer", () => {
    mount(
      <FacetGroupControl group={vendorGroup({ features: [VENDOR] })} onToggle={() => undefined} />
    );
    expect(shownValues()).toEqual([
      "toyota",
      "bmw",
      "honda",
      "kia",
      "mazda",
      "nissan",
      "audi",
      "ford",
    ]);
    expect(screen.queryByTestId("facet-option-vendor-skoda")).toBeNull();
  });

  it("keeps the drill-down count on every row", () => {
    mount(
      <FacetGroupControl group={vendorGroup({ features: [VENDOR] })} onToggle={() => undefined} />
    );
    expect(screen.getByTestId("facet-count-vendor-toyota").textContent).toBe("802");
  });

  it("filters locally on a Cyrillic query against a Latin catalogue", () => {
    mount(
      <FacetGroupControl group={vendorGroup({ features: [VENDOR] })} onToggle={() => undefined} />
    );
    fireEvent.change(screen.getByTestId("facet-dictionary-search-vendor"), {
      target: { value: "тимберленд" },
    });
    expect(shownValues()).toEqual(["timberland"]);
  });

  it("reaches past the fold — a value the top eight never showed", () => {
    mount(
      <FacetGroupControl group={vendorGroup({ features: [VENDOR] })} onToggle={() => undefined} />
    );
    fireEvent.change(screen.getByTestId("facet-dictionary-search-vendor"), {
      target: { value: "ровер" },
    });
    expect(shownValues()).toEqual(["land-rover"]);
  });

  it("says so when nothing matches, instead of an empty group", () => {
    mount(
      <FacetGroupControl group={vendorGroup({ features: [VENDOR] })} onToggle={() => undefined} />
    );
    fireEvent.change(screen.getByTestId("facet-dictionary-search-vendor"), {
      target: { value: "zzz" },
    });
    expect(shownValues()).toEqual([]);
    expect(screen.getByTestId("facet-dictionary-empty-vendor")).toBeTruthy();
  });

  it("opens the whole list without typing anything", () => {
    mount(
      <FacetGroupControl group={vendorGroup({ features: [VENDOR] })} onToggle={() => undefined} />
    );
    fireEvent.click(screen.getByTestId("facet-more-vendor"));
    expect(shownValues()).toHaveLength(12);
  });
});

describe("a chosen value never leaves the screen", () => {
  it("stands above the list, and out of what the box filters", () => {
    mount(
      <FacetGroupControl
        group={vendorGroup({ features: [VENDOR], search: "type=listing&f.vendor=skoda" })}
        onToggle={() => undefined}
      />
    );
    const chosen = screen.getByTestId("facet-dictionary-chosen-vendor");
    expect(chosen.querySelector('[data-testid="facet-option-vendor-skoda"]')).not.toBeNull();

    fireEvent.change(screen.getByTestId("facet-dictionary-search-vendor"), {
      target: { value: "тойота" },
    });
    // Still there with the query narrowed to somebody else: a filter a person
    // cannot see is a filter they cannot remove.
    expect(screen.getByTestId("facet-option-vendor-skoda")).toBeTruthy();
    expect(screen.getByTestId("facet-option-vendor-toyota")).toBeTruthy();
  });

  it("applies a value by its own checkbox", () => {
    const applied: string[] = [];
    mount(
      <FacetGroupControl
        group={vendorGroup({ features: [VENDOR] })}
        onToggle={(slug, value) => applied.push(`${slug}=${value}`)}
      />
    );
    fireEvent.click(screen.getByTestId("facet-option-vendor-toyota"));
    expect(applied).toEqual(["vendor=toyota"]);
  });
});
