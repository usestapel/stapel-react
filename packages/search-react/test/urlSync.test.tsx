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
        type: state.type,
        q: state.q,
        sort: state.sort ?? null,
        brand: state.filters["brand"] ?? [],
        anchor: state.anchor ?? null,
      })}
    </span>
  );
}

function probe(): {
  type: string;
  q: string;
  sort: string | null;
  brand: string[];
  anchor: string | null;
} {
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
    // `type=listing` no longer rides along: it is `<TestHarness>`'s
    // `defaultType`, so the codec omits it (D343) and the state still reads
    // "listing" back — the round trip, not the raw string, is the guarantee.
    expect(latest.search).not.toContain("type=listing");
    expect(probe().type).toBe("listing");
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
    // One line per parameter the codec dropped, each identified: the half a
    // location (`lat` with no `lon`) and the range that was a word. The names
    // are the reader's — "location", "price" — not the wire's `r.price`,
    // because the sentence is read by whoever followed the link.
    expect(text).toContain("location");
    expect(text).toContain("price");
    expect(text).not.toContain("r.price");
    expect(
      screen.getByTestId("search-url-issues").querySelectorAll("li")
    ).toHaveLength(2);
  });
});

/**
 * P-6 from the live storefront walk: /s printed the results heading twice (the
 * page's toolbar caption above the pane's own heading) and the sort label
 * twice (the control's label and, inside the box, its placeholder) — with no
 * value selected, over results the server had plainly sorted.
 */
describe("one heading, one sort control, and it says what the page is sorted by", () => {
  function Page(props: { search?: string }): ReactElement {
    const adapter = useTestParams(props.search ?? "type=listing");
    return <SearchPage adapter={adapter} defaultType="listing" />;
  }

  it("says each of them exactly once", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestProviders server={server} locale="ru">
        <Page />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
    // Counted as ELEMENTS, not as substrings: the distance sort's blocked
    // reason legitimately starts with the same word as the control's own
    // label in Russian, and a substring count reads that sentence as a second
    // label.
    expect(screen.getAllByText("Результаты", { exact: true })).toHaveLength(1);
    expect(screen.getAllByText("Сортировка", { exact: true })).toHaveLength(1);
  });

  it("shows the sort the SERVER applied when the URL names none", async () => {
    const server = mockServer({
      "/query": { body: searchResponse({ sort: "newest" }) },
    });
    render(
      <TestProviders server={server}>
        <Page />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
    // antd renders the selected option's label in the selector.
    await waitFor(() => {
      expect(
        screen.getByTestId("search-sort").textContent ?? ""
      ).toContain("Newest first");
    });
  });

  it("the URL's own sort wins over the server's", async () => {
    const server = mockServer({
      "/query": { body: searchResponse({ sort: "newest" }) },
    });
    render(
      <TestProviders server={server}>
        <Page search="type=listing&sort=price_asc" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("search-sort").textContent ?? ""
      ).toContain("Price: low to high");
    });
  });

  it("the sort control issues no request of its own", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestProviders server={server}>
        <Page />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
    // One page of results, one query: `useAppliedSort` reads the cache the
    // pane filled (`enabled: false`), it does not search again.
    expect(server.calls.filter((c) => c.url.includes("/query")).length).toBe(1);
  });
});
