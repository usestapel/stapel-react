/**
 * D263 (stapel-search 0.14.7/0.14.8): the ends of a from/to now come from the
 * ANSWER.
 *
 * The storefront's cars rail drew a year picker over `1900..2027` — the
 * catalogue's declaration of what a year could ever be — while the page in
 * front of the reader held cars from 1990 to 2024, and drew nothing at all
 * for the axes the catalogue types as CHOICES (a vocabulary-backed `year`, a
 * `floor`, a `doors`), because a choice is a checkbox list to a schema and a
 * from/to to a buyer. `facet_meta.ranges` settles both: which axes have
 * numbers behind them on this page, and where their ends are.
 *
 * Three things this suite pins:
 *  1. measured ends beat declared ones, and an axis the answer measured gets
 *     a row whatever the schema calls it — picker when the integer span is
 *     small (a year), two inputs otherwise (a mileage), price unchanged;
 *  2. an engine with no `ranges` verb (`degraded: ["facet_ranges"]`) falls
 *     back to the schema's bounds — silence is not "this category has no
 *     numbers";
 *  3. the rail's reservation remembers what a category was MEASURED to have,
 *     so the block that reserved two rows from the schema does not swap to
 *     four (D361, one answer later).
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import type { FeatureDef } from "@stapel/attributes-react";
import { FacetPanelPane } from "../src/default/index.js";
import {
  buildRangeGroups,
  useFacetPanel,
  usePublishRangeAxes,
} from "../src/index.js";
import type {
  FacetPanelBag,
  FacetRangesMap,
  SearchQueryState,
  SearchResponse,
} from "../src/index.js";
import { LIVE_CARS_FEATURES, liveCarsResponse } from "./liveCars.js";
import { TestHarness, mockServer } from "./harness.js";

afterEach(() => {
  cleanup();
});

/** The ends the live cars page actually has, as 0.14.7 measures them. */
const MEASURED: FacetRangesMap = {
  price: { min: 9000, max: 18000 },
  year: { min: 1990, max: 2024 },
  kilometrage: { min: 40000, max: 120000 },
  engine_volume: { min: 1.4, max: 2.5 },
};

function withRanges(
  ranges: FacetRangesMap | undefined,
  overrides: Partial<SearchResponse> = {}
): SearchResponse {
  const base = liveCarsResponse();
  return {
    ...base,
    facet_meta:
      ranges === undefined ? base.facet_meta : { ...base.facet_meta, ranges },
    ...overrides,
  };
}

function carsServer(body: SearchResponse): ReturnType<typeof mockServer> {
  return mockServer({
    "/query": { body },
    "/suggest": { body: { items: [], backend: "postgres" } },
  });
}

async function mountRail(
  body: SearchResponse,
  features: readonly FeatureDef[] = LIVE_CARS_FEATURES
): Promise<void> {
  render(
    <TestHarness server={carsServer(body)} initialSearch="type=listing&category=141/151">
      <FacetPanelPane categoryFeatures={features} />
    </TestHarness>
  );
  await waitFor(() =>
    expect(screen.getByTestId("facet-group-make_ref_select")).toBeTruthy()
  );
}

function state(overrides: Partial<SearchQueryState> = {}): SearchQueryState {
  return { type: "listing", q: "", filters: {}, ranges: {}, ...overrides } as SearchQueryState;
}

