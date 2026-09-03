/**
 * The chip row's ORDER, which at 390px is most of its product.
 *
 * Measured on a live classified deployment: on a phone category the first
 * seven chips were battery health, four parcel dimensions and two wholesale
 * counts — every one of them a numeric attribute the category happens to
 * declare — drawn before the price, the condition and the vendor. A person
 * sees about four chips before the fold, so the filters the SERP exists for
 * were all past it.
 *
 * The fix is an order, not a deletion. Nothing in a feature def separates
 * `akb` from `weight_for_delivery`, and the next category's `int` attribute is
 * `mileage`; a package that deleted them would be guessing, and would take a
 * working filter away on the guess. So the row states its bands and sorts by
 * evidence it actually has — see `FilterChips`'s ordering note.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  CHIP_BAND_ORDER,
  SearchPage,
  capChipRow,
  orderChipFilters,
} from "../src/default/index.js";
import { buildFacetGroups, buildRangeGroups, parseSearchState } from "../src/index.js";
import type { SearchParamsAdapter, SearchQueryState } from "../src/index.js";
import {
  PHONE_FACETS,
  PHONE_RANGE_FEATURES,
  legacySearchResponse,
  searchResponse,
} from "./fixtures.js";
import { TestProviders, mockServer, useTestParams } from "./harness.js";

afterEach(cleanup);

const OPTIONS = { defaultType: "listing" } as const;

function stateOf(search: string): SearchQueryState {
  return parseSearchState(new URLSearchParams(search), OPTIONS).state;
}

/** The row's specs, built the way `<FilterChips>` builds them. */
function specsFor(
  search = "type=listing",
  coreRanges: readonly string[] = ["price"],
  options: { readonly barren?: boolean } = {}
) {
  const state = stateOf(search);
  const ranges = buildRangeGroups({
    state,
    categoryFeatures: PHONE_RANGE_FEATURES,
    coreRanges,
  });
  const facets = buildFacetGroups({
    facets: options.barren === true ? {} : PHONE_FACETS,
    meta: {
      approximate: false,
      candidates: options.barren === true ? 0 : 43,
      counted: Object.keys(PHONE_FACETS),
      skipped: [],
      dropped_filters: [], core_ranges: [...coreRanges], plan: "category", withheld: [], categories: [],
    },
    state,
    categoryFeatures: PHONE_RANGE_FEATURES,
  });
  return orderChipFilters(
    ranges,
    facets.filter((group) => group.options.length > 0),
    options
  );
}

function slugs(specs: ReturnType<typeof specsFor>): readonly string[] {
  return specs.map((spec) =>
    spec.band === "facet" ? spec.facet.slug : spec.range.slug
  );
}

describe("bands: the server's evidence first, the category's guesses last", () => {
  it("states the three bands in one place", () => {
    expect(CHIP_BAND_ORDER).toEqual(["core_range", "facet", "attribute_range"]);
  });

  it("puts the core axis and the counted facets before the numeric attributes", () => {
    // The measured defect, inverted: price and condition lead, parcel width
    // and wholesale counts trail.
    expect(slugs(specsFor()).slice(0, 3)).toEqual([
      "price",
      "condition",
      "vendor",
    ]);
  });

  it("keeps every attribute chip — the row reorders, it does not delete", () => {
    // A rule that dropped these would have to answer "on what evidence", and
    // the only server signal that names a slug (`facet_meta.skipped`) means the
    // counter ran out of plan slots, not that a person cannot filter by it.
    const all = slugs(specsFor());
    for (const slug of [
      "akb",
      "weight_for_delivery",
      "length_for_delivery",
      "height_for_delivery",
      "width_for_delivery",
      "wholesale_min_order_count",
      "wholesale_packing_count",
    ]) {
      expect(all).toContain(slug);
    }
  });

  it("keeps the order each source gave inside a band", () => {
    // A closed set's authored order has to survive all the way to the row, so
    // the sort is stable and never re-ranks within a band.
    const attributes = slugs(specsFor()).slice(-7);
    expect(attributes).toEqual([
      "akb",
      "weight_for_delivery",
      "length_for_delivery",
      "height_for_delivery",
      "width_for_delivery",
      "wholesale_min_order_count",
      "wholesale_packing_count",
    ]);
  });
});

