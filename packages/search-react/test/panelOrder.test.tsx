/**
 * ONE panel — what stapel-search 0.16.0 made possible, and what this pair drew
 * instead for three releases.
 *
 * The rail used to be three blocks in a sequence nobody authored: the core
 * ranges, then every facet group, then every attribute range. A category that
 * puts "Year" second in its own schema got it below forty checkbox
 * groups; a host that wanted `make → price → year` could pin the two GROUPS
 * and had no vocabulary at all for where the two RANGES went.
 *
 * 0.16.0 numbers both halves on one scale (`facet_labels[…].order` and
 * `facet_meta.ranges[…].order`), names every axis it offers, and WITHHOLDS the
 * ones it cannot name or that describe too little of the page. The four things
 * this file measures are the client half of that:
 *
 *  1. a range is captioned by the answer, in the answer's unit, and an axis
 *     the answer withheld is not resurrected from the category schema;
 *  2. groups and ranges are drawn as ONE ordered sequence, pinned slugs first;
 *  3. a bucket list with no buckets is not drawn as a heading over nothing;
 *  4. the panel has ONE "Apply" for every from/to row, not one per row.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import type { FeatureDef } from "@stapel/attributes-react";
import { buildRangeGroups, orderPanelItems, parseSearchState } from "../src/index.js";
import type { FacetGroup, RangeGroup, SearchQueryState } from "../src/index.js";
import { FacetPanelPane } from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

const OPTIONS = { defaultType: "listing" } as const;

function stateOf(search: string): SearchQueryState {
  return parseSearchState(new URLSearchParams(search), OPTIONS).state;
}

/** A cars leaf: a make picker, a price the server owns, a year and a mileage. */
const CAR_FEATURES: readonly FeatureDef[] = [
  {
    slug: "make",
    name: "test.feature.make",
    mandatory: true,
    config: { type: "ref_select", optionsRef: "car.make" },
  },
  {
    slug: "year",
    name: "test.feature.year",
    config: { type: "int", min: 1900, max: 2027 },
  },
  {
    slug: "mileage",
    name: "test.feature.mileage",
    config: { type: "int", min: 0, max: 1_000_000, postfix: "км" },
  },
];

// --------------------------------------------------------------------------
// 1. the answer names the axis
// --------------------------------------------------------------------------

describe("a numeric axis is one a reader can name", () => {
  it("captions a row from the ANSWER, over the schema's own name", () => {
    const [row] = buildRangeGroups({
      state: stateOf("type=listing"),
      categoryFeatures: CAR_FEATURES,
      ranges: {
        year: {
          min: 2015,
          max: 2020,
          label: "Год выпуска",
          label_translatable: false,
          order: 2,
        },
      },
      t: (key) => key,
    });
    // The catalogue that authored the feature is the same catalogue the server
    // resolved the caption out of, and the server's copy is the one that
    // reaches a host who threaded no schema at all.
    expect(row?.label).toBe("Год выпуска");
    expect(row?.order).toBe(2);
    expect(row?.measured).toBe(true);
  });

  it("does NOT translate a caption the answer marked as literal text", () => {
    const [row] = buildRangeGroups({
      state: stateOf("type=listing"),
      categoryFeatures: CAR_FEATURES,
      ranges: {
        year: {
          min: 2015,
          max: 2020,
          label: "Год выпуска",
          label_translatable: false,
          order: 2,
        },
      },
      // A translator that would mangle anything it is handed. `false` means
      // the catalogue wrote the words, and looking them up is a bug.
      t: () => "TRANSLATED",
    });
    expect(row?.label).toBe("Год выпуска");
  });

  it("takes the UNIT from the answer — the base unit of a convertible family, which no client can derive", () => {
    const [row] = buildRangeGroups({
      state: stateOf("type=listing"),
      categoryFeatures: [
        {
          slug: "engine_volume",
          name: "test.feature.volume",
          config: { type: "convertible_unit", unit_m: "мл", unit_i: "cu in" },
        },
      ],
      ranges: {
        engine_volume: {
          min: 1,
          max: 4.4,
          label: "Объём двигателя",
          label_translatable: false,
          unit: "л",
          order: 4,
        },
      },
      t: (key) => key,
    });
    // The stored value is in the family's BASE unit, so labelling the row with
    // the input unit the schema happens to list first would call litres
    // millilitres.
    expect(row?.unit).toBe("л");
  });

  it("never resurrects an axis the answer WITHHELD, however loudly the schema declares it", () => {
    const rows = buildRangeGroups({
      state: stateOf("type=listing"),
      categoryFeatures: CAR_FEATURES,
      ranges: {
        year: {
          min: 2015,
          max: 2020,
          label: "Год выпуска",
          label_translatable: false,
          order: 2,
        },
      },
      withheld: [
        // Three of fifty-two documents carry a mileage: a slider over it
        // narrows nothing, whoever authored the field.
        {
          slug: "mileage",
          axis: "range",
          reason: "coverage",
          coverage: 3,
          candidates: 52,
        },
      ],
      t: (key) => key,
    });
    expect(rows.map((row) => row.slug)).toEqual(["year"]);
  });

  it("reads only the RANGE rows of `withheld` — one slug can be a choice and a measurement", () => {
    const rows = buildRangeGroups({
      state: stateOf("type=listing"),
      categoryFeatures: CAR_FEATURES,
      ranges: {
        year: {
          min: 2015,
          max: 2020,
          label: "Год выпуска",
          label_translatable: false,
          order: 2,
        },
      },
      // An imported `year` is a vocabulary CHOICE and a measurement at once,
      // and the two are decided by different quantities over the same page.
      // A withheld group says nothing about the slider.
      withheld: [
        { slug: "year", axis: "group", reason: "coverage", coverage: 4, candidates: 52 },
      ],
      t: (key) => key,
    });
    expect(rows.map((row) => row.slug)).toContain("year");
  });
});