describe("the ends of an axis come from the answer that measured them", () => {
  it("prefers the measured bounds over the schema's declaration", () => {
    const groups = buildRangeGroups({
      state: state(),
      categoryFeatures: LIVE_CARS_FEATURES,
      coreRanges: ["price"],
      ranges: MEASURED,
    });
    const year = groups.find((group) => group.slug === "year");
    expect([year?.min, year?.max]).toEqual([1990, 2024]);
    expect(year?.measured).toBe(true);
    // 1990..2024 is 35 values, so it stays a picker — newest first.
    expect(year?.picker?.length).toBe(35);
    expect(year?.picker?.[0]).toBe(2024);
  });

  it("leaves a wide axis as two inputs, and a fractional one too", () => {
    const groups = buildRangeGroups({
      state: state(),
      categoryFeatures: LIVE_CARS_FEATURES,
      coreRanges: ["price"],
      ranges: MEASURED,
    });
    const km = groups.find((group) => group.slug === "kilometrage");
    expect([km?.min, km?.max]).toEqual([40000, 120000]);
    // 80 001 values is not a list a person picks from.
    expect(km?.picker).toBeUndefined();
    expect(km?.step).toBe(1);
  });

  it("keeps the core price row exactly as it was", () => {
    const price = buildRangeGroups({
      state: state(),
      categoryFeatures: LIVE_CARS_FEATURES,
      coreRanges: ["price"],
      ranges: MEASURED,
      currency: "RUB",
    }).find((group) => group.slug === "price");
    expect(price?.core).toBe(true);
    expect(price?.picker).toBeUndefined();
    expect(price?.measured).toBe(false);
    // Not clamped to the corpus's current ends: those move with every other
    // filter, and a field that refuses the number a person meant is worse.
    expect(price?.min).toBeUndefined();
    expect(price?.currency).toBe("RUB");
  });

  it("draws a row for a VOCABULARY-backed axis the schema calls a choice", () => {
    const features: readonly FeatureDef[] = [
      { slug: "year", name: "test.feature.year", config: { type: "ref_select" } },
      { slug: "make", name: "test.feature.make", config: { type: "ref_select" } },
    ];
    const groups = buildRangeGroups({
      state: state(),
      categoryFeatures: features,
      ranges: { year: { min: 2004, max: 2024 } },
    });
    // `make` is a choice with no numbers behind it and gets no row; `year` is
    // the same TYPE and gets one, because the server measured it.
    expect(groups.map((group) => group.slug)).toEqual(["year"]);
    expect(groups[0]?.picker?.length).toBe(21);
    expect(groups[0]?.label).toBe("test.feature.year");
  });

  it("draws a measured axis the schema never mentioned, under the NAME the answer gave it", () => {
    const groups = buildRangeGroups({
      state: state(),
      categoryFeatures: [],
      ranges: {
        doors: {
          min: 2,
          max: 5,
          label: "Количество дверей",
          label_translatable: false,
          order: 3,
        },
      },
    });
    expect(groups.map((group) => group.slug)).toEqual(["doors"]);
    // The whole point of stapel-search 0.16.0: the caption travels with the
    // bounds, so a host that threaded no category schema still gets a picker
    // a person can read.
    expect(groups[0]?.label).toBe("Количество дверей");
    expect(groups[0]?.named).toBe(true);
    expect(groups[0]?.order).toBe(3);
    expect(groups[0]?.picker).toEqual([5, 4, 3, 2]);
  });

  it("draws NO row for a measured axis nobody named — `doors` is storage, not a caption", () => {
    const groups = buildRangeGroups({
      state: state(),
      categoryFeatures: [],
      // The two-number shape a pre-0.16 server sends, and the shape a 0.16
      // server never sends because it withholds an axis it cannot caption.
      ranges: { doors: { min: 2, max: 5 } },
    });
    // A from/to picker captioned `doors` is a control whose meaning a reader
    // has to guess out of the numbers inside it. It was on the live chip row
    // beside `kilometrage`, and it is the defect this release closes.
    expect(groups).toEqual([]);
  });

  it("keeps an unnamed axis the URL CONSTRAINS — a filter always keeps its exit", () => {
    const groups = buildRangeGroups({
      state: state({ ranges: { doors: { from: "4" } } }),
      categoryFeatures: [],
      ranges: { doors: { min: 2, max: 5 } },
    });
    expect(groups.map((group) => group.slug)).toEqual(["doors"]);
    expect(groups[0]?.label).toBe("doors");
    expect(groups[0]?.named).toBe(false);
    expect(groups[0]?.active).toBe(true);
  });

  it("falls back to the schema when the answer measured nothing", () => {
    const year = buildRangeGroups({
      state: state(),
      categoryFeatures: LIVE_CARS_FEATURES,
      coreRanges: ["price"],
    }).find((group) => group.slug === "year");
    expect([year?.min, year?.max]).toEqual([1900, 2027]);
    expect(year?.measured).toBe(false);
    expect(year?.picker?.length).toBe(128);
  });
});

