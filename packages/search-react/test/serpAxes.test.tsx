/**
 * Three things a buyer's SERP owes them, measured on a live classified board
 * (a live classified deployment, 2026-08-31) and missing from all of them.
 *
 *  1. **A price filter.** The panel offered seven numeric ranges — parcel
 *     weight, length, height, width, packing quantity… — and no price,
 *     because a range row was only ever drawn for a CATEGORY FEATURE and
 *     price is a column of the listing. stapel-search 0.4.0 announces the
 *     core axes per answer (`facet_meta.core_ranges`), so the row comes from
 *     the server rather than from a list this package would have to keep.
 *  2. **Captions, not storage slugs.** "Condition: b-u" because the labels
 *     lived in a category schema the host had not threaded through. The
 *     answer now carries them (`facet_labels`), and the response wins over
 *     the optional schema precisely because the response is always there.
 *  3. **No engine diagnostics.** Every query, for every buyer, raised a
 *     yellow "What this search could not do: synonyms were not substituted —
 *     the search engine in use cannot do this", a full screen tall,
 *     between the sort control and the first card. That sentence is a
 *     statement about the deployment, not about the answer, and it belongs
 *     to whoever chose the engine.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { FeatureDef } from "@stapel/attributes-react";
import {
  buildFacetGroups,
  buildRangeGroups,
  degradationAudience,
  parseDegradations,
  parseSearchState,
  readerFacing,
} from "../src/index.js";
import type { SearchQueryState } from "../src/index.js";
import { DegradationNotice, FacetPanelPane } from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

const OPTIONS = { defaultType: "listing" } as const;

function stateOf(search: string): SearchQueryState {
  return parseSearchState(new URLSearchParams(search), OPTIONS).state;
}

/** The live category: parcel dimensions are features, price is not. */
const PHONE_FEATURES: readonly FeatureDef[] = [
  {
    slug: "weight_for_delivery",
    name: "test.feature.weight",
    config: { type: "int", min: 0 },
  },
  {
    slug: "condition",
    name: "test.feature.condition",
    config: {
      type: "select",
      translatable_options: false,
      options: [
        { value: "novoe", label: "Новое" },
        { value: "b-u", label: "Б/у" },
      ],
    },
  },
];

// --------------------------------------------------------------------------
// 1. the price row
// --------------------------------------------------------------------------

describe("a core range is an axis the answer declares", () => {
  it("draws a row for every slug in facet_meta.core_ranges", () => {
    const groups = buildRangeGroups({
      state: stateOf("type=listing"),
      categoryFeatures: PHONE_FEATURES,
      coreRanges: ["price"],
    });
    expect(groups.map((g) => g.slug)).toEqual(["price", "weight_for_delivery"]);
  });

  it("puts the core axes FIRST — a phone buyer narrows by price, not by parcel width", () => {
    const [first] = buildRangeGroups({
      state: stateOf("type=listing"),
      categoryFeatures: PHONE_FEATURES,
      coreRanges: ["price"],
    });
    expect(first?.slug).toBe("price");
    expect(first?.core).toBe(true);
  });

  it("draws nothing extra when the server declares no core axis", () => {
    // A server predating 0.4.0 sends no `core_ranges`. The panel must not
    // invent a price row over an engine that would answer 0 for it — the
    // silent empty board is the defect, not the missing control.
    const groups = buildRangeGroups({
      state: stateOf("type=listing"),
      categoryFeatures: PHONE_FEATURES,
    });
    expect(groups.map((g) => g.slug)).toEqual(["weight_for_delivery"]);
  });

  it("carries the corpus currency so the control reads as money", () => {
    const [price] = buildRangeGroups({
      state: stateOf("type=listing"),
      coreRanges: ["price"],
      currency: "RUB",
    });
    expect(price?.currency).toBe("RUB");
    expect(price?.unit).toBeUndefined();
  });

  it("never draws a core axis twice when the category also declares the slug", () => {
    const groups = buildRangeGroups({
      state: stateOf("type=listing"),
      categoryFeatures: [
        { slug: "price", name: "test.feature.price", config: { type: "int" } },
      ],
      coreRanges: ["price"],
    });
    expect(groups.map((g) => g.slug)).toEqual(["price"]);
    expect(groups[0]?.core).toBe(true);
  });

  it("round-trips an applied core range like any other", () => {
    const [price] = buildRangeGroups({
      state: stateOf("type=listing&r.price=10000..30000"),
      coreRanges: ["price"],
    });
    expect([price?.from, price?.to, price?.active]).toEqual([
      "10000",
      "30000",
      true,
    ]);
  });
});