// --------------------------------------------------------------------------
// 1b. one axis, one control
// --------------------------------------------------------------------------

describe("an axis that is a choice AND a measurement gets ONE control", () => {
  it("leaves a counted slug to its bucket list", () => {
    const rows = buildRangeGroups({
      state: stateOf("type=listing"),
      categoryFeatures: CAR_FEATURES,
      ranges: {
        year: { min: 2015, max: 2020, label: "Year", label_translatable: false, order: 2 },
        mileage: { min: 0, max: 300000, label: "Mileage", label_translatable: false, order: 3 },
      },
      // The plan counted `year` — so the rail already carries a list of years
      // with a number beside each. A from/to over the same field is a second
      // control writing the same filter.
      countedFacets: ["make", "year"],
      t: (key) => key,
    });
    expect(rows.map((row) => row.slug)).toEqual(["mileage"]);
  });

  it("draws both halves for a host that asks for them", () => {
    const rows = buildRangeGroups({
      state: stateOf("type=listing"),
      categoryFeatures: CAR_FEATURES,
      ranges: {
        year: { min: 2015, max: 2020, label: "Year", label_translatable: false, order: 2 },
      },
      countedFacets: ["year"],
      bothAxes: true,
      t: (key) => key,
    });
    expect(rows.map((row) => row.slug)).toContain("year");
  });

  it("keeps the control for a range the URL is CONSTRAINING, counted or not", () => {
    const rows = buildRangeGroups({
      // A shared link that narrows by year must carry the control that widens
      // it again — the same exemption the withheld list gets.
      state: stateOf("type=listing&r.year=2015..2020"),
      categoryFeatures: CAR_FEATURES,
      countedFacets: ["year"],
      t: (key) => key,
    });
    const row = rows.find((entry) => entry.slug === "year");
    expect(row?.active).toBe(true);
  });

  it("never silences a CORE axis — the server reserves that slug", () => {
    const rows = buildRangeGroups({
      state: stateOf("type=listing"),
      coreRanges: ["price"],
      // A category that also declares a counted `price` facet does not take
      // the price input off the rail: they are not the same axis.
      countedFacets: ["price"],
      t: (key) => key,
    });
    expect(rows.map((row) => row.slug)).toEqual(["price"]);
  });

  it("changes nothing for a caller that reports no counted slugs", () => {
    const rows = buildRangeGroups({
      state: stateOf("type=listing"),
      categoryFeatures: CAR_FEATURES,
      ranges: {
        year: { min: 2015, max: 2020, label: "Year", label_translatable: false, order: 2 },
      },
      t: (key) => key,
    });
    expect(rows.map((row) => row.slug)).toEqual(["year", "mileage"]);
  });
});

