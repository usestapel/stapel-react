/**
 * THE CARS RAIL, AGAINST THE ANSWER THE CARS PAGE ACTUALLY RETURNS.
 *
 * A walk of a live classified's desktop cars page reported three things at
 * once, and this suite is one per section:
 *
 *  1. **the make, the model and the year were not in the rail** while
 *     steering side, power steering and heating filled it. The first three
 *     the fields the category marks REQUIRED; the last three are optional
 *     comfort options. Two independent causes, both pinned below: the rail
 *     ranked by evidence rather than by the schema, and a group with no
 *     option table is dropped — which is every `ref_select` in this
 *     catalogue, because their config is a vocabulary POINTER, so they exist
 *     only while the server counts them.
 *  2. **the year was a bare number.** It is `int` with `min: 1900,
 *     max: 2027` — 128 values, which is a picker.
 *  3. **the rail's scrollbar lay across the filters.**
 *
 * Every fact the suite leans on comes from `liveCars.ts`, captured from the
 * deployment rather than invented here.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FeatureDef } from "@stapel/attributes-react";
import {
  FACET_VISIBLE_GROUPS,
  FacetPanelPane,
  PartitionChips,
  RAIL_CLASS,
  railScrollbarCss,
} from "../src/default/index.js";
import {
  buildFacetGroups,
  buildRangeGroups,
  facetGroupIsDrawable,
  orderFacetGroupsBySchema,
  parseSearchState,
} from "../src/index.js";
import { LIVE_CARS_FEATURES, liveCarsResponse } from "./liveCars.js";
import { TestHarness, mockServer } from "./harness.js";

const OPTIONS = { defaultType: "listing" } as const;

afterEach(() => {
  cleanup();
});

function carsServer(): ReturnType<typeof mockServer> {
  return mockServer({
    "/query": { body: liveCarsResponse() },
    "/suggest": { body: { items: [], backend: "postgres" } },
  });
}

/** The panel over the live answer, with the schema the host chooses to pass. */
async function mountCarsRail(
  features: readonly FeatureDef[] | undefined = LIVE_CARS_FEATURES,
  extra: Record<string, unknown> = {}
): Promise<void> {
  render(
    <TestHarness server={carsServer()} initialSearch="type=listing&category=141/151">
      <FacetPanelPane
        {...(features !== undefined ? { categoryFeatures: features } : {})}
        {...extra}
      />
    </TestHarness>
  );
  await waitFor(() =>
    expect(screen.getByTestId("facet-group-make_ref_select")).toBeTruthy()
  );
}

/** The groups the panel would build for the live answer. */
function liveGroups(features?: readonly FeatureDef[]): ReturnType<typeof buildFacetGroups> {
  const body = liveCarsResponse();
  return buildFacetGroups({
    facets: body.facets,
    meta: body.facet_meta,
    state: parseSearchState(new URLSearchParams("type=listing"), OPTIONS).state,
    facetLabels: body.facet_labels,
    ...(features !== undefined ? { categoryFeatures: features } : {}),
  });
}

