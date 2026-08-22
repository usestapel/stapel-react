import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FacetPanelPane, SearchPage, SearchResultsPane } from "../src/default/index.js";
import { useSearchState } from "../src/index.js";
import type { ReactElement } from "react";
import { FEATURES, searchResponse } from "./fixtures.js";
import { TestHarness, TestProviders, mockServer, useTestParams } from "./harness.js";

/** Renders the live URL the provider has written, so a test can read it. */
function UrlProbe(): ReactElement {
  const { state } = useSearchState();
  return (
    <span data-testid="probe">
      {JSON.stringify({
        q: state.q,
        sort: state.sort ?? null,
        brand: state.filters["brand"] ?? [],
        anchor: state.anchor ?? null,
      })}
    </span>
  );
}

function probe(): { q: string; sort: string | null; brand: string[]; anchor: string | null } {
  return JSON.parse(screen.getByTestId("probe").textContent ?? "{}");
}

describe("the URL is the state, in both directions (spec §4.2)", () => {
  it("a facet click lands in the query string, and the next request carries it", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    let latest: { search: string; history: readonly string[] } = {
      search: "",
      history: [],
    };
    render(
      <TestHarness
        server={server}
        onAdapter={(a) => {
          latest = a;
        }}
      >
        <UrlProbe />
        <FacetPanelPane categoryFeatures={FEATURES} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facet-option-brand-makita")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("facet-option-brand-makita"));
    await waitFor(() => {
      expect(probe().brand).toEqual(["makita"]);
    });
    expect(latest.search).toContain("f.brand=makita");

    // A repeated key, not a comma-joined value — that is the OR the backend
    // reads with `getlist`.
    fireEvent.click(screen.getByTestId("facet-option-brand-bosch"));
    await waitFor(() => {
      expect(probe().brand).toEqual(["makita", "bosch"]);
    });
    await waitFor(() => {
      expect(server.lastQuery("/query")?.getAll("f.brand")).toEqual([
        "makita",
        "bosch",
      ]);
    });
  });

  it("a filter change PUSHES, so Back removes exactly the last filter", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    let latest: { search: string; history: readonly string[] } = {
      search: "",
      history: [],
    };
    render(
      <TestHarness
        server={server}
        onAdapter={(a) => {
          latest = a;
        }}
      >
        <UrlProbe />
        <FacetPanelPane categoryFeatures={FEATURES} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facet-option-brand-bosch")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("facet-option-brand-bosch"));
    await waitFor(() => {
      expect(probe().brand).toEqual(["bosch"]);
    });
    fireEvent.click(screen.getByTestId("facet-option-condition-new"));
    await waitFor(() => {
      expect(latest.search).toContain("f.condition=new");
    });

    // Three entries: the initial one plus one per filter. The previous entry
    // is the search WITHOUT the last filter — which is what Back restores.
    expect(latest.history).toHaveLength(3);
    const previous = new URLSearchParams(latest.history[1]);
    expect(previous.has("f.condition")).toBe(false);
    expect(previous.getAll("f.brand")).toEqual(["bosch"]);
  });

  it("a shared link reproduces the same request in a fresh mount", async () => {
    const link =
      "type=listing&q=drill&f.brand=bosch&f.brand=makita&r.price=100..500&lat=55.75&lon=37.62&radius_km=25&sort=price_asc";
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server} initialSearch={link}>
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
    const sent = server.lastQuery("/query");
    expect(sent?.get("q")).toBe("drill");
    expect(sent?.getAll("f.brand")).toEqual(["bosch", "makita"]);
    expect(sent?.get("r.price")).toBe("100..500");
    expect(sent?.get("lat")).toBe("55.75");
    expect(sent?.get("radius_km")).toBe("25");
    expect(sent?.get("sort")).toBe("price_asc");
  });

  it("changing a filter drops the cursor, so page 4 of the old search cannot leak", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness
        server={server}
        initialSearch="type=listing&f.brand=bosch&anchor=deep&direction=next"
      >
        <UrlProbe />
        <FacetPanelPane categoryFeatures={FEATURES} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facet-option-brand-makita")).toBeTruthy();
    });
    expect(probe().anchor).toBe("deep");

    fireEvent.click(screen.getByTestId("facet-option-brand-makita"));
    await waitFor(() => {
      expect(probe().anchor).toBeNull();
    });
    await waitFor(() => {
      expect(server.lastQuery("/query")?.has("anchor")).toBe(false);
    });
  });

  it("clear-all empties the constraints and the URL together", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    let latest: { search: string; history: readonly string[] } = {
      search: "",
      history: [],
    };
    render(
      <TestHarness
        server={server}
        initialSearch="type=listing&f.brand=bosch&r.price=1..2"
        onAdapter={(a) => {
          latest = a;
        }}
      >
        <UrlProbe />
        <FacetPanelPane categoryFeatures={FEATURES} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facets-clear-all")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("facets-clear-all"));
    await waitFor(() => {
      expect(probe().brand).toEqual([]);
    });
    expect(latest.search).not.toContain("f.brand");
    expect(latest.search).not.toContain("r.price");
    expect(latest.search).toContain("type=listing");
  });
});

describe("a link whose parameters cannot be read says so", () => {
  it("<SearchPage> names the unreadable parameters instead of widening the search", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    function Page(): ReactElement {
      const adapter = useTestParams("type=listing&lat=55.75&r.price=cheap");
      return <SearchPage adapter={adapter} defaultType="listing" />;
    }
    render(
      <TestProviders server={server}>
        <Page />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-url-issues")).toBeTruthy();
    });
    const text = screen.getByTestId("search-url-issues").textContent ?? "";
    expect(text).toContain("lat and lon");
    expect(text).toContain("r.price");
  });
});
