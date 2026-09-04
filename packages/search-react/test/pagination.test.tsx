import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FacetPanelPane, SearchResultsPane } from "../src/default/index.js";
import { SearchResults } from "../src/index.js";
import type { SearchResultsBag } from "../src/index.js";
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
    // Page 1: no previous page, and the control SAYS why it is off — as
    // VISIBLE TEXT beside it, not in a `title` no touch device can surface
    // and no disabled button ever fires (the reason lands in the
    // `GatedButton` wrapper and the button points at it with
    // `aria-describedby`).
    const prev = screen.getByTestId("search-prev") as HTMLButtonElement;
    expect(prev.getAttribute("aria-disabled")).toBe("true");
    expect(prev.getAttribute("title")).toBeNull();
    const prevGate = screen.getByTestId("search-prev-gate");
    expect(prevGate.getAttribute("data-stapel-gated")).toBe("blocked");
    expect(prevGate.textContent).toContain("This is the first page");
    const reason = prevGate.querySelector("[data-stapel-gated-reason]");
    expect(prev.getAttribute("aria-describedby")).toBe(reason?.id);

    fireEvent.click(screen.getByTestId("search-next"));
    await waitFor(() => {
      expect(server.lastQuery("/query")?.get("anchor")).toBe("a2");
    });
    expect(server.lastQuery("/query")?.get("direction")).toBe("next");

    await waitFor(() => {
      expect(
        screen.getByTestId("search-prev-gate").getAttribute("data-stapel-gated")
      ).toBe("available");
    });
    fireEvent.click(screen.getByTestId("search-prev"));
    await waitFor(() => {
      expect(server.lastQuery("/query")?.get("anchor")).toBe("a1");
    });
    expect(server.lastQuery("/query")?.get("direction")).toBe("prev");
  });

  it("a blocked pager button takes the tap, keeps the focus, and DISCLOSES its reason", async () => {
    // The consumer-level proof of the substrate's corrected gate: a control
    // the gate has shut is still reached by a thumb and by a keyboard, and
    // the sentence is what it hands back. Before, it was html-`disabled`:
    // the tap landed on nothing and a screen reader never got to it.
    const server = pagedServer();
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
    const prev = screen.getByTestId("search-prev") as HTMLButtonElement;
    const queriesBefore = server.calls.length;

    // Semantically off, physically alive.
    expect(prev.getAttribute("aria-disabled")).toBe("true");
    expect(prev.disabled).toBe(false);

    // Reachable without a pointer, and the sentence is wired to the control
    // that has the focus — this is the whole disclosure, on a keyboard.
    prev.focus();
    expect(document.activeElement).toBe(prev);
    const reason = document.getElementById(prev.getAttribute("aria-describedby") ?? "");
    expect(reason?.textContent).toContain("This is the first page");

    // The gesture ARRIVES — and pages nothing.
    fireEvent.click(prev);
    fireEvent.keyDown(prev, { key: "Enter" });
    expect(server.calls.length).toBe(queriesBefore);
    expect(screen.getByTestId("search-prev-gate").getAttribute("data-stapel-gated")).toBe(
      "blocked"
    );
  });

  it("blocks Next at the last page WITH a reason, never a bare disabled button", async () => {
    const server = mockServer({
      "/query": {
        // The LAST page of several — there is a previous page, so the pager
        // is a control that means something and Next is the half that is off.
        body: searchResponse({
          has_next: false,
          next_anchor: null,
          has_prev: true,
          prev_anchor: "a1",
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
    const next = screen.getByTestId("search-next") as HTMLButtonElement;
    expect(next.getAttribute("aria-disabled")).toBe("true");
    expect(next.getAttribute("title")).toBeNull();
    expect(screen.getByTestId("search-next-gate").textContent).toContain(
      "This is the last page"
    );
  });

  it("draws no pager at all when there is nothing to page", async () => {
    // Two disabled buttons under a single page of results is the fleet's
    // C-DEADPAGER defect: a control that can never do anything is not a
    // control that needs a reason, it is a control that should not be drawn.
    const server = mockServer({
      "/query": {
        body: searchResponse({
          has_next: false,
          next_anchor: null,
          has_prev: false,
          prev_anchor: null,
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
    expect(screen.queryByTestId("search-pager")).toBeNull();
  });

  it("blocks both controls while a page is in flight, and says so", async () => {
    // The bag is where the loading block lives, and it is core's own — not a
    // bespoke string this pair invented. The pane only draws a pager once a
    // page has landed, so this is asserted where it is stated.
    const server = mockServer({ "/query": { body: searchResponse() } });
    let seen: SearchResultsBag | null = null;
    render(
      <TestHarness server={server}>
        <SearchResults>
          {(bag) => {
            seen = bag;
            return null;
          }}
        </SearchResults>
      </TestHarness>
    );
    const bag = seen as SearchResultsBag | null;
    expect(bag?.next.available).toBe(false);
    expect(bag?.next.block?.code).toBe("stapel.action.blocked.loading");
    expect(bag?.prev.block?.code).toBe("stapel.action.blocked.loading");
    await waitFor(() => {
      expect((seen as SearchResultsBag | null)?.state.status).toBe("ready");
    });
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
      expect(
        screen.getByTestId("search-prev-gate").getAttribute("data-stapel-gated")
      ).toBe("available");
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
            // `colour`, not `condition`: this is a checkbox-shaped second
            // axis on purpose, so its testids are the plain per-option
            // `facet-count-*` this test reads — `condition` is now a
            // segmented axis on evidence alone even with no schema (see
            // `looksSingleChoiceByEvidence` in `FacetGroupControl.tsx`).
            facets:
              brand.length === 0
                ? { brand: { bosch: 12, makita: 9 }, colour: { red: 7, blue: 18 } }
                : { brand: { bosch: 12, makita: 9 }, colour: { red: 3, blue: 9 } },
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
    // `brand` keeps its own counts (its filter is removed), `colour`
    // narrows to the candidates that are Bosch.
    await waitFor(() => {
      expect(screen.getByTestId("facet-count-colour-red").textContent).toBe("3");
    });
    expect(screen.getByTestId("facet-count-brand-makita").textContent).toBe("9");
  });
});
