import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SearchResultsPane } from "../src/default/index.js";
import { SEARCH_SORTS } from "../src/index.js";
import { errorBody, searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

describe("three outcomes of the read, and none of them share a branch", () => {
  it("loading → a spinner, not an empty page", async () => {
    const server = mockServer({
      "/query": () => ({ body: searchResponse() }),
    });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    expect(screen.getByTestId("search-loading")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
  });

  it("ready-empty → 'nothing matches', reachable only from a search that ran", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({
          items: [],
          count: 0,
          has_next: false,
          next_anchor: null,
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-empty")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-failed")).toBeNull();
  });

  it("failed → 'we could not run this search' plus a retry, NEVER 'nothing found'", async () => {
    // The 2026-08-09 incident, in one assertion: a 5xx that renders as an
    // empty result set tells the visitor the shop is empty.
    let calls = 0;
    const server = mockServer({
      "/query": () => {
        calls += 1;
        return calls === 1
          ? { status: 503, body: errorBody("error.503.search_backend_unavailable") }
          : { body: searchResponse() };
      },
    });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-failed")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-empty")).toBeNull();

    fireEvent.click(screen.getByText("Try again"));
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
  });
});

describe("the refusals a result page must tell apart", () => {
  it("renders the window refusal as 'narrow the search', not as an empty page", async () => {
    const server = mockServer({
      "/query": {
        status: 400,
        body: errorBody("error.400.search_window_exceeded", { window: 1000 }),
      },
    });
    render(
      <TestHarness server={server} initialSearch="type=listing&anchor=deep">
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-window-exceeded")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-empty")).toBeNull();
    expect(screen.getByTestId("search-window-exceeded").textContent).toContain(
      "Narrow the search"
    );
  });
});

describe("the count is never stated more precisely than the server can", () => {
  it("says 'N+' when the server calls the count a lower bound", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({
          count: 1200,
          count_is_lower_bound: true,
          exact_total: false,
          degraded: ["exact_total"],
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-count").textContent).toBe("1200+ results");
    });
    expect(
      screen.getByTestId("search-count").getAttribute("data-count-kind")
    ).toBe("at_least");
  });

  it("says 'N' when it is exact", async () => {
    const server = mockServer({
      "/query": { body: searchResponse({ exact_total: true, count: 25 }) },
    });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-count").textContent).toBe("25 results");
    });
  });

  it("prints NO count line when the server cannot say", async () => {
    // `count: null` is "we do not know", and the state before it — `0` — was
    // printed over visible cards as "About 0 listings". No number is the only
    // honest rendering of an unknown total.
    const server = mockServer({
      "/query": {
        body: searchResponse({
          count: null,
          count_is_lower_bound: false,
          exact_total: false,
          degraded: ["exact_total"],
        }),
      },
    });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-count")).toBeNull();
  });

  it("treats a bare exact_total: false as a floor, never as a total", async () => {
    // Defensive: a server that predates `count_is_lower_bound` still says
    // "this is not exact", and "at least N" is the reading the page cannot
    // contradict.
    const server = mockServer({
      "/query": {
        body: searchResponse({ count: 42, exact_total: false }),
      },
    });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-count").textContent).toBe("42+ results");
    });
  });
});

describe("promoted (DSA Art. 26) is present under EVERY sort", () => {
  for (const sort of SEARCH_SORTS) {
    it(`marks the promoted row under sort=${sort}`, async () => {
      const server = mockServer({
        "/query": { body: searchResponse({ sort }) },
      });
      render(
        <TestHarness
          server={server}
          initialSearch={`type=listing&sort=${sort}&lat=55&lon=37`}
        >
          <SearchResultsPane />
        </TestHarness>
      );
      await waitFor(() => {
        expect(screen.getByTestId("search-results")).toBeTruthy();
      });
      // Exactly the rows the envelope marks, and only those.
      const cards = screen.getAllByTestId("search-result-card");
      expect(cards.map((c) => c.getAttribute("data-promoted"))).toEqual([
        "true",
        "false",
      ]);
      expect(screen.getAllByTestId("search-result-promoted")).toHaveLength(1);
    });
  }

  it("hands the whole item to a custom card, so a replacement can still mark it", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <SearchResultsPane
          renderCard={(item) => (
            <div data-testid="host-card" data-promoted={String(item.promoted)}>
              {item.key}
            </div>
          )}
        />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("host-card")).toHaveLength(2);
    });
    expect(
      screen.getAllByTestId("host-card").map((c) => c.getAttribute("data-promoted"))
    ).toEqual(["true", "false"]);
    // The generic card stepped aside entirely.
    expect(screen.queryByTestId("search-result-card")).toBeNull();
  });
});

/**
 * P-4 from the live storefront walk: the rows were a `<Flex vertical>`, so a
 * 1400px catalogue drew two full-bleed cards and a lot of white.
 */
describe("the results are a grid, and a container can bring its own", () => {
  it("lays the cards out in an auto-fill grid with a card-width floor", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    const grid = await screen.findByTestId("search-results-grid");
    expect(grid.style.display).toBe("grid");
    // As many columns as fit, each at least a readable card: the whole point
    // is that the column count is the container's width, not a breakpoint.
    expect(grid.style.gridTemplateColumns).toContain("auto-fill");
    expect(grid.style.gridTemplateColumns).toContain("280px");
    expect(grid.childElementCount).toBe(2);
  });

  it("renders one cell per row, through `renderCard` when given", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <SearchResultsPane
          renderCard={(item) => <div data-testid="own-card">{item.key}</div>}
        />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("own-card")).toHaveLength(2);
    });
    expect(screen.getByTestId("search-results-grid").childElementCount).toBe(2);
  });

  it("`renderResults` replaces the layout entirely — grid and all", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <SearchResultsPane
          renderResults={(items) => (
            <table data-testid="own-layout">
              <tbody>
                {items.map((item) => (
                  <tr key={item.key}>
                    <td>{item.key}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        />
      </TestHarness>
    );
    const own = await screen.findByTestId("own-layout");
    expect(own.querySelectorAll("tr")).toHaveLength(2);
    expect(screen.queryByTestId("search-results-grid")).toBeNull();
  });

  it("the slot does not take over the load arms: an empty page is still the pane's sentence", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({ items: [], count: 0, has_next: false, next_anchor: null }),
      },
    });
    render(
      <TestHarness server={server}>
        <SearchResultsPane renderResults={() => <div data-testid="own-layout" />} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-empty")).toBeTruthy();
    });
    expect(screen.queryByTestId("own-layout")).toBeNull();
  });
});