// --------------------------------------------------------------------------
// 2. one order over both halves
// --------------------------------------------------------------------------

function group(slug: string, order?: number): FacetGroup {
  return {
    slug,
    label: slug,
    labelSource: "server",
    feature: undefined,
    counted: true,
    options: [{ value: "x", count: 3, label: "x", labelSource: "server", selected: false }],
    selected: [],
    ...(order !== undefined ? { order } : {}),
  };
}

function range(slug: string, order?: number, core = false): RangeGroup {
  return {
    slug,
    label: slug,
    named: true,
    feature: undefined,
    from: undefined,
    to: undefined,
    min: 0,
    max: 10,
    measured: true,
    unit: undefined,
    step: undefined,
    active: false,
    core,
    picker: undefined,
    currency: undefined,
    order,
  };
}

describe("groups and ranges are drawn as one sequence", () => {
  it("interleaves by the order the plan numbered them with", () => {
    const items = orderPanelItems({
      groups: [group("make", 1), group("colour", 3)],
      ranges: [range("price", 0, true), range("year", 2)],
    });
    expect(items.map((item) => item.slug)).toEqual([
      "price",
      "make",
      "year",
      "colour",
    ]);
  });

  it("lets a host's pinned order hold across both halves", () => {
    const items = orderPanelItems({
      groups: [group("make", 1), group("colour", 3)],
      ranges: [range("price", 0, true), range("year", 2)],
      // The page has already decided what it is about, and the category's own
      // reading order does not overrule that.
      pinned: ["make", "price", "year"],
    });
    expect(items.map((item) => item.slug)).toEqual([
      "make",
      "price",
      "year",
      "colour",
    ]);
  });

  it("falls back to core ranges, then groups, then measurements when nobody numbered anything", () => {
    const items = orderPanelItems({
      groups: [group("vendor"), group("condition")],
      ranges: [range("price", undefined, true), range("weight")],
    });
    expect(items.map((item) => item.slug)).toEqual([
      "price",
      "vendor",
      "condition",
      "weight",
    ]);
  });

  it("sorts an axis the plan gave no position AFTER every axis it did", () => {
    const items = orderPanelItems({
      groups: [group("colour")],
      ranges: [range("year", 2)],
    });
    // A stated position is evidence; an assumed one is not, so the numbered
    // half of the panel is never interrupted by a guess.
    expect(items.map((item) => item.slug)).toEqual(["year", "colour"]);
  });

  it("draws the rail in that order — a price among the makes, not above them", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({
          facets: { make: { toyota: 12 }, colour: { red: 4 } },
          facet_meta: {
            approximate: false,
            candidates: 25,
            counted: ["make", "colour"],
            skipped: [],
            dropped_filters: [],
            core_ranges: ["price"],
            plan: "category",
            withheld: [],
            categories: [],
            ranges: {
              price: {
                min: 9000,
                max: 18000,
                label: "search.range.price",
                label_translatable: true,
                order: 0,
              },
              year: {
                min: 2015,
                max: 2020,
                label: "Год выпуска",
                label_translatable: false,
                order: 2,
              },
            },
          },
          facet_labels: {
            make: { translatable: false, values: { toyota: "Toyota" }, order: 1 },
            colour: { translatable: false, values: { red: "Красный" }, order: 3 },
          },
        }),
      },
    });
    const { container } = render(
      <TestHarness server={server}>
        <FacetPanelPane categoryFeatures={CAR_FEATURES} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facet-range-year")).toBeTruthy();
    });
    // `data-counted` marks a group's root, `data-core` a range row's — the
    // children of both also carry `facet-…` test ids.
    const order = [
      ...container.querySelectorAll("[data-counted],[data-core]"),
    ].map((node) => node.getAttribute("data-testid"));
    expect(order).toEqual([
      "facet-range-price",
      "facet-group-make",
      "facet-range-year",
      "facet-group-colour",
      // The schema's own `mileage`, which this answer numbered no place for:
      // a stated position beats an assumed one, so it follows the plan.
      "facet-range-mileage",
    ]);
  });
});

// --------------------------------------------------------------------------
// 3. a heading over nothing
// --------------------------------------------------------------------------