describe("a group the answer has EVIDENCE for is never dropped", () => {
  it("keeps `make_ref_select` when the page passes the PARENT node's empty feature list", () => {
    // The live cars page asks about id 151, whose own feature list is `[]` —
    // the schema belongs to the leaf. Every def lookup below therefore misses.
    const groups = liveGroups([]);
    const make = groups.find((group) => group.slug === "make_ref_select");
    expect(make).toBeTruthy();
    expect(make?.options.map((option) => option.value)).toEqual([
      "renault",
      "toyota",
      "vaz-lada",
    ]);
    // And named, because the ANSWER names it — the schema could not.
    expect(make?.label).toBe("Марка");
    expect(make?.labelSource).toBe("server");
  });

  it("keeps a counted axis a schema mentions but does not TYPE", () => {
    // A def with no `config.type` says nothing, and nothing is not a verdict:
    // a counted axis is never dropped for a schema that is silent about it.
    // The live parent node is the extreme of the same case — an empty list.
    const untyped: readonly FeatureDef[] = [
      { slug: "make_ref_select", name: "Марка", config: {} },
    ];
    expect(
      liveGroups(untyped).some((group) => group.slug === "make_ref_select")
    ).toBe(true);
  });

  it("still drops an unfacetable slug the answer has NO evidence for", () => {
    // The evidence clause is not a licence for everything: an `imei` counted
    // to zero is still not a filter.
    const groups = buildFacetGroups({
      facets: { imei: { "353918": 0 } },
      meta: {
        approximate: false,
        candidates: 3,
        counted: ["imei"],
        skipped: [],
        dropped_filters: [],
        core_ranges: [],
        plan: "evidence",
        withheld: [],
        categories: [],
      },
      state: parseSearchState(new URLSearchParams("type=listing"), OPTIONS).state,
      categoryFeatures: [{ slug: "imei", config: { type: "string" } }],
    });
    expect(groups).toEqual([]);
  });

  it("names an axis it cannot draw instead of losing it silently", () => {
    // The make with the server not counting it: a `ref_select` config is a
    // bare `optionsRef`, so there is nothing to enumerate on either side and
    // the panel will not draw a heading over nothing. That is the right call
    // and it is a WIRING FAULT — the schema calls the axis required — so it
    // is said out loud where a developer can see it.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const skipped = buildFacetGroups({
      facets: {},
      meta: {
        approximate: false,
        candidates: 3,
        counted: [],
        skipped: ["make_ref_select"],
        dropped_filters: [],
        core_ranges: [],
        plan: "evidence",
        withheld: [],
        categories: [],
      },
      state: parseSearchState(new URLSearchParams("type=listing"), OPTIONS).state,
      categoryFeatures: LIVE_CARS_FEATURES,
    });
    const make = skipped.find((group) => group.slug === "make_ref_select");
    expect(make?.options).toEqual([]);
    expect(make === undefined ? null : facetGroupIsDrawable(make)).toBe(false);
    expect(warn.mock.calls.flat().join(" ")).toContain("make_ref_select");
    expect(warn.mock.calls.flat().join(" ")).toContain("REQUIRED");
    warn.mockRestore();
  });
});

