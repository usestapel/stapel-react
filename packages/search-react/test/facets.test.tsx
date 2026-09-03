import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  FacetPanel,
  buildFacetGroups,
  facetOptionLabel,
  parseSearchState,
} from "../src/index.js";
import type { FacetPanelBag } from "../src/index.js";
import { FacetPanelPane } from "../src/default/index.js";
import { FEATURES, searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

const OPTIONS = { defaultType: "listing" } as const;

function stateOf(search: string) {
  return parseSearchState(new URLSearchParams(search), OPTIONS).state;
}

describe("drill-down: a facet is counted with its own filter removed", () => {
  it("keeps the SIBLING counts of a slug the person has filtered on", () => {
    // This is the property the spec's e2e leg checks in a browser and the
    // reason a naive facet implementation is detectable: choosing `bosch`
    // must not zero `makita`, because `brand` is counted without `f.brand`.
    const response = searchResponse();
    const groups = buildFacetGroups({
      facets: response.facets,
      meta: response.facet_meta,
      state: stateOf("type=listing&f.brand=bosch"),
      categoryFeatures: FEATURES,
    });
    const brand = groups.find((g) => g.slug === "brand");
    expect(brand?.options.map((o) => [o.value, o.count, o.selected])).toEqual([
      ["bosch", 12, true],
      ["makita", 9, false],
      ["interskol", 0, false],
    ]);
  });

  it("keeps a closed set's declared option order, zeros included", () => {
    // `fill_zero_options` sends closed sets exhaustively; an authored list
    // reshuffled by count is a size chart that moves on every click.
    const groups = buildFacetGroups({
      facets: { brand: { makita: 9, bosch: 12, interskol: 0 } },
      meta: { approximate: false, candidates: 21, counted: ["brand"], skipped: [], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [] },
      state: stateOf("type=listing"),
      categoryFeatures: FEATURES,
    });
    expect(groups[0]?.options.map((o) => o.value)).toEqual([
      "bosch",
      "makita",
      "interskol",
    ]);
  });

  it("orders an unlabelled (open) set by count", () => {
    const groups = buildFacetGroups({
      facets: { colour: { red: 2, blue: 9, green: 5 } },
      meta: { approximate: false, candidates: 16, counted: ["colour"], skipped: [], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [] },
      state: stateOf("type=listing"),
    });
    expect(groups[0]?.options.map((o) => o.value)).toEqual(["blue", "green", "red"]);
  });
});

describe("a skipped slug says 'not counted', never 0", () => {
  it("marks the group uncounted and every option's count null", () => {
    const groups = buildFacetGroups({
      facets: { brand: { bosch: 12 } },
      meta: {
        approximate: false,
        candidates: 12,
        counted: ["brand"],
        skipped: ["power_w"], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [],
      },
      state: stateOf("type=listing&f.power_w=750"),
    });
    const skipped = groups.find((g) => g.slug === "power_w");
    expect(skipped?.counted).toBe(false);
    expect(skipped?.options).toEqual([
      {
        value: "750",
        count: null,
        label: "750",
        labelSource: "none",
        selected: true,
      },
    ]);
  });

  it("still shows a slug the person filtered on that the plan dropped", () => {
    // Otherwise the filter is a constraint with no control to remove it.
    const groups = buildFacetGroups({
      facets: {},
      meta: { approximate: false, candidates: 0, counted: [], skipped: [], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [] },
      state: stateOf("type=listing&f.brand=bosch"),
      categoryFeatures: FEATURES,
    });
    expect(groups.map((g) => g.slug)).toEqual(["brand"]);
    expect(groups[0]?.options[0]?.selected).toBe(true);
  });
});

describe("an uncounted facet is still a FILTER", () => {
  it("draws a skipped slug's options from the category schema", () => {
    // The defect: options came only from the counted buckets, so a slug in
    // `facet_meta.skipped` had NONE — and every surface drops a group with no
    // options. The person read "these filters were not counted" and then could
    // not use them, while `/query` accepts `f.condition` either way. Measured
    // on a live cars leaf: 26 facetable features declared, 12 counted.
    const groups = buildFacetGroups({
      facets: { brand: { bosch: 12 } },
      meta: {
        approximate: false,
        candidates: 12,
        counted: ["brand"],
        skipped: ["condition"], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [],
      },
      state: stateOf("type=listing"),
      categoryFeatures: FEATURES,
    });
    const condition = groups.find((g) => g.slug === "condition");
    expect(condition?.counted).toBe(false);
    // The authored order, and no invented numbers: "nobody counted this" is
    // still said beside every option.
    expect(condition?.options.map((o) => [o.value, o.count])).toEqual([
      ["new", null],
      ["used", null],
    ]);
  });

  it("keeps the applied value first among them, still selected", () => {
    const groups = buildFacetGroups({
      facets: {},
      meta: {
        approximate: false,
        candidates: 3,
        counted: [],
        skipped: ["condition"], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [],
      },
      state: stateOf("type=listing&f.condition=used"),
      categoryFeatures: FEATURES,
    });
    const condition = groups.find((g) => g.slug === "condition");
    expect(condition?.options.map((o) => [o.value, o.selected])).toEqual([
      ["new", false],
      ["used", true],
    ]);
  });

  it("invents nothing for a slug no schema and no answer names", () => {
    // A `ref_select` config is a POINTER into a vocabulary this pair cannot
    // read. An empty group is honest there, and every surface drops it.
    const groups = buildFacetGroups({
      facets: {},
      meta: {
        approximate: false,
        candidates: 4,
        counted: [],
        skipped: ["make_ref"], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [],
      },
      state: stateOf("type=listing"),
      categoryFeatures: [
        {
          slug: "make_ref",
          name: "test.feature.make",
          config: { type: "ref_select", optionsRef: { vocabulary: "cars", level: "Make" } },
        },
      ],
    });
    expect(groups.find((g) => g.slug === "make_ref")?.options).toEqual([]);
  });

  it("falls back to the answer's own captions when the schema has no table", () => {
    const groups = buildFacetGroups({
      facets: {},
      meta: {
        approximate: false,
        candidates: 4,
        counted: [],
        skipped: ["colour"], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [],
      },
      state: stateOf("type=listing"),
      facetLabels: {
        colour: { translatable: false, values: { red: "Red", blue: "Blue" } },
      },
    });
    const colour = groups.find((g) => g.slug === "colour");
    expect(colour?.options.map((o) => [o.value, o.label, o.count])).toEqual([
      ["red", "Red", null],
      ["blue", "Blue", null],
    ]);
  });
});

describe("labels come from the category schema (@stapel/attributes-react)", () => {
  const t = (key: string): string =>
    ({
      "test.feature.brand": "Brand",
      "test.brand.bosch": "Bosch",
      "test.brand.makita": "Makita",
      "test.brand.interskol": "Interskol",
    })[key] ?? key;

  it("resolves the group name and the option captions", () => {
    const groups = buildFacetGroups({
      facets: { brand: { bosch: 12, makita: 9 } },
      meta: { approximate: false, candidates: 21, counted: ["brand"], skipped: [], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [] },
      state: stateOf("type=listing"),
      categoryFeatures: FEATURES,
      t,
    });
    expect(groups[0]?.label).toBe("Brand");
    expect(groups[0]?.options.map((o) => o.label)).toEqual(["Bosch", "Makita"]);
  });

  it("falls back to the raw index term when there is no schema", () => {
    // No labels invented: raw values are the honest answer, blanks are not.
    const groups = buildFacetGroups({
      facets: { brand: { bosch: 12 } },
      meta: { approximate: false, candidates: 12, counted: ["brand"], skipped: [], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [] },
      state: stateOf("type=listing"),
    });
    expect(groups[0]?.label).toBe("brand");
    expect(groups[0]?.options[0]?.label).toBe("bosch");
  });

  it("coerces the wire's string back into the type the formatter expects", () => {
    // Facet values are index TERMS (strings). `select` is a list even for one
    // value, `int` is a number, `bool` is a boolean.
    const asInt = facetOptionLabel(
      { slug: "power_w", config: { type: "int", postfix: "W" } },
      "750"
    );
    expect(asInt).toBe("750 W");
    const asBool = facetOptionLabel(
      { slug: "delivery", config: { type: "bool", trueLabel: "Yes", falseLabel: "No" } },
      "true"
    );
    expect(asBool).toBe("Yes");
  });

  it("gives back the raw value for a type this build cannot format", () => {
    expect(
      facetOptionLabel({ slug: "x", config: { type: "quantum_flux" } }, "7")
    ).toBe("7");
  });
});

describe("the panel renders the server's honesty flags", () => {
  it("shows the approximate notice and names the skipped slugs — behind the opt-in", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({
          facet_meta: {
            approximate: true,
            candidates: 15000,
            counted: ["brand"],
            skipped: ["power_w", "colour"], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [],
          },
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <FacetPanelPane categoryFeatures={FEATURES} skippedNotice />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facets-approximate")).toBeTruthy();
    });
    expect(screen.getByTestId("facets-skipped").textContent).toContain("power_w");
    expect(screen.getByTestId("facets-skipped").textContent).toContain("colour");
  });

  it("says NOTHING about uncounted slugs on a shopper's panel", async () => {
    // The owner met this as a yellow warning listing forty-two internal field
    // names above the filters on a live cars leaf. It is the engine's own note
    // about its facet plan, it is true, and it is not a shopper's sentence —
    // the same class as the synonym-expansion notice this pair removed
    // earlier. `skippedNotice` (default false) is the only way back to it.
    const server = mockServer({
      "/query": {
        body: searchResponse({
          facet_meta: {
            approximate: true,
            candidates: 15000,
            counted: ["brand"],
            skipped: ["power_w", "colour"], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [],
          },
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <FacetPanelPane categoryFeatures={FEATURES} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facets-approximate")).toBeTruthy();
    });
    expect(screen.queryByTestId("facets-skipped")).toBeNull();
  });

  it("renders nothing at all on a healthy answer — no flags, no notes", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({
          facets: { brand: { bosch: 12 } },
          facet_meta: {
            approximate: false,
            candidates: 12,
            counted: ["brand"],
            skipped: [], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [],
          },
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <FacetPanelPane categoryFeatures={FEATURES} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facet-group-brand")).toBeTruthy();
    });
    expect(screen.queryByTestId("facets-approximate")).toBeNull();
    expect(screen.queryByTestId("facets-skipped")).toBeNull();
    expect(document.querySelectorAll(".ant-alert").length).toBe(0);
  });

  it("prints 'not counted' where a skipped slug's number would go", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({
          facets: { brand: { bosch: 12 } },
          facet_meta: {
            approximate: false,
            candidates: 12,
            counted: ["brand"],
            skipped: ["power_w"], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [],
          },
        }),
      },
    });
    render(
      <TestHarness server={server} initialSearch="type=listing&f.power_w=750">
        <FacetPanelPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facet-count-power_w-750")).toBeTruthy();
    });
    // The whole point: NOT "0".
    expect(screen.getByTestId("facet-count-power_w-750").textContent).toBe(
      "not counted"
    );
  });

  it("distinguishes a failed facet load from a search with no facets", async () => {
    const failing = mockServer({ "/query": { status: 503, body: {} } });
    const { unmount } = render(
      <TestHarness server={failing}>
        <FacetPanelPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facets-failed")).toBeTruthy();
    });
    expect(screen.queryByTestId("facets-empty")).toBeNull();
    unmount();

    const noFacets = mockServer({
      "/query": {
        body: searchResponse({
          facets: {},
          facet_meta: { approximate: false, candidates: 0, counted: [], skipped: [], dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [] },
        }),
      },
    });
    render(
      <TestHarness server={noFacets}>
        <FacetPanelPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facets-empty")).toBeTruthy();
    });
    expect(screen.queryByTestId("facets-failed")).toBeNull();
  });
});