describe("an empty facet group draws nothing", () => {
  it("draws no heading for a counted group whose buckets are all gone", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({
          // `colour` was counted and came back with no values at all — the
          // shape a live laptops leaf answered with on six of six groups.
          facets: { make: { toyota: 12 }, colour: {} },
          facet_meta: {
            approximate: false,
            candidates: 25,
            counted: ["make", "colour"],
            skipped: [],
            dropped_filters: [],
            core_ranges: [],
            plan: "category",
            withheld: [],
            categories: [],
          },
          facet_labels: {
            make: { translatable: false, values: { toyota: "Toyota" } },
            colour: { label: "Цвет", translatable: false, values: {} },
          },
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <FacetPanelPane categoryFeatures={CAR_FEATURES} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facet-group-make")).toBeTruthy();
    });
    // A caption, a chevron and an empty box is a row of a 280px rail and a
    // stop in a screen reader's tour spent saying nothing.
    expect(screen.queryByTestId("facet-group-colour")).toBeNull();
    expect(screen.queryByText("Цвет")).toBeNull();
  });
});

// --------------------------------------------------------------------------
// 4. one Apply for the panel
// --------------------------------------------------------------------------

function twoAxisServer(): ReturnType<typeof mockServer> {
  return mockServer({
    "/query": {
      body: searchResponse({
        facets: { make: { toyota: 12 } },
        facet_meta: {
          approximate: false,
          candidates: 25,
          counted: ["make"],
          skipped: [],
          dropped_filters: [],
          core_ranges: ["price"],
          plan: "category",
          withheld: [],
          categories: [],
          ranges: {
            price: {
              min: 9000,
              max: 18000,
              label: "search.range.price",
              label_translatable: true,
              order: 0,
            },
            mileage: {
              min: 0,
              max: 400000,
              label: "Пробег",
              label_translatable: false,
              unit: "км",
              order: 3,
            },
          },
        },
        facet_labels: {
          make: { translatable: false, values: { toyota: "Toyota" }, order: 1 },
        },
      }),
    },
  });
}

describe("the panel applies the ranges, the rows collect them", () => {
  it("draws ONE Apply button for two from/to rows", async () => {
    render(
      <TestHarness server={twoAxisServer()}>
        <FacetPanelPane categoryFeatures={CAR_FEATURES} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facet-range-mileage")).toBeTruthy();
    });
    // Three stacked buttons down a 280px column, one per row, each committing
    // its own two fields — that is what this replaces.
    expect(screen.queryByTestId("facet-range-price-apply")).toBeNull();
    expect(screen.queryByTestId("facet-range-mileage-apply")).toBeNull();
    expect(screen.getAllByTestId("facet-ranges-apply")).toHaveLength(1);
  });

  it("applies BOTH axes in one press", async () => {
    const server = twoAxisServer();
    render(
      <TestHarness server={server}>
        <FacetPanelPane categoryFeatures={CAR_FEATURES} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facet-range-mileage")).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId("facet-range-price-from"), {
      target: { value: "10000" },
    });
    fireEvent.change(screen.getByTestId("facet-range-mileage-to"), {
      target: { value: "150000" },
    });
    // Nothing has been sent yet: the fields hold a draft and the button owns
    // the decision.
    expect(server.calls.some((call) => call.url.includes("r.price"))).toBe(false);

    fireEvent.click(screen.getByTestId("facet-ranges-apply"));
    await waitFor(() => {
      const params = server.lastQuery("/query");
      expect(params?.get("r.price")).toBe("10000..");
      expect(params?.get("r.mileage")).toBe("..150000");
    });
  });

  it("refuses a backwards pair rather than sending a search that answers zero", async () => {
    render(
      <TestHarness server={twoAxisServer()}>
        <FacetPanelPane categoryFeatures={CAR_FEATURES} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facet-range-price")).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId("facet-range-price-from"), {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByTestId("facet-range-price-to"), {
      target: { value: "100" },
    });
    // `100..500` reversed is syntactically fine and semantically empty, and
    // the server answers zero rather than refusing — which reads as "there is
    // nothing like this" instead of "you typed it backwards".
    await waitFor(() => {
      expect(
        screen
          .getByTestId("facet-ranges-apply")
          .closest("[data-stapel-gated]")
          ?.getAttribute("data-stapel-gated")
      ).toBe("blocked");
    });
  });
});