describe("the panel renders the price control", () => {
  it("offers a price range on a SERP whose category has none", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <FacetPanelPane categoryFeatures={PHONE_FEATURES} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facet-range-price")).toBeTruthy();
    });
    // Above every attribute row, and named as money rather than as a bare
    // integer: the corpus currency is read off the cards the same answer
    // returned, so no host had to wire it.
    const rows = screen.getByTestId("search-ranges").querySelectorAll("[data-testid^='facet-range-']");
    expect(rows[0]?.getAttribute("data-testid")).toBe("facet-range-price");
    expect(
      screen.getByTestId("facet-range-price-label").textContent
    ).toContain("\u20bd");
  });

  it("marks the core row so a skin can tell it from an attribute", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <FacetPanelPane categoryFeatures={PHONE_FEATURES} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facet-range-price")).toBeTruthy();
    });
    expect(screen.getByTestId("facet-range-price").getAttribute("data-core")).toBe("true");
    expect(
      screen.getByTestId("facet-range-weight_for_delivery").getAttribute("data-core")
    ).toBe("false");
  });
});

// --------------------------------------------------------------------------
// 2. captions
// --------------------------------------------------------------------------

describe("a facet bucket reads as words", () => {
  it("labels options from the ANSWER, with no category schema threaded through", () => {
    const response = searchResponse();
    const groups = buildFacetGroups({
      facets: response.facets,
      meta: response.facet_meta,
      facetLabels: response.facet_labels,
      state: stateOf("type=listing"),
    });
    const condition = groups.find((g) => g.slug === "condition");
    expect(condition?.options.map((o) => o.label)).toEqual(["Новое", "Б/у"]);
  });

  it("still invents nothing for a slug the answer does not caption", () => {
    const response = searchResponse();
    const groups = buildFacetGroups({
      facets: response.facets,
      meta: response.facet_meta,
      facetLabels: response.facet_labels,
      state: stateOf("type=listing"),
    });
    const brand = groups.find((g) => g.slug === "brand");
    expect(brand?.options.map((o) => o.label)).toEqual([
      "bosch",
      "makita",
      "interskol",
    ]);
  });

  it("runs a caption through the catalogue when the server says it is a key", () => {
    const groups = buildFacetGroups({
      facets: { brand: { apple: 3 } },
      meta: {
        approximate: false,
        candidates: 3,
        counted: ["brand"],
        skipped: [],
        dropped_filters: [], core_ranges: [], plan: "category", withheld: [], categories: [],
      },
      facetLabels: {
        brand: { translatable: true, values: { apple: "b.apple" } },
      },
      state: stateOf("type=listing"),
      t: (key: string) => (key === "b.apple" ? "Apple" : key),
    });
    expect(groups[0]?.options[0]?.label).toBe("Apple");
  });
});

// --------------------------------------------------------------------------
// 3. the notice
// --------------------------------------------------------------------------

describe("a degradation is addressed to somebody", () => {
  it("classifies an engine-capability shortfall as the operator's business", () => {
    expect(degradationAudience("phrase_synonyms")).toBe("operator");
    expect(degradationAudience("typo_tolerance")).toBe("operator");
    expect(degradationAudience("exact_total")).toBe("operator");
  });

  it("classifies a shortfall that changes what the page MEANS as the reader's", () => {
    expect(degradationAudience("category_rollup")).toBe("reader");
    expect(degradationAudience("exact_facet_counts")).toBe("reader");
    expect(degradationAudience("unknown")).toBe("reader");
    expect(degradationAudience("scorer")).toBe("reader");
  });

  it("filters a list down to what a buyer can act on", () => {
    const parsed = parseDegradations([
      "phrase_synonyms",
      "typo_tolerance",
      "category_rollup",
    ]);
    expect(readerFacing(parsed).map((d) => d.raw)).toEqual(["category_rollup"]);
  });

  it("renders NOTHING for an answer whose only shortfall is the engine's", () => {
    // The live defect, exactly: a full-screen yellow box between the sort
    // control and the first card, on every query, saying that the engine
    // this deployment chose cannot substitute synonyms.
    const server = mockServer({ "/query": { body: searchResponse() } });
    const { container } = render(
      <TestHarness server={server}>
        <DegradationNotice
          degradations={parseDegradations(["phrase_synonyms", "phrase_synonyms"])}
        />
      </TestHarness>
    );
    expect(container.querySelector("[data-testid='search-degraded']")).toBeNull();
  });

  it("still shouts about an answer that really is incomplete", () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <DegradationNotice
          degradations={parseDegradations(["phrase_synonyms", "category_rollup"])}
        />
      </TestHarness>
    );
    const box = screen.getByTestId("search-degraded");
    expect(box.querySelector("[data-degradation='category_rollup']")).toBeTruthy();
    // …and does not smuggle the engine's business in beside it.
    expect(box.querySelector("[data-degradation='phrase_synonyms']")).toBeNull();
  });

  it("shows everything under the variant an operator asks for", () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <DegradationNotice
          degradations={parseDegradations(["phrase_synonyms"])}
          variant="debug"
        />
      </TestHarness>
    );
    const box = screen.getByTestId("search-degraded");
    expect(box.getAttribute("data-variant")).toBe("debug");
    expect(box.querySelector("[data-degradation='phrase_synonyms']")).toBeTruthy();
  });
});
