/**
 * THE RAIL FINDS A VALUE; IT DOES NOT OPEN A DROPDOWN FIRST.
 *
 * The desktop rail drew every dictionary axis as a select-shaped field
 * reading "Any" with a chevron, which had to be pressed before anything
 * could be typed.
 * The reference classified puts no press there: its make axis is a box
 * captioned "enter a name" with the popular values listed under it, open from
 * the first frame (founder's read of the live site, 2026-09-13).
 *
 * WHAT THIS ASSERTS: what is on screen for a person who has just arrived at a
 * category page and pressed nothing — a box they can type into and values
 * they can press — and that the combobox trigger is not there to be pressed.
 * Mounted through `<SearchPage>` and not through `<FacetGroupControl>`,
 * because the DEFAULT is what changed and the page is what picks it: a test
 * passing `dictionaryMode` itself would prove nothing about what a storefront
 * that passes none now gets.
 *
 * WHAT IT CANNOT SEE: jsdom evaluates no container query and lays no text
 * out, so this is not evidence about how the open list FITS a 280px rail —
 * the fold that keeps it to `visibleOptions` rows is asserted here by row
 * COUNT, and how tall those rows are is a browser fact.
 *
 * The phone is not this test's subject: below the sheet breakpoint the page
 * still defaults to `"sheet"`, and `facetDictionarySheet.test.tsx` owns it.
 */
import { afterEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { FeatureDef } from "@stapel/attributes-react";
import { SearchPage } from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import {
  DESKTOP_WIDTH,
  PHONE_WIDTH,
  TestProviders,
  mockServer,
  setViewport,
  useTestParams,
} from "./harness.js";

afterEach(() => {
  cleanup();
  setViewport(DESKTOP_WIDTH);
});

const VENDOR: FeatureDef = {
  slug: "vendor",
  name: "Марка",
  config: {
    type: "ref_select",
    optionsRef: { level: "Vendor", vocabulary: "cars" },
  },
};

const VENDOR_COUNTS: Readonly<Record<string, number>> = {
  toyota: 802,
  bmw: 611,
  honda: 540,
  kia: 480,
  mazda: 430,
  nissan: 390,
  audi: 350,
  ford: 300,
  skoda: 40,
  lada: 30,
};

function server(): ReturnType<typeof mockServer> {
  return mockServer({
    "/query": {
      body: searchResponse({
        facets: { vendor: VENDOR_COUNTS },
        facet_meta: {
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
        facet_labels: {
          vendor: { label: "Марка", translatable: false, values: {} },
        },
      }),
    },
  });
}

function Page(): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage adapter={adapter} defaultType="listing" categoryFeatures={[VENDOR]} />
  );
}

function mount(): void {
  render(
    <TestProviders server={server()}>
      <Page />
    </TestProviders>
  );
}

describe("the desktop rail's dictionary axis", () => {
  it("offers the box and the values with nothing pressed", async () => {
    setViewport(DESKTOP_WIDTH);
    mount();
    // The box a person types a make into is ON SCREEN, not behind a press.
    await waitFor(() => {
      expect(screen.getByTestId("facet-dictionary-search-vendor")).toBeTruthy();
    });
    // …and so are the values, with their counts.
    expect(screen.queryAllByTestId(/^facet-option-vendor-/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("facet-option-vendor-toyota")).toBeTruthy();
  });

  it("has no select-shaped trigger to press", async () => {
    setViewport(DESKTOP_WIDTH);
    mount();
    await waitFor(() => {
      expect(screen.getByTestId("facet-dictionary-search-vendor")).toBeTruthy();
    });
    expect(screen.queryByTestId("facet-dictionary-field-vendor")).toBeNull();
    // The SHAPE, not just this pair's own test id: nothing inside the axis's
    // own box announces itself as a combobox any more. Scoped to the group —
    // the sort and the page size beside it are antd Selects and are meant to
    // be.
    const axis = screen.getByTestId("facet-group-vendor");
    expect(axis.querySelectorAll('[role="combobox"]')).toHaveLength(0);
  });

  it("still folds the tail behind one control, so the rail is not the whole page", async () => {
    setViewport(DESKTOP_WIDTH);
    mount();
    await waitFor(() => {
      expect(screen.getByTestId("facet-dictionary-search-vendor")).toBeTruthy();
    });
    // Ten buckets, eight drawn — the inline body's own fold, which is the
    // answer to the objection the closed field was introduced for.
    expect(screen.queryAllByTestId(/^facet-option-vendor-/)).toHaveLength(8);
    expect(screen.getByTestId("facet-more-vendor")).toBeTruthy();
  });

  it("leaves the PHONE on its picker sheet", async () => {
    setViewport(PHONE_WIDTH);
    mount();
    await waitFor(() => {
      expect(screen.getByTestId("search-filter-chips")).toBeTruthy();
    });
    // Nothing of the rail's inline body is mounted on a phone: the filters
    // live behind the sheet there, and the dictionary keeps the picker the
    // composer uses for the same vocabulary.
    expect(screen.queryByTestId("facet-dictionary-search-vendor")).toBeNull();
  });
});
