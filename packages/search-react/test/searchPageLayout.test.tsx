/**
 * `<SearchPage>`'s layout is a decision about THIS deployment's search, not a
 * constant — and two of its constants were defects on the live storefront.
 *
 *  - The filter column was always laid out. On a fleet whose search plan
 *    declares no facets, that is a quarter of `/s`, of every category page and
 *    of every seller page spent on an illustration saying "no filters for this
 *    search" — three screens with a hole in them.
 *  - The results heading was always the word "Results". Every surface that
 *    means something else wrote its own caption above the pane and got
 *    "Results" printed underneath it a moment later.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { SearchPage } from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import { TestProviders, mockServer, useTestParams } from "./harness.js";

function Page(props: {
  readonly heading?: string;
  readonly filtersHeader?: ReactElement;
  readonly initial?: string;
}): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams(props.initial ?? "type=listing");
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      {...(props.heading !== undefined ? { resultsHeading: props.heading } : {})}
      {...(props.filtersHeader !== undefined
        ? { filtersHeader: props.filtersHeader }
        : {})}
    />
  );
}

function serverWith(facets: Record<string, Record<string, number>>, counted: string[]) {
  return mockServer({
    "/query": {
      body: searchResponse({
        facets,
        facet_meta: { approximate: false, candidates: 2, counted, skipped: [] },
      }),
    },
  });
}

describe("the filter column is laid out only when there is something in it", () => {
  it("keeps the column when the plan HAS facets", async () => {
    render(
      <TestProviders server={serverWith({ brand: { bosch: 12 } }, ["brand"])}>
        <Page />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-page").getAttribute("data-filters")).toBe("on");
    });
    expect(screen.getByTestId("search-facets")).toBeTruthy();
  });

  it("gives the results the whole width when the plan has NO facets", async () => {
    render(
      <TestProviders server={serverWith({}, [])}>
        <Page />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-page").getAttribute("data-filters")).toBe("off");
    });
    // And the empty-state illustration is gone with it — saying "no filters"
    // once is honest, reserving a column to say it on every screen is a hole.
    expect(screen.queryByTestId("facets-empty")).toBeNull();
    expect(screen.queryByTestId("search-facets")).toBeNull();
    // The results themselves are untouched.
    expect(screen.getByTestId("search-results-heading")).toBeTruthy();
  });

  it("keeps the column for a host control even when there are no facets", async () => {
    render(
      <TestProviders server={serverWith({}, [])}>
        <Page
          filtersHeader={<div data-testid="host-geo">near me</div>}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("host-geo")).toBeTruthy();
    });
    expect(screen.getByTestId("search-page").getAttribute("data-filters")).toBe("on");
    // The host's filter stands alone: one empty-state illustration under a
    // working control is still a hole, just a smaller one.
    expect(screen.queryByTestId("facets-empty")).toBeNull();
  });

  it("holds the column open while the facets are still loading", () => {
    // A panel that has not answered is not a panel with nothing in it, and a
    // layout that reflowed under a person mid-load is worse than the hole.
    const slow = mockServer({
      "/query": () => ({ body: searchResponse() }),
    });
    render(
      <TestProviders server={slow}>
        <Page />
      </TestProviders>
    );
    expect(screen.getByTestId("search-page").getAttribute("data-filters")).toBe("on");
  });
});

describe("the results heading names the list this surface is showing", () => {
  it("defaults to the pair's own word", async () => {
    render(
      <TestProviders server={serverWith({}, [])}>
        <Page />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results-heading").textContent).toBe("Results");
    });
  });

  it("takes the surface's own word — in the row that already exists, not above it", async () => {
    render(
      <TestProviders server={serverWith({}, [])}>
        <Page heading="Свежие объявления" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results-heading").textContent).toBe(
        "Свежие объявления"
      );
    });
    // Exactly one heading for one list — the whole point.
    expect(screen.getAllByTestId("search-results-heading")).toHaveLength(1);
  });
});

/**
 * The phone filter path — the only filter path a phone HAS, and until this
 * release the one nothing outside a live browser had ever entered: the sheet
 * opens on a tap, so every static render and every screenshot stopped at the
 * closed button.
 */
describe("the filter sheet is a state the page can open in", () => {
  function SheetPage(props: { readonly open?: boolean }): ReactElement {
    const adapter: SearchParamsAdapter = useTestParams(
      "type=listing&f.brand=bosch"
    );
    return (
      <SearchPage
        adapter={adapter}
        defaultType="listing"
        filtersLayout="sheet"
        {...(props.open === true ? { defaultFiltersOpen: true } : {})}
      />
    );
  }

  it("keeps the sheet shut by default", async () => {
    render(
      <TestProviders server={serverWith({ brand: { bosch: 12 } }, ["brand"])}>
        <SheetPage />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-filters-open")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-filters-sheet")).toBeNull();
  });

  it("opens it on defaultFiltersOpen, with the facets inside", async () => {
    render(
      <TestProviders server={serverWith({ brand: { bosch: 12 } }, ["brand"])}>
        <SheetPage open />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-filters-sheet")).toBeTruthy();
    });
    expect(screen.getByTestId("search-facets")).toBeTruthy();
  });

  it("commits by saying how many results the choices lead to", async () => {
    render(
      <TestProviders server={serverWith({ brand: { bosch: 12 } }, ["brand"])}>
        <SheetPage open />
      </TestProviders>
    );
    // The fixture answers an EXACT count of 25. A bare "Show results" is a
    // button that asks a person to commit without saying to what.
    await waitFor(() => {
      expect(screen.getByTestId("search-filters-apply").textContent).toBe(
        "Show 25 results"
      );
    });
  });

  it("counts nothing on the opener until something is applied", async () => {
    function Unfiltered(): ReactElement {
      const adapter: SearchParamsAdapter = useTestParams("type=listing");
      return (
        <SearchPage adapter={adapter} defaultType="listing" filtersLayout="sheet" />
      );
    }
    render(
      <TestProviders server={serverWith({ brand: { bosch: 12 } }, ["brand"])}>
        <Unfiltered />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-filters-open").textContent).toBe("Filters");
    });
  });
});
