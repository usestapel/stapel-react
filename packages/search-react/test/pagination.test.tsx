import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FacetPanelPane, SearchResultsPane } from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

describe("keyset paging, forwards and back", () => {
  function pagedServer() {
    return mockServer({
      "/query": (call) => {
        const anchor = new URL(call.url).searchParams.get("anchor");
        if (anchor === null) {
          return {
            body: searchResponse({
              next_anchor: "a2",
              prev_anchor: null,
              has_next: true,
              has_prev: false,
            }),
          };
        }
        if (anchor === "a2") {
          return {
            body: searchResponse({
              next_anchor: "a3",
              prev_anchor: "a1",
              has_next: true,
              has_prev: true,
            }),
          };
        }
        return {
          body: searchResponse({
            next_anchor: null,
            prev_anchor: "a2",
            has_next: false,
            has_prev: true,
          }),
        };
      },
    });
  }

  it("carries the cursor forward and back, and asks with direction", async () => {
    const server = pagedServer();
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
    // Page 1: no previous page, and the control SAYS why it is off.
    const prev = screen.getByTestId("search-prev") as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(prev.getAttribute("title")).toBe("This is the first page");

    fireEvent.click(screen.getByTestId("search-next"));
    await waitFor(() => {
      expect(server.lastQuery("/query")?.get("anchor")).toBe("a2");
    });
    expect(server.lastQuery("/query")?.get("direction")).toBe("next");

    await waitFor(() => {
      expect((screen.getByTestId("search-prev") as HTMLButtonElement).disabled).toBe(
        false
      );
    });
    fireEvent.click(screen.getByTestId("search-prev"));
    await waitFor(() => {
      expect(server.lastQuery("/query")?.get("anchor")).toBe("a1");
    });
    expect(server.lastQuery("/query")?.get("direction")).toBe("prev");
  });

  it("blocks Next at the last page WITH a reason, never a bare disabled button", async () => {
    const server = mockServer({
      "/query": {
        body: searchResponse({ has_next: false, next_anchor: null }),
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
    const next = screen.getByTestId("search-next") as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(next.getAttribute("title")).toBe("This is the last page");
  });

  it("blocks both controls while the first page is still loading, and says so", () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    const next = screen.getByTestId("search-next") as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    // Core's own loading block, resolved to its sentence — a reason, not a
    // bare disabled control and not a bespoke string this pair invented.
    expect(next.getAttribute("title")).toBe("Still loading. One moment.");
  });

  it("walking back to page one clears the cursor rather than inventing one", async () => {
    const server = mockServer({
      "/query": (call) => {
        const anchor = new URL(call.url).searchParams.get("anchor");
        return {
          body: searchResponse({
            has_prev: anchor !== null,
            // The server sends no prev_anchor when the previous page IS the
            // first one — the cursor's absence is what "page 1" means.
            prev_anchor: null,
            has_next: true,
            next_anchor: "a2",
          }),
        };
      },
    });
    render(
      <TestHarness server={server} initialSearch="type=listing&anchor=a2&direction=next">
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect((screen.getByTestId("search-prev") as HTMLButtonElement).disabled).toBe(
        false
      );
    });
    fireEvent.click(screen.getByTestId("search-prev"));
    await waitFor(() => {
      expect(server.lastQuery("/query")?.has("anchor")).toBe(false);
    });
    expect(server.lastQuery("/query")?.get("direction")).toBe("prev");
  });
});

describe("the previous answer stays on screen while the next is in flight", () => {
  it("keeps the sibling counts visible across a facet click", async () => {
    // Drill-down is only VISIBLE if the numbers change rather than blink out.
    const server = mockServer({
      "/query": (call) => {
        const brand = new URL(call.url).searchParams.getAll("f.brand");
        return {
          body: searchResponse({
            facets:
              brand.length === 0
                ? { brand: { bosch: 12, makita: 9 }, condition: { new: 7, used: 18 } }
                : { brand: { bosch: 12, makita: 9 }, condition: { new: 3, used: 9 } },
          }),
        };
      },
    });
    render(
      <TestHarness server={server}>
        <FacetPanelPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("facet-count-brand-makita").textContent).toBe("9");
    });

    fireEvent.click(screen.getByTestId("facet-option-brand-bosch"));
    // Still there DURING the refetch — never a spinner in place of the panel.
    expect(screen.getByTestId("facet-count-brand-makita").textContent).toBe("9");
    expect(screen.queryByTestId("facets-loading")).toBeNull();

    // And when the new answer lands, the sibling count is the drill-down one:
    // `brand` keeps its own counts (its filter is removed), `condition`
    // narrows to the candidates that are Bosch.
    await waitFor(() => {
      expect(screen.getByTestId("facet-count-condition-new").textContent).toBe("3");
    });
    expect(screen.getByTestId("facet-count-brand-makita").textContent).toBe("9");
  });
});
