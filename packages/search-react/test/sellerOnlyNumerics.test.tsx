/**
 * `config.facet: false` — the buyer-facet opt-out, on the NUMERIC half (D74).
 *
 * Reviewers on a leaf selling thirteen second-hand laptops were offered a
 * filter rail of the parcel's weight, length, height and width, the packing
 * quantity and the minimum order — six from/to rows of the seller's own
 * shipping and wholesale paperwork, and one real axis (the battery) among
 * them.
 *
 * It was never a data defect. Every one of those slugs carries `facet: false`
 * in the catalogue, in both fixture catalogues and on the live stand, and
 * `stapel-search` honours it (`_is_facetable`, read off the feature and then
 * off its config, defaulting to true): the answer for that leaf counts
 * twenty-four facets and none of the six.
 *
 * The client threw the flag away on one path. The DISCRETE half is built from
 * the answer — the server has already applied the opt-out before the buckets
 * arrive — but the NUMERIC half walks `categoryFeatures`, which is the raw
 * category schema, and pushed every numeric feature as a from/to row without
 * ever asking. So the opt-out worked on every axis the server enumerates and
 * on none of the axes it cannot.
 *
 * The features below are captured from the committed catalogue's own laptops
 * leaf (`elektronika-noutbuki`), not written to make the rule pass: seven
 * numeric features, one of them a real axis.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { FeatureDef } from "@stapel/attributes-react";
import { FacetPanelPane } from "../src/default/index.js";
import {
  buildFacetGroups,
  buildRangeGroups,
  featureAllowsFaceting,
  parseSearchState,
} from "../src/index.js";
import type { SearchQueryState } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

afterEach(cleanup);

/**
 * The laptops leaf's seven numeric features, verbatim from the catalogue —
 * one axis a buyer narrows by, six the seller states about the SALE.
 */
const LAPTOP_NUMERICS: readonly FeatureDef[] = [
  { slug: "akb", name: "Состояние аккумулятора", config: { type: "int", min: 1 } },
  {
    slug: "weight_for_delivery",
    name: "Вес (Для Доставки)",
    config: { type: "int", facet: false, postfix: "кг" },
  },
  {
    slug: "length_for_delivery",
    name: "Длина (Для Доставки)",
    config: { type: "int", facet: false },
  },
  {
    slug: "height_for_delivery",
    name: "Высота (Для Доставки)",
    config: { type: "int", facet: false },
  },
  {
    slug: "width_for_delivery",
    name: "Ширина (Для Доставки)",
    config: { type: "int", facet: false },
  },
  {
    slug: "wholesale_min_order_count",
    name: "Количество в минимальном заказе",
    config: { type: "int", facet: false, min: 1, max: 10_000_000 },
  },
  {
    slug: "wholesale_packing_count",
    name: "Количество в фасовке",
    config: { type: "int", facet: false, min: 1, max: 100_000 },
  },
];

function state(overrides: Partial<SearchQueryState> = {}): SearchQueryState {
  return { type: "listing", q: "", filters: {}, ranges: {}, ...overrides } as SearchQueryState;
}