describe("an APPLIED filter is never past the fold", () => {
  it("lifts a set attribute range above the unapplied core axis", () => {
    // A constraint a person has set has to be reachable without a flick, or
    // the row states filters that are on screen only if you go looking.
    expect(slugs(specsFor("type=listing&r.akb=80..")).at(0)).toBe("akb");
  });

  it("lifts a set facet the same way", () => {
    expect(slugs(specsFor("type=listing&f.vendor=apple")).at(0)).toBe("vendor");
  });

  it("orders two applied filters by band among themselves", () => {
    expect(
      slugs(specsFor("type=listing&r.akb=80..&r.price=100..500")).slice(0, 2)
    ).toEqual(["price", "akb"]);
  });
});

describe("the pre-0.4.0 server degrades to today's behaviour", () => {
  it("declares no core axis, so the counted facets simply lead", () => {
    // `facet_meta.core_ranges` is ABSENT, not empty: no price row exists to
    // put first, and nothing throws reaching for the missing key.
    expect(slugs(specsFor("type=listing", [])).slice(0, 2)).toEqual([
      "condition",
      "vendor",
    ]);
  });
});

describe("the rendered row", () => {
  function mount(body: unknown): void {
    function Page(): ReactElement {
      const adapter: SearchParamsAdapter = useTestParams(
        "type=listing&category=elektronika/mobilnye-telefony"
      );
      return (
        <SearchPage
          adapter={adapter}
          defaultType="listing"
          filtersLayout="sheet"
          categoryFeatures={PHONE_RANGE_FEATURES}
        />
      );
    }
    render(
      <TestProviders
        server={mockServer({
          "/query": { body },
          "/suggest": { body: { items: [], backend: "postgres" } },
        })}
      >
        <Page />
      </TestProviders>
    );
  }

  it("draws the price and the facets ahead of the delivery dimensions", async () => {
    mount(searchResponse({ facets: PHONE_FACETS }));
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-condition")).toBeTruthy();
    });
    const row = screen.getByTestId("search-filter-chips");
    const ids = [...row.querySelectorAll("[data-band]")].map((node) =>
      node.getAttribute("data-testid")
    );
    expect(ids.slice(0, 3)).toEqual([
      "search-chip-range-price",
      "search-chip-condition",
      "search-chip-vendor",
    ]);
    // The tail is CAPPED now (D16 reopen): the row ends at its budget and
    // the two wholesale counts live behind the door, in the panel.
    expect(ids.at(-1)).toBe("search-chip-range-width_for_delivery");
    expect(ids).toHaveLength(8);
    expect(screen.getByTestId("search-chips-overflow").textContent).toContain("2");
  });

  it("still draws every chip on a server that sends no core axis", async () => {
    mount(legacySearchResponse());
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-condition")).toBeTruthy();
    });
    const row = screen.getByTestId("search-filter-chips");
    const ids = [...row.querySelectorAll("[data-band]")].map((node) =>
      node.getAttribute("data-testid")
    );
    expect(ids[0]).toBe("search-chip-condition");
    expect(ids).toContain("search-chip-range-akb");
    expect(ids).not.toContain("search-chip-range-price");
  });
});

describe("a barren result: the chips that never needed a count are not the answer", () => {
  it("drops the unapplied numeric attributes when nothing matched", () => {
    // Measured live on a cars leaf inside a radius that held no cars: every
    // counted facet came back empty and dropped out on its own, leaving a row
    // of "Year / VIN / Dealer offer x9" — schema-only numeric axes,
    // on a page with no cars on it. The core axis stays: price is the server's
    // own declaration and it is what a person widens first.
    const barren = slugs(specsFor("type=listing", ["price"], { barren: true }));
    expect(barren).toEqual(["price"]);
  });

  it("keeps an APPLIED numeric attribute — a constraint keeps its control", () => {
    const applied = slugs(
      specsFor("type=listing&r.weight_for_delivery=1..5", ["price"], {
        barren: true,
      })
    );
    expect(applied).toContain("weight_for_delivery");
    expect(applied[0]).toBe("weight_for_delivery");
  });

  it("changes nothing when the result is not barren", () => {
    expect(slugs(specsFor())).toEqual(slugs(specsFor("type=listing", ["price"], {})));
  });
});

function mountChips(body: unknown): void {
  function Page(): ReactElement {
    const adapter: SearchParamsAdapter = useTestParams(
      "type=listing&category=elektronika/mobilnye-telefony"
    );
    return (
      <SearchPage
        adapter={adapter}
        defaultType="listing"
        filtersLayout="sheet"
        categoryFeatures={PHONE_RANGE_FEATURES}
      />
    );
  }
  render(
    <TestProviders
      server={mockServer({
        "/query": { body },
        "/suggest": { body: { items: [], backend: "postgres" } },
      })}
    >
      <Page />
    </TestProviders>
  );
}