describe("the rail is in SCHEMA order, required first", () => {
  it("puts the required makes and models ahead of the optional comfort axes", () => {
    const ordered = orderFacetGroupsBySchema({
      groups: liveGroups(LIVE_CARS_FEATURES).filter(facetGroupIsDrawable),
      categoryFeatures: LIVE_CARS_FEATURES,
    });
    const slugs = ordered.map((group) => group.slug);
    // The make (required, first in the schema) leads. Condition and colour
    // are required too and follow in schema order — evidence order put them
    // FIRST, because on three listings the busiest axis is an accident.
    expect(slugs[0]).toBe("make_ref_select");
    expect(slugs.indexOf("model")).toBeLessThan(slugs.indexOf("accident"));
    // `wheel_type` is required in this catalogue and `heating` is not, so
    // optional one sorts behind every required axis.
    expect(slugs.indexOf("wheel_type")).toBeLessThan(slugs.indexOf("heating"));
    expect(slugs.indexOf("power_steering")).toBeGreaterThan(
      slugs.indexOf("body_type_ref_select")
    );
  });

  it("pins an axis a page has already decided is its subject", () => {
    const ordered = orderFacetGroupsBySchema({
      groups: liveGroups(LIVE_CARS_FEATURES).filter(facetGroupIsDrawable),
      categoryFeatures: LIVE_CARS_FEATURES,
      pinned: ["color"],
    });
    expect(ordered[0]?.slug).toBe("color");
  });

  it("falls back to evidence order for what the schema does not name", () => {
    // The live parent-node case: no schema, so no required flag and no
    // declared order — there is no other order to have.
    const ordered = orderFacetGroupsBySchema({
      groups: liveGroups([]).filter(facetGroupIsDrawable),
      categoryFeatures: [],
    });
    expect(ordered[0]?.slug).toBe("make_ref_select");
  });

  it("draws the required axes first in the panel and folds the tail", async () => {
    await mountCarsRail();
    const headings = [
      ...document.querySelectorAll<HTMLElement>("[data-testid^='facet-group-']"),
    ].map((node) => node.getAttribute("data-testid"));
    expect(headings[0]).toBe("facet-group-make_ref_select");
    expect(headings.length).toBe(FACET_VISIBLE_GROUPS);
    const more = screen.getByTestId("facets-all-filters");
    expect(more.textContent).toContain("All filters");
    fireEvent.click(more);
    await waitFor(() =>
      expect(screen.getByTestId("facet-group-heating")).toBeTruthy()
    );
  });

  it("draws the partition above every filter", async () => {
    await mountCarsRail(LIVE_CARS_FEATURES, {
      partition: (
        <PartitionChips
          variant="segmented"
          items={[{ id: 166, path: "141/151/166", name: "С пробегом" }]}
          value={null}
          onChange={() => undefined}
        />
      ),
    });
    const partition = screen.getByTestId("search-partition");
    const make = screen.getByTestId("facet-group-make_ref_select");
    expect(
      partition.compareDocumentPosition(make) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe("a partition is a radiogroup in both variants", () => {
  it("keeps the roles, the roving tabindex and the arrow keys when segmented", () => {
    const chosen: (string | null)[] = [];
    render(
      <TestHarness server={carsServer()} initialSearch="type=listing">
        <PartitionChips
          variant="segmented"
          items={[
            { id: 166, path: "141/151/166", name: "С пробегом" },
            { id: 167, path: "141/151/167", name: "Новые" },
          ]}
          value="141/151/166"
          onChange={(path) => chosen.push(path)}
        />
      </TestHarness>
    );
    const row = screen.getByTestId("partition-chips");
    expect(row.getAttribute("role")).toBe("radiogroup");
    expect(row.getAttribute("data-variant")).toBe("segmented");
    const used = screen.getByTestId("partition-chip-141/151/166");
    // The roving stop is on the CHOSEN cell, not on the first of three.
    expect(used.getAttribute("tabindex")).toBe("0");
    expect(screen.getByTestId("partition-chip-all").getAttribute("tabindex")).toBe(
      "-1"
    );
    fireEvent.keyDown(used, { key: "ArrowRight" });
    expect(chosen).toEqual(["141/151/167"]);
  });
});

describe("a dictionary is a FIELD on the desktop rail", () => {
  /** Twelve counted makes: past the dictionary fold, so the group is one. */
  const MANY = liveCarsResponse({
    facets: {
      make_ref_select: {
        toyota: 802,
        bmw: 611,
        honda: 540,
        kia: 480,
        mazda: 430,
        nissan: 390,
        audi: 350,
        ford: 300,
        renault: 120,
        skoda: 90,
        opel: 60,
        seat: 40,
      },
    },
    facet_meta: {
      approximate: false,
      candidates: 4213,
      counted: ["make_ref_select"],
      skipped: [],
      dropped_filters: [],
      core_ranges: ["price"],
      plan: "evidence",
      withheld: [],
      categories: [],
    },
  });

  async function mountDictionary(mode: "field" | "inline"): Promise<void> {
    render(
      <TestHarness
        server={mockServer({
          "/query": { body: MANY },
          "/suggest": { body: { items: [], backend: "postgres" } },
        })}
        initialSearch="type=listing"
      >
        <FacetPanelPane categoryFeatures={LIVE_CARS_FEATURES} dictionaryMode={mode} />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-group-make_ref_select")).toBeTruthy()
    );
  }

  it("reads 'Any' closed, and opens the searchable list", async () => {
    await mountDictionary("field");
    const field = screen.getByTestId("facet-dictionary-field-make_ref_select");
    expect(field.getAttribute("role")).toBe("combobox");
    expect(field.getAttribute("aria-expanded")).toBe("false");
    expect(field.textContent).toContain("Any");
    // Closed means the 418-value list is not on the page at all.
    expect(screen.queryByTestId("facet-dictionary-search-make_ref_select")).toBeNull();
    fireEvent.click(field);
    await waitFor(() =>
      expect(screen.getByTestId("facet-dictionary-search-make_ref_select")).toBeTruthy()
    );
    expect(field.getAttribute("aria-expanded")).toBe("true");
  });

  it("opens on ArrowDown and closes on Escape", async () => {
    await mountDictionary("field");
    const field = screen.getByTestId("facet-dictionary-field-make_ref_select");
    fireEvent.keyDown(field, { key: "ArrowDown" });
    await waitFor(() => expect(field.getAttribute("aria-expanded")).toBe("true"));
    fireEvent.keyDown(field, { key: "Escape" });
    await waitFor(() => expect(field.getAttribute("aria-expanded")).toBe("false"));
  });

  it("reads the CHOSEN values rather than a count", async () => {
    render(
      <TestHarness
        server={mockServer({
          "/query": { body: MANY },
          "/suggest": { body: { items: [], backend: "postgres" } },
        })}
        initialSearch="type=listing&f.make_ref_select=toyota"
      >
        <FacetPanelPane categoryFeatures={LIVE_CARS_FEATURES} dictionaryMode="field" />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-dictionary-field-make_ref_select")).toBeTruthy()
    );
    const field = screen.getByTestId("facet-dictionary-field-make_ref_select");
    expect(field.textContent).toContain("Toyota");
    expect(field.getAttribute("data-chosen")).toBe("1");
  });

  it("the phone sheet keeps the list inline — no field to open first", async () => {
    await mountDictionary("inline");
    expect(screen.queryByTestId("facet-dictionary-field-make_ref_select")).toBeNull();
    expect(screen.getByTestId("facet-dictionary-search-make_ref_select")).toBeTruthy();
  });
});

describe("a bounded integer axis is a PICKER, not a bare number", () => {
  it("gives the year from/to selects over its own bounds, newest first", () => {
    const ranges = buildRangeGroups({
      state: parseSearchState(new URLSearchParams("type=listing"), OPTIONS).state,
      categoryFeatures: LIVE_CARS_FEATURES,
      coreRanges: ["price"],
    });
    const year = ranges.find((group) => group.slug === "year");
    // 1900..2027 inclusive.
    expect(year?.picker?.length).toBe(128);
    expect(year?.picker?.[0]).toBe(2027);
    // A mileage is a number people type: 1..1000000 is not a list.
    expect(ranges.find((group) => group.slug === "kilometrage")?.picker).toBeUndefined();
    // Price is core and unbounded: two fields, as before.
    expect(ranges.find((group) => group.slug === "price")?.picker).toBeUndefined();
  });

  it("draws selects for the year and inputs for the price", async () => {
    await mountCarsRail();
    // The price row keeps its two number inputs.
    expect(screen.getByTestId("facet-range-price-from").tagName).toBe("INPUT");
    // The year row is a pair of comboboxes.
    const from = screen.getByTestId("facet-range-year-from");
    expect(from.getAttribute("class") ?? "").toContain("ant-select");
  });

  it("says the bounds when what was typed is outside them", async () => {
    await mountCarsRail();
    const from = screen.getByTestId("facet-range-year-from");
    const input = from.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1899" } });
    await waitFor(() =>
      expect(screen.getByTestId("facet-range-year-from-bounds").textContent).toBe(
        "from 1900 to 2027"
      )
    );
    // A value INSIDE the bounds narrows the list instead and says nothing.
    fireEvent.change(input, { target: { value: "2024" } });
    await waitFor(() =>
      expect(screen.queryByTestId("facet-range-year-from-bounds")).toBeNull()
    );
  });
});

describe("the rail's scrollbar is in the gutter, not on the filters", () => {
  it("emits a thin bar in the token palette", () => {
    expect(railScrollbarCss()).toMatchInlineSnapshot(`
      ".stapel-search-rail::-webkit-scrollbar{inline-size:8px;block-size:8px}
      .stapel-search-rail::-webkit-scrollbar-track{background:transparent}
      .stapel-search-rail::-webkit-scrollbar-thumb{background:var(--stapel-border);border-radius:var(--stapel-radius-full)}
      .stapel-search-rail::-webkit-scrollbar-thumb:hover{background:var(--stapel-text-subtle)}
      .stapel-search-rail{scrollbar-width:thin;scrollbar-gutter:stable;scrollbar-color:var(--stapel-border) transparent}"
    `);
  });

  it("carries no literal colour, so both themes are the host's", () => {
    // Every colour is a custom property: a hard-coded grey glows in the dark
    // theme, and an inline one would freeze whichever theme mounted first.
    expect(railScrollbarCss()).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(railScrollbarCss()).not.toMatch(/rgba?\(/);
    expect(RAIL_CLASS).toBe("stapel-search-rail");
  });
});
