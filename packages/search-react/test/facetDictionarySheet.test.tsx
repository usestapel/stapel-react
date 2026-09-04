/**
 * The buyer's dictionary is the SAME gesture as the seller's.
 *
 * Mobile pass 12 measured both halves of one product on one phone: the
 * composer's vocabulary picker was a trigger row opening a sheet with a
 * search box, a recommended band and «All values» — zero checkboxes — while
 * the buyer's filter sheet drew the same axis as a wall of eight checkboxes
 * over a "Find a value" box and a "Show all (38)", with no way to say "any".
 *
 * This suite is the control on `dictionaryMode="sheet"`: what the closed row
 * says, what the sheet holds, what the box narrows, and what a commit writes
 * to the address.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { buildFacetGroups, parseSearchState } from "../src/index.js";
import type { FacetGroup } from "../src/index.js";
import type { FeatureDef } from "@stapel/attributes-react";
import { FacetGroupControl, FacetPanelPane } from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { LIVE_CARS_FEATURES, liveCarsResponse } from "./liveCars.js";
import { PHONE_WIDTH, TestHarness, mockServer, setViewport } from "./harness.js";

afterEach(cleanup);

const OPTIONS = { defaultType: "listing" } as const;

/** A vocabulary level as the counter returns one — twelve makes, so the band
 * of eight leaves a tail the alphabet has to carry. */
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

function vendorGroup(search = "type=listing"): FacetGroup {
  const groups = buildFacetGroups({
    facets: { vendor: MAKES },
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
    state: parseSearchState(new URLSearchParams(search), OPTIONS).state,
    facetLabels: { vendor: { label: "Марка", translatable: false, values: CAPTIONS } },
    categoryFeatures: [VENDOR],
  });
  const group = groups.find((candidate) => candidate.slug === "vendor");
  if (group === undefined) throw new Error("no vendor group");
  return group;
}

function mount(node: ReactElement): void {
  setViewport(PHONE_WIDTH);
  render(
    <TestHarness server={mockServer({ "/query": { body: searchResponse() } })}>
      {node}
    </TestHarness>
  );
}

/** The dictionary as a sheet, with the commit recorded. */
function sheetControl(search?: string): {
  readonly committed: ReturnType<typeof vi.fn>;
} {
  const committed = vi.fn();
  mount(
    <FacetGroupControl
      group={vendorGroup(search)}
      dictionaryMode="sheet"
      onToggle={() => undefined}
      onSetValues={committed}
    />
  );
  return { committed };
}

function openSheet(): void {
  fireEvent.click(screen.getByTestId("facet-dictionary-trigger-vendor"));
}

/** The picker rows on screen, in render order. */
function rows(): readonly string[] {
  return [...document.querySelectorAll("[data-stapel-picker-row]")].map(
    (node) => node.getAttribute("data-stapel-picker-row") ?? ""
  );
}

describe("the closed row says what the axis is narrowed to", () => {
  it("reads «Any» with nothing chosen, and carries no count", () => {
    sheetControl();
    const trigger = screen.getByTestId("facet-dictionary-trigger-vendor");
    expect(trigger.textContent).toContain("Any");
    expect(trigger.getAttribute("data-chosen")).toBe("0");
    expect(screen.queryByTestId("facet-dictionary-trigger-count-vendor")).toBeNull();
    // No checkbox wall behind it: the values live in the sheet.
    expect(screen.queryByTestId("facet-option-vendor-toyota")).toBeNull();
  });

  it("reads the chosen values themselves, with the count beside them", () => {
    sheetControl("type=listing&f.vendor=toyota&f.vendor=bmw");
    const trigger = screen.getByTestId("facet-dictionary-trigger-vendor");
    expect(trigger.textContent).toContain("Toyota");
    expect(trigger.textContent).toContain("BMW");
    expect(screen.getByTestId("facet-dictionary-trigger-count-vendor").textContent).toBe(
      "2"
    );
  });
});