/**
 * D16 (reopened): ordering alone did not survive a grown catalogue. The
 * attributes-v2 import gave the phones leaf option tables for its wholesale
 * plumbing — so they came back as (uncounted) facet groups — and a cars leaf
 * declares enough axes for 44 chips in one row. Two mechanisms close it:
 *
 *  - WITHIN the counted-facet band, the row leads with the axes the answer
 *    itself shows people actually fill: coverage (the sum of a group's
 *    counts) ranks a brand every document carries above a "camera flaws"
 *    eleven carry and above an uncounted schema guess with no evidence at
 *    all. Ties keep the authored order — the sort stays stable.
 *  - the row is CAPPED, with a "more" door to the full panel for the rest.
 *    Nothing is deleted: the panel behind the leading circle still carries
 *    every control, and an APPLIED filter is never behind the door.
 */
describe("within the facet band, coverage leads (D16 reopen)", () => {
  function facetGroup(
    slug: string,
    counts: readonly (number | null)[],
    selected: readonly string[] = []
  ) {
    return {
      slug,
      label: slug,
      feature: undefined,
      counted: counts.some((count) => count !== null),
      options: counts.map((count, index) => ({
        value: `v${String(index)}`,
        count,
        label: `v${String(index)}`,
        selected: selected.includes(`v${String(index)}`),
      })),
      selected,
    };
  }

  it("a heavily-carried axis outranks a sparse one, whatever the schema order", () => {
    const ordered = orderChipFilters(
      [],
      [
        facetGroup("wholesale_packing", [2, 1]),
        facetGroup("vendor", [25, 15, 10]),
        facetGroup("camera_flaws", [8, 3]),
      ]
    );
    expect(
      ordered.map((spec) => (spec.band === "facet" ? spec.facet.slug : ""))
    ).toEqual(["vendor", "camera_flaws", "wholesale_packing"]);
  });

  it("an uncounted schema group has no evidence and trails the counted ones", () => {
    const ordered = orderChipFilters(
      [],
      [
        facetGroup("wholesale_measure_unit", [null, null]),
        facetGroup("condition", [30, 12]),
      ]
    );
    expect(
      ordered.map((spec) => (spec.band === "facet" ? spec.facet.slug : ""))
    ).toEqual(["condition", "wholesale_measure_unit"]);
  });

  it("equal coverage keeps the authored order — the sort stays stable", () => {
    const ordered = orderChipFilters(
      [],
      [facetGroup("a", [10, 10]), facetGroup("b", [20])]
    );
    expect(
      ordered.map((spec) => (spec.band === "facet" ? spec.facet.slug : ""))
    ).toEqual(["a", "b"]);
  });
});

describe("the row is capped behind a more-door (D16 reopen)", () => {
  it("caps unapplied chips and counts the rest for the door", () => {
    const specs = specsFor(); // price + condition + vendor + 7 attributes = 10
    const { visible, overflow } = capChipRow(specs, 8);
    expect(visible).toHaveLength(8);
    expect(overflow).toBe(2);
  });

  it("null disables the cap", () => {
    const specs = specsFor();
    const { visible, overflow } = capChipRow(specs, null);
    expect(visible).toHaveLength(specs.length);
    expect(overflow).toBe(0);
  });

  it("an applied filter is NEVER behind the door", () => {
    // Nine applied ranges against a cap of 3: every one of them stays, and
    // only the unapplied rest is counted for the door.
    const applied = specsFor(
      "type=listing&r.akb=80..&r.weight_for_delivery=1..&r.length_for_delivery=1..&r.height_for_delivery=1..&r.width_for_delivery=1..&r.wholesale_min_order_count=1..&r.wholesale_packing_count=1..&r.price=1.."
    );
    const { visible } = capChipRow(applied, 3);
    const visibleSlugs = slugs(visible);
    for (const spec of applied) {
      if (spec.band === "facet" ? spec.facet.selected.length > 0 : spec.range.active) {
        expect(visibleSlugs).toContain(
          spec.band === "facet" ? spec.facet.slug : spec.range.slug
        );
      }
    }
  });

  it("the rendered row draws the door, and the door opens the panel", async () => {
    mountChips(searchResponse({ facets: PHONE_FACETS }));
    await waitFor(() => {
      expect(screen.getByTestId("search-chip-condition")).toBeTruthy();
    });
    const door = screen.getByTestId("search-chips-overflow");
    expect(door.textContent).toContain("2");
    fireEvent.click(door);
    await waitFor(() => {
      expect(screen.getByTestId("search-filters-sheet")).toBeTruthy();
    });
  });
});
