/**
 * A heading has one stated order — the ANSWER, the schema, and then a slug
 * that is not allowed to be quiet about itself.
 *
 * Measured on a live classified: at the cars branch the storefront passed an
 * empty feature list, so every group in the rail was a raw index slug. The
 * make group was on the page the whole time; what came back was "I cannot
 * pick a make", because `vendor` is not a word. The server now resolves the
 * group's name from the feature definition and sends it as `label`, which is
 * the only source that is there whether or not a host threaded a schema
 * through.
 *
 * The slug is still what renders when nobody names the group — a heading a
 * person cannot read beats options with no heading — but it renders MARKED:
 * `labelSource: "none"`, one dev warning, and a data attribute a storefront's
 * own test can fail on.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildFacetGroups, parseSearchState } from "../src/index.js";
import type { FacetGroup, FacetLabelsMap } from "../src/index.js";
import type { FeatureDef } from "@stapel/attributes-react";
import { FacetGroupControl } from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

const OPTIONS = { defaultType: "listing" } as const;

function groups(input: {
  facets: Record<string, Record<string, number>>;
  labels?: FacetLabelsMap;
  features?: readonly FeatureDef[];
  search?: string;
}): readonly FacetGroup[] {
  return buildFacetGroups({
    facets: input.facets,
    meta: {
      approximate: false,
      candidates: 30,
      counted: Object.keys(input.facets),
      skipped: [],
      dropped_filters: [],
      core_ranges: [],
      plan: "category",
      withheld: [],
      categories: [],
    },
    state: parseSearchState(
      new URLSearchParams(input.search ?? "type=listing"),
      OPTIONS
    ).state,
    ...(input.labels !== undefined ? { facetLabels: input.labels } : {}),
    ...(input.features !== undefined ? { categoryFeatures: input.features } : {}),
    t: (key: string) => (key === "test.feature.make" ? "Make" : ""),
  });
}

function only(list: readonly FacetGroup[]): FacetGroup {
  const group = list[0];
  if (group === undefined) throw new Error("no group");
  return group;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the group heading comes from the answer first", () => {
  it("uses the server's own label, with no schema in sight", () => {
    const group = only(
      groups({
        facets: { vendor_a: { toyota: 802 } },
        labels: {
          vendor_a: { label: "Марка", translatable: false, values: {} },
        },
      })
    );
    expect(group.label).toBe("Марка");
    expect(group.labelSource).toBe("server");
  });

  it("prefers the answer over the schema — the server read the vocabulary", () => {
    const group = only(
      groups({
        facets: { vendor_b: { toyota: 802 } },
        labels: {
          vendor_b: { label: "Марка", translatable: false, values: {} },
        },
        features: [
          { slug: "vendor_b", name: "test.feature.make", config: { type: "ref_select" } },
        ],
      })
    );
    expect(group.label).toBe("Марка");
  });

  it("falls to the feature definition when the answer names no group", () => {
    const group = only(
      groups({
        facets: { vendor_c: { toyota: 802 } },
        labels: { vendor_c: { label: null, translatable: false, values: {} } },
        features: [
          { slug: "vendor_c", name: "test.feature.make", config: { type: "ref_select" } },
        ],
      })
    );
    // Translated, because a schema name is a KEY.
    expect(group.label).toBe("Make");
    expect(group.labelSource).toBe("schema");
  });
});

describe("a slug reaching a heading is a marked failure, not a fallback", () => {
  it("renders the slug, warns once in dev, and says the source is none", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const first = only(groups({ facets: { vendor_d: { toyota: 802 } } }));
    const second = only(groups({ facets: { vendor_d: { toyota: 802 } } }));

    expect(first.label).toBe("vendor_d");
    expect(first.labelSource).toBe("none");
    expect(second.label).toBe("vendor_d");
    // Once per slug, not once per render: a panel rebuilds its groups on
    // every keystroke in the search box.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("vendor_d");
  });

  it("a def with no name of its own names nothing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const group = only(
      groups({
        facets: { vendor_e: { toyota: 802 } },
        features: [{ slug: "vendor_e", config: { type: "ref_select" } }],
      })
    );
    expect(group.label).toBe("vendor_e");
    expect(group.labelSource).toBe("none");
  });

  it("the drawn group carries the source, so a storefront test can refuse it", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const unnamed = only(groups({ facets: { vendor_f: { toyota: 802 } } }));
    const named = only(
      groups({
        facets: { vendor_g: { toyota: 802 } },
        labels: { vendor_g: { label: "Марка", translatable: false, values: {} } },
      })
    );
    render(
      <TestHarness server={mockServer({ "/query": { body: searchResponse() } })}>
        <FacetGroupControl group={unnamed} onToggle={() => undefined} />
        <FacetGroupControl group={named} onToggle={() => undefined} />
      </TestHarness>
    );
    expect(
      screen.getByTestId("facet-group-vendor_f").getAttribute("data-label-source")
    ).toBe("none");
    expect(
      screen.getByTestId("facet-group-vendor_g").getAttribute("data-label-source")
    ).toBe("server");
  });
});

describe("option captions carry their source too", () => {
  it("marks an option nobody named, which is what the host seam reads", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const group = only(
      groups({
        facets: { vendor_h: { toyota: 802, bmw: 91 } },
        labels: {
          vendor_h: {
            label: "Марка",
            translatable: false,
            values: { toyota: "Toyota" },
          },
        },
      })
    );
    const named = group.options.find((option) => option.value === "toyota");
    const raw = group.options.find((option) => option.value === "bmw");
    expect(named?.labelSource).toBe("server");
    expect(raw?.labelSource).toBe("none");
    expect(raw?.label).toBe("bmw");
  });
});