describe("the rail draws what the answer measured", () => {
  it("puts the measured ends behind the year picker and inputs on the mileage", async () => {
    await mountRail(withRanges(MEASURED));
    const from = screen.getByTestId("facet-range-year-from");
    expect(from.getAttribute("class") ?? "").toContain("ant-select");
    // The bounds the control refuses outside of are this page's, not the
    // catalogue's.
    fireEvent.change(from.querySelector("input") as HTMLInputElement, {
      target: { value: "1899" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("facet-range-year-from-bounds").textContent).toBe(
        "from 1990 to 2024"
      )
    );
    expect(screen.getByTestId("facet-range-kilometrage-from").tagName).toBe("INPUT");
    expect(screen.getByTestId("facet-range-price-from").tagName).toBe("INPUT");
  });

  it("keeps `r.year=2015..2020` on the row it belongs to", async () => {
    render(
      <TestHarness
        server={carsServer(withRanges(MEASURED))}
        initialSearch="type=listing&category=141/151&r.year=2015..2020"
      >
        <FacetPanelPane categoryFeatures={LIVE_CARS_FEATURES} />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-range-year")).toBeTruthy()
    );
    const row = screen.getByTestId("facet-range-year");
    expect(row.getAttribute("data-active")).toBe("true");
    expect(within(row).getByTestId("facet-range-year-clear")).toBeTruthy();
  });

  it("falls back to the schema's bounds when the engine has no `ranges` verb", async () => {
    await mountRail(withRanges(undefined, { degraded: ["facet_ranges"] }));
    const from = screen.getByTestId("facet-range-year-from");
    fireEvent.change(from.querySelector("input") as HTMLInputElement, {
      target: { value: "1" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("facet-range-year-from-bounds").textContent).toBe(
        "from 1900 to 2027"
      )
    );
  });
});

describe("the reservation remembers what the category was measured to have", () => {
  /** One numeric axis in the schema, four measured by the answer. */
  const THIN: readonly FeatureDef[] = [
    { slug: "year", name: "test.feature.year", config: { type: "int", min: 1900, max: 2027 } },
  ];

  /** Reads what the panel bag remembers for the category on screen. */
  function Probe(props: { readonly onBag: (bag: FacetPanelBag) => void }): null {
    props.onBag(useFacetPanel({ categoryFeatures: THIN }));
    return null;
  }

  it("remembers the axes an answer measured, per category", async () => {
    let bag: FacetPanelBag | undefined;
    render(
      <TestHarness
        server={carsServer(withRanges(MEASURED))}
        initialSearch="type=listing&category=141/151"
      >
        <Probe
          onBag={(next) => {
            bag = next;
          }}
        />
      </TestHarness>
    );
    // price is core, so the ATTRIBUTE axes are the other three.
    await waitFor(() =>
      expect(bag?.reservedRangeAxes).toEqual(["year", "kilometrage", "engine_volume"])
    );
    expect(bag?.ranges?.["year"]).toEqual({ min: 1990, max: 2024 });
  });

  it("learns nothing from an engine that cannot measure", async () => {
    let bag: FacetPanelBag | undefined;
    render(
      <TestHarness
        server={carsServer(withRanges(undefined, { degraded: ["facet_ranges"] }))}
        initialSearch="type=listing&category=141/151"
      >
        <Probe
          onBag={(next) => {
            bag = next;
          }}
        />
      </TestHarness>
    );
    await waitFor(() => expect(bag?.rangesDegraded).toBe(true));
    // Not `[]`: an empty list would teach the rail that this category has no
    // numeric axes, which is the appear-then-vanish D361 is about.
    expect(bag?.reservedRangeAxes).toBeUndefined();
    expect(bag?.ranges).toBeUndefined();
  });

  it("reserves the remembered count, not the schema's, while a rail waits", async () => {
    function Remember(): null {
      usePublishRangeAxes("141/151", ["year", "kilometrage", "engine_volume"]);
      return null;
    }
    render(
      <TestHarness
        server={carsServer(withRanges(MEASURED))}
        initialSearch="type=listing&category=141/151"
      >
        <Remember />
        {/* A rail that has not asked yet — the frame D361 is about. Its own
            schema knows one axis; the category has been measured to have
            three, and three is the count the swap will land on. */}
        <FacetPanelPane categoryFeatures={THIN} enabled={false} />
      </TestHarness>
    );
    // Three rows reserved, not the one this rail's own schema declares.
    await waitFor(() =>
      expect(screen.getAllByTestId("facet-range-skeleton")).toHaveLength(3)
    );
    // Still nothing drawn from them: the memory sizes a placeholder, it never
    // becomes a control.
    expect(screen.queryByTestId("facet-range-kilometrage")).toBeNull();
  });
});
