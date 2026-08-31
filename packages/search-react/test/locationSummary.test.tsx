/**
 * `<LocationSummaryLine>` and the `resultsHeader` slot it goes into.
 *
 * The claims worth nailing down, each of which a rewrite could lose without
 * failing anything else:
 *
 *  1. it never prints a coordinate — the same negative assertion `geo.test.tsx`
 *     makes about the panel and the chip row, now that a THIRD surface holds
 *     `state.geo`;
 *  2. with no location applied it says so, rather than rendering an empty
 *     half-row that reads as a bug;
 *  3. the radius comes off the URL and is stated in words;
 *  4. the filters affordance carries the SAME `activeFilters` the chip row's
 *     dot reads — one counter, not two;
 *  5. both ends are real controls: the left opens the shared location sheet,
 *     the right calls the surface's own `onOpenAll`;
 *  6. `<SearchPage>`'s new `resultsHeader` renders ABOVE the chips on a phone
 *     and above the columns on a desktop, and nothing at all when unfilled.
 */
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocationSummaryLine, SearchPage } from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import {
  DESKTOP_WIDTH,
  PHONE_WIDTH,
  TestHarness,
  TestProviders,
  mockServer,
  setViewport,
  useTestParams,
} from "./harness.js";

/** A shared link that already means a place, with a radius on it. */
const PLACED = "type=listing&lat=52.52&lon=13.405&radius_km=200";
/** The same place, narrowed by three more constraints (geo counts as one, so
 * `activeFilters` is four). */
const NARROWED = `${PLACED}&f.brand=bosch&f.condition=used&r.power=500..1500`;

afterEach(() => {
  cleanup();
  setViewport(DESKTOP_WIDTH);
});

function server(): ReturnType<typeof mockServer> {
  return mockServer({ "/query": { body: searchResponse() } });
}

function mount(
  search: string,
  props: Partial<Parameters<typeof LocationSummaryLine>[0]> = {}
): void {
  render(
    <TestHarness server={server()} initialSearch={search}>
      <LocationSummaryLine onOpenAll={() => undefined} {...props} />
    </TestHarness>
  );
}

describe("<LocationSummaryLine> — where, in words", () => {
  it("says the search is looking everywhere when nothing is applied", () => {
    mount("type=listing");
    const row = screen.getByTestId("search-location-summary");
    expect(row.getAttribute("data-geo")).toBe("off");
    expect(screen.getByTestId("search-location-open").textContent).toContain(
      "Searching everywhere"
    );
    expect(screen.queryByTestId("search-location-radius")).toBeNull();
  });

  it("prints the host's name for the place and the radius off the URL", () => {
    mount(PLACED, { geoLabel: "Berlin Mitte" });
    const open = screen.getByTestId("search-location-open");
    expect(open.textContent).toContain("Berlin Mitte");
    expect(screen.getByTestId("search-location-radius").textContent).toContain(
      "Within 200 km"
    );
  });

  it("admits it does not know the name rather than printing the point", () => {
    mount(PLACED);
    expect(screen.getByTestId("search-location-open").textContent).toContain(
      "A chosen place on the map"
    );
  });

  it("lets no digit of the coordinate reach the page", () => {
    mount(PLACED, { geoLabel: "Berlin Mitte" });
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("52.52");
    expect(text).not.toContain("13.405");
  });
});

describe("<LocationSummaryLine> — the filters end", () => {
  it("counts the applied constraints, geo included", () => {
    mount(NARROWED);
    const filters = screen.getByTestId("search-location-filters");
    expect(filters.getAttribute("data-active")).toBe("true");
    // brand + condition + power range + geo.
    expect(
      screen.getByTestId("search-location-filters-badge").textContent
    ).toContain("4");
  });

  it("carries no count when nothing is applied", () => {
    mount("type=listing");
    expect(
      screen.getByTestId("search-location-filters").getAttribute("data-active")
    ).toBe("false");
  });

  it("hands the tap to the surface that owns the panel", () => {
    const onOpenAll = vi.fn();
    render(
      <TestHarness server={server()} initialSearch="type=listing">
        <LocationSummaryLine onOpenAll={onOpenAll} />
      </TestHarness>
    );
    fireEvent.click(screen.getByTestId("search-location-filters"));
    expect(onOpenAll).toHaveBeenCalledOnce();
  });
});

describe("<LocationSummaryLine> — it opens the same sheet the geo chip opens", () => {
  it("opens the location sheet, with the slot named when unfilled", async () => {
    mount(PLACED, { geoLabel: "Berlin Mitte" });
    expect(screen.queryByTestId("search-location-sheet")).toBeNull();
    fireEvent.click(screen.getByTestId("search-location-open"));
    await waitFor(() => {
      expect(screen.getByTestId("search-location-sheet")).toBeTruthy();
    });
    // The slot is NAMED rather than left as a blank sheet — and the sheet is
    // still useful without it, because a location the URL carries can be
    // cleared with no geocoder involved.
    expect(screen.getByTestId("search-location-slot")).toBeTruthy();
    expect(screen.getByTestId("search-location-clear")).toBeTruthy();
    expect(
      screen.getByTestId("search-location-sheet-summary").textContent
    ).toBe("Berlin Mitte");
  });

  it("renders the host's control in the sheet when there is one", async () => {
    mount(PLACED, {
      renderGeoFilter: () => <div data-testid="host-geo">map</div>,
    });
    fireEvent.click(screen.getByTestId("search-location-open"));
    await waitFor(() => {
      expect(screen.getByTestId("host-geo")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-location-slot")).toBeNull();
  });
});

describe("<SearchPage resultsHeader>", () => {
  function Page(props: {
    readonly header?: ReactElement;
    readonly search?: string;
  }): ReactElement {
    const adapter: SearchParamsAdapter = useTestParams(
      props.search ?? "type=listing"
    );
    return (
      <SearchPage
        adapter={adapter}
        defaultType="listing"
        {...(props.header !== undefined ? { resultsHeader: props.header } : {})}
      />
    );
  }

  it("renders nothing at all when the container fills nothing", () => {
    render(
      <TestProviders server={server()}>
        <Page />
      </TestProviders>
    );
    expect(screen.queryByTestId("search-results-header")).toBeNull();
  });

  it("puts the header ABOVE the chip row on a phone", async () => {
    setViewport(PHONE_WIDTH);
    render(
      <TestProviders server={server()}>
        <Page header={<span data-testid="host-header">where</span>} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-filter-chips")).toBeTruthy();
    });
    const header = screen.getByTestId("search-results-header");
    const chips = screen.getByTestId("search-filter-chips");
    expect(
      header.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeGreaterThan(0);
    expect(screen.getByTestId("host-header")).toBeTruthy();
  });

  it("puts it above the two columns on a desktop", async () => {
    setViewport(DESKTOP_WIDTH);
    render(
      <TestProviders server={server()}>
        <Page header={<span data-testid="host-header">where</span>} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
    const header = screen.getByTestId("search-results-header");
    const results = screen.getByTestId("search-results");
    expect(
      header.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeGreaterThan(0);
  });
});