/**
 * D175 — "this search offers no filters" over 46 phones that all carry a
 * manufacturer. The backend half is `facet_meta.plan: "evidence"`; this is
 * the half that decides whether the sentence is still allowed to be printed.
 * `search.facets.empty` is a CLAIM about the answer, and there are two ways
 * for it to be false while the group list is empty: the server counted
 * groups and held them back (`withheld`), or it could not work a plan out at
 * all (`degraded: ["facet_plan_evidence"]`).
 */
describe("«no filters» is a claim, and the answer can contradict it", () => {
  const META_BASE = {
    approximate: false,
    candidates: 46,
    counted: [],
    skipped: [],
    dropped_filters: [],
    core_ranges: [],
    plan: "evidence",
    withheld: [],
    categories: [],
  };

  it("says how many filters were left out, never «no filters»", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({
          facets: {},
          facet_meta: {
            ...META_BASE,
            withheld: [
              { slug: "manufacturer", coverage: 4, candidates: 46 },
              { slug: "model", coverage: 2, candidates: 46 },
            ],
            categories: [{ category: "32/149/163", count: 46 }],
          },
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <FacetPanelPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facets-withheld")).toBeTruthy();
    });
    // The count is the whole point: two filters exist and describe too little
    // of this result set. Saying "none" is the lie D175 was.
    expect(screen.getByTestId("facets-withheld").textContent).toContain("2");
    expect(screen.queryByTestId("facets-empty")).toBeNull();
  });

  it("still says «no filters» when the answer really offers none", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({ facets: {}, facet_meta: { ...META_BASE, candidates: 0 } }),
      },
    });
    render(
      <TestHarness server={server}>
        <FacetPanelPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facets-empty")).toBeTruthy();
    });
    expect(screen.queryByTestId("facets-withheld")).toBeNull();
  });

  it("claims nothing when the server could not work the plan out", async () => {
    // `facet_plan_evidence` means the engine has no `category_counts` verb,
    // so there IS no evidence plan. "This search offers no filters" is then
    // a statement the answer does not support — the degradation notice is
    // what tells the reader, and the panel's job is to not contradict it.
    const server = mockServer({
      "/query": {
        body: searchResponse({
          facets: {},
          facet_meta: { ...META_BASE, candidates: 0 },
          degraded: ["facet_plan_evidence"],
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <FacetPanelPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(
        document.querySelector('[data-stapel-load-state="empty"]')
      ).toBeTruthy();
    });
    expect(screen.getByTestId("search-facets")).toBeTruthy();
    expect(screen.queryByTestId("facets-empty")).toBeNull();
    expect(screen.queryByTestId("facets-withheld")).toBeNull();
  });

  it("projects facet_meta.categories onto the bag, busiest first", async () => {
    // What a host needs to build the counted category filter that a text
    // search has no other way to offer: the `category` string is the same
    // slash-joined id path the filter and the URL state already take.
    const categories = [
      { category: "32/149/163", count: 46 },
      { category: "32/149/164", count: 3 },
    ];
    const server = mockServer({
      "/query": {
        body: searchResponse({
          facets: {},
          facet_meta: {
            ...META_BASE,
            categories,
            withheld: [{ slug: "manufacturer", coverage: 4, candidates: 46 }],
          },
        }),
      },
    });
    let seen: FacetPanelBag | undefined;
    render(
      <TestHarness server={server}>
        <FacetPanel>
          {(bag) => {
            seen = bag;
            return <div data-testid="bag">{bag.plan}</div>;
          }}
        </FacetPanel>
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("bag").textContent).toBe("evidence");
    });
    expect(seen?.categories).toEqual(categories);
    expect(seen?.withheld).toEqual([
      { slug: "manufacturer", coverage: 4, candidates: 46 },
    ]);
  });
});