describe("a numeric feature the catalogue disowns is not a filter", () => {
  it("draws the battery row and none of the six shipping and wholesale ones", () => {
    const slugs = buildRangeGroups({
      state: state(),
      categoryFeatures: LAPTOP_NUMERICS,
      coreRanges: ["price"],
    }).map((group) => group.slug);
    // Price is the answer's core axis and belongs to the buyer; the battery is
    // the leaf's one real numeric axis. Everything else was the seller's form.
    expect(slugs).toEqual(["price", "akb"]);
  });

  it("puts the rows on the page, and the seller's paperwork on none of it", async () => {
    render(
      <TestHarness
        server={mockServer({
          "/query": {
            body: searchResponse({
              facets: {},
              facet_meta: {
                approximate: false,
                candidates: 13,
                counted: [],
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
        })}
        initialSearch="type=listing&category=elektronika/noutbuki"
      >
        <FacetPanelPane categoryFeatures={LAPTOP_NUMERICS} />
      </TestHarness>
    );
    await waitFor(() => expect(screen.getByTestId("facet-range-price")).toBeTruthy());
    expect(screen.getByTestId("facet-range-akb")).toBeTruthy();
    for (const slug of [
      "weight_for_delivery",
      "length_for_delivery",
      "height_for_delivery",
      "width_for_delivery",
      "wholesale_min_order_count",
      "wholesale_packing_count",
    ]) {
      expect(
        screen.queryByTestId(`facet-range-${slug}`),
        `${slug} is the seller's own paperwork and must not be a filter`
      ).toBeNull();
    }
  });
});

describe("what the opt-out must NOT take away", () => {
  it("keeps a row the link already constrains, so it can be cleared", () => {
    // A shared or stale link carrying `r.weight_for_delivery=1..5` has to keep
    // the control that removes it — the same clause the discrete half applies
    // to an applied filter on a slug the schema disowns.
    const slugs = buildRangeGroups({
      state: state({ ranges: { weight_for_delivery: { from: "1", to: "5" } } }),
      categoryFeatures: LAPTOP_NUMERICS,
    }).map((group) => group.slug);
    expect(slugs).toContain("weight_for_delivery");
  });

  it("keeps an axis THIS ANSWER measured, whatever the schema says", () => {
    // Evidence outranks a stale schema in one direction only: the server
    // publishing bounds for a slug is the server saying it counted it.
    const slugs = buildRangeGroups({
      state: state(),
      categoryFeatures: LAPTOP_NUMERICS,
      ranges: { width_for_delivery: { min: 1, max: 90 } },
    }).map((group) => group.slug);
    expect(slugs).toContain("width_for_delivery");
  });

  it("says nothing about a feature that says nothing", () => {
    // Silence is not an opt-out: the flag defaults to true, exactly as the
    // engine reads it, so a catalogue that never heard of the key is unchanged.
    expect(featureAllowsFaceting(undefined)).toBe(true);
    expect(
      featureAllowsFaceting({ slug: "akb", name: "", config: { type: "int" } })
    ).toBe(true);
  });

  it("reads the flag off the feature as well as off its config", () => {
    // `_is_facetable` reads the FeatureDef first and then its config; the
    // catalogue writes it in the config today and the boundary may lift it.
    expect(
      featureAllowsFaceting({
        slug: "weight_for_delivery",
        name: "",
        facet: false,
        config: { type: "int" },
      })
    ).toBe(false);
  });
});

describe("the discrete half honours the same flag", () => {
  it("drops a disowned select the server counted anyway", () => {
    // The engine already applies the opt-out, so this is the belt against a
    // stale index or an older server — and the rule is the one the module
    // already states: a schema may remove an axis it NAMES and disowns.
    const groups = buildFacetGroups({
      facets: { nds: { "bez-nds": 4 }, condition: { new: 7, used: 18 } },
      meta: {
        approximate: false,
        candidates: 25,
        counted: ["nds", "condition"],
        skipped: [],
        dropped_filters: [],
        core_ranges: ["price"],
        plan: "category",
        withheld: [],
        categories: [],
      },
      state: parseSearchState(new URLSearchParams("type=listing"), {
        defaultType: "listing",
      }).state,
      categoryFeatures: [
        {
          slug: "nds",
          name: "Включая НДС",
          config: {
            type: "select",
            facet: false,
            options: [{ label: "Без НДС", value: "bez-nds" }],
          },
        },
        {
          slug: "condition",
          name: "Состояние",
          config: {
            type: "select",
            options: [
              { label: "Новое", value: "new" },
              { label: "Б/у", value: "used" },
            ],
          },
        },
      ],
    }).map((group) => group.slug);
    expect(groups).toEqual(["condition"]);
  });

  it("keeps a disowned axis the reader has already filtered on", () => {
    const groups = buildFacetGroups({
      facets: { nds: { "bez-nds": 4 } },
      meta: {
        approximate: false,
        candidates: 25,
        counted: ["nds"],
        skipped: [],
        dropped_filters: [],
        core_ranges: [],
        plan: "category",
        withheld: [],
        categories: [],
      },
      state: parseSearchState(
        new URLSearchParams("type=listing&f.nds=bez-nds"),
        { defaultType: "listing" }
      ).state,
      categoryFeatures: [
        {
          slug: "nds",
          name: "Включая НДС",
          config: {
            type: "select",
            facet: false,
            options: [{ label: "Без НДС", value: "bez-nds" }],
          },
        },
      ],
    }).map((group) => group.slug);
    expect(groups).toEqual(["nds"]);
  });
});