describe("the sheet holds the two bands", () => {
  it("opens with «Recommended» over the busiest eight and «All values» under it", () => {
    sheetControl();
    expect(screen.queryByTestId("facet-dictionary-sheet-vendor")).toBeNull();
    openSheet();
    expect(screen.getByTestId("facet-dictionary-sheet-vendor")).toBeTruthy();
    expect(screen.getByText("Recommended")).toBeTruthy();
    expect(screen.getByText("All values")).toBeTruthy();
    // The evidence order, capped at the fold — then the rest, alphabetically.
    expect(rows().slice(0, 8)).toEqual([
      "toyota",
      "bmw",
      "honda",
      "kia",
      "mazda",
      "nissan",
      "audi",
      "ford",
    ]);
    expect(rows().slice(8)).toContain("skoda");
    expect(rows().slice(8)[0]).toBe("land-rover");
  });

  it("keeps the drill-down count on every row", () => {
    sheetControl();
    openSheet();
    const row = document.querySelector('[data-stapel-picker-row="toyota"]');
    expect(row?.textContent).toContain("802");
  });

  it("puts a CHOSEN value first even when its count would not reach the band", () => {
    // A filter a person cannot see is a filter they cannot remove — and
    // Škoda is the coldest make in the answer.
    sheetControl("type=listing&f.vendor=skoda");
    openSheet();
    expect(rows()[0]).toBe("skoda");
    // It is not repeated in the alphabet below.
    expect(rows().filter((value) => value === "skoda")).toHaveLength(1);
  });
});

describe("the box narrows the sheet, across alphabets", () => {
  it("finds a Latin make from a Cyrillic query and drops the bands", () => {
    sheetControl();
    openSheet();
    fireEvent.change(screen.getByTestId("stapel-picker-search"), {
      target: { value: "тимберленд" },
    });
    expect(rows()).toEqual(["timberland"]);
    // A "Recommended" heading over rows that answer a query is a lie about
    // which rows those are.
    expect(screen.queryByText("Recommended")).toBeNull();
    expect(screen.getByText("All values")).toBeTruthy();
  });

  it("says so in words when nothing matches", () => {
    sheetControl();
    openSheet();
    fireEvent.change(screen.getByTestId("stapel-picker-search"), {
      target: { value: "zzzz" },
    });
    expect(rows()).toEqual([]);
    expect(screen.getByText("No value matches this")).toBeTruthy();
  });
});

describe("a commit is one write, a dismissal is none", () => {
  it("applies the whole draft at once on «Done»", () => {
    const { committed } = sheetControl();
    openSheet();
    fireEvent.click(document.querySelector('[data-stapel-picker-row="toyota"]') as Element);
    fireEvent.click(document.querySelector('[data-stapel-picker-row="kia"]') as Element);
    fireEvent.click(screen.getByTestId("stapel-picker-done"));
    expect(committed).toHaveBeenCalledTimes(1);
    expect(committed).toHaveBeenCalledWith("vendor", ["toyota", "kia"]);
  });

  it("counts the draft on the commit button before it is pressed", () => {
    sheetControl();
    openSheet();
    fireEvent.click(document.querySelector('[data-stapel-picker-row="toyota"]') as Element);
    expect(screen.getByTestId("stapel-picker-done").textContent).toContain("Done");
    expect(screen.getByTestId("stapel-picker-done").textContent).toContain("1");
  });

  it("the sheet's own way out closes it and writes nothing", () => {
    const { committed } = sheetControl();
    openSheet();
    fireEvent.click(document.querySelector('[data-stapel-picker-row="toyota"]') as Element);
    // The grab handle is the keyboard/back-gesture half of the swipe.
    fireEvent.click(screen.getByTestId("stapel-sheet-handle"));
    expect(committed).not.toHaveBeenCalled();
    expect(screen.getByTestId("facet-dictionary-trigger-vendor").getAttribute("aria-expanded")).toBe(
      "false"
    );
  });
});

describe("without a bulk setter the group keeps the desktop field", () => {
  it("falls back rather than committing a draft it cannot apply", () => {
    mount(
      <FacetGroupControl
        group={vendorGroup()}
        dictionaryMode="sheet"
        onToggle={() => undefined}
      />
    );
    expect(screen.queryByTestId("facet-dictionary-trigger-vendor")).toBeNull();
    expect(screen.getByTestId("facet-dictionary-field-vendor")).toBeTruthy();
  });
});

describe("the commit reaches the address", () => {
  let latest = "";

  it("writes the short URL key for the values the sheet kept", async () => {
    setViewport(PHONE_WIDTH);
    latest = "type=listing&category=141/151";
    render(
      <TestHarness
        server={mockServer({
          "/query": { body: liveCarsResponse() },
          "/suggest": { body: { items: [], backend: "postgres" } },
        })}
        initialSearch={latest}
        onAdapter={(adapter) => {
          latest = adapter.search;
        }}
      >
        <FacetPanelPane categoryFeatures={LIVE_CARS_FEATURES} dictionaryMode="sheet" />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-dictionary-trigger-make_ref_select")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("facet-dictionary-trigger-make_ref_select"));
    fireEvent.click(document.querySelector('[data-stapel-picker-row="toyota"]') as Element);
    fireEvent.click(screen.getByTestId("stapel-picker-done"));
    await waitFor(() => expect(latest).toContain("f.make=toyota"));
    expect(latest).not.toContain("make_ref_select");
  });
});
