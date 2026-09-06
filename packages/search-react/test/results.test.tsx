import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { breakpoints } from "@stapel/tokens";
import {
  RESULTS_AUTO_FILL_COLUMNS,
  RESULTS_COLUMNS_CLASS,
  SearchResultsPane,
  resultsColumnsCss,
} from "../src/default/index.js";
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
    // The floor is 260px — lowered from 280 deliberately: at a 1400px content
    // measure the grid draws five columns instead of three wide ones, and the
    // default card still fits its title, price and location at 260.
    expect(grid.style.gridTemplateColumns).toContain("auto-fill");
    expect(grid.style.gridTemplateColumns).toContain("260px");
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

describe("<SearchResultsPane columns> — the host's own column count", () => {
  /**
   * `auto-fill, minmax(260px, 1fr)` is the right answer for a storefront that
   * wants as many readable cards as fit and no breakpoint table. It is the
   * wrong one for a deployment whose cards are taller or wider than the
   * default's, and such a host had exactly one way to say so: an `!important`
   * rule on this grid from outside, against a declaration it could not read
   * back.
   */
  it("draws exactly N tracks for a number, and says so on the markup", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <SearchResultsPane columns={2} />
      </TestHarness>
    );
    const grid = await screen.findByTestId("search-results-grid");
    expect(grid.getAttribute("data-columns")).toBe("2");
    expect(grid.className).toContain(RESULTS_COLUMNS_CLASS);
    // `minmax(0, 1fr)` rather than `1fr`: a bare `1fr` is `minmax(auto, 1fr)`,
    // so one long unbroken title widens the whole row.
    expect(resultsColumnsCss(2)).toContain("repeat(2, minmax(0, 1fr))");
    // What the NODE carries is what a browser resolves. The emitted sheet was
    // green in this suite for a release while the prop did nothing on a stand,
    // because the grid still carried the auto-fill default inline and an
    // inline declaration beats a stylesheet at any specificity.
    expect(grid.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
    expect(grid.style.gridTemplateColumns).not.toContain("auto-fill");
    expect(
      window.getComputedStyle(grid).getPropertyValue("grid-template-columns")
    ).toContain("repeat(2");
  });

  it("climbs the token breakpoints for a map — measured on the BLOCK", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <SearchResultsPane columns={{ phone: 1, tablet: 2, desktop: 4 }} />
      </TestHarness>
    );
    const grid = await screen.findByTestId("search-results-grid");
    expect(grid.getAttribute("data-columns")).toBe("responsive");

    const css = resultsColumnsCss({ phone: 1, tablet: 2, desktop: 4 });
    // The grid is its own container: the results column is the window minus a
    // 280px rail, so a media query would hand it a desktop count at a width it
    // never has.
    expect(css).toContain("container-type:inline-size");
    expect(css).toContain(
      `@container (min-width: ${String(breakpoints.tablet)}px)`
    );
    expect(css).toContain(
      `@container (min-width: ${String(breakpoints.desktop)}px)`
    );
    // Ascending, so the widest matching rung wins by ordinary cascade order.
    expect(css.indexOf("min-width: 768px")).toBeLessThan(
      css.indexOf("min-width: 1200px")
    );
    // A rung left out inherits the one below it, rather than emitting a rule
    // that says nothing.
    expect(resultsColumnsCss({ tablet: 3 })).not.toContain("min-width: 1200px");
    // …and the rung below the lowest one is the auto-fill default, now that
    // the pane writes nothing inline for a map: it has to be in the sheet, or
    // a `{ tablet: 2 }` map would leave the grid with no track declaration at
    // all below 768px.
    expect(resultsColumnsCss({ tablet: 3 })).toContain(
      RESULTS_AUTO_FILL_COLUMNS
    );
    expect(css).not.toContain("auto-fill");
  });

  it("writes NO inline track declaration for a map, so its sheet is the one in play", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <SearchResultsPane columns={{ phone: 1, tablet: 2 }} />
      </TestHarness>
    );
    const grid = await screen.findByTestId("search-results-grid");
    // The defect, read off the rendered node: the map's rules are hung on this
    // node's class, and an inline `grid-template-columns` on the same node
    // wins over all of them. The stand set exactly this map and measured pure
    // auto-fill — two columns at 759px, one at 448, three at 1199.
    expect(grid.style.gridTemplateColumns).toBe("");
    expect(grid.getAttribute("style") ?? "").not.toContain("auto-fill");
    // Everything else about the grid still comes from the node.
    expect(grid.style.display).toBe("grid");
    expect(grid.style.alignItems).toBe("stretch");
  });

  it("says nothing at all when the host has no opinion", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <SearchResultsPane />
      </TestHarness>
    );
    const grid = await screen.findByTestId("search-results-grid");
    expect(grid.hasAttribute("data-columns")).toBe(false);
    expect(grid.className).not.toContain(RESULTS_COLUMNS_CLASS);
    expect(grid.style.gridTemplateColumns).toContain("auto-fill");
  });

  it("is ignored by the list arrangement, which IS one column", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <SearchResultsPane layout="list" columns={3} />
      </TestHarness>
    );
    const grid = await screen.findByTestId("search-results-grid");
    expect(grid.getAttribute("data-layout")).toBe("list");
    expect(grid.hasAttribute("data-columns")).toBe(false);
    expect(grid.style.gridTemplateColumns).toBe("1fr");
  });
});

describe("the compact header's caption (phone)", () => {
  /**
   * The compact arm hid the heading unconditionally. For the pair's own word
   * that is right — "Results" over a list of results, on a screen whose fold
   * holds four things, says nothing the person did not just do, and it stays
   * in the document for a screen reader. A caption the HOST supplied is the
   * page's own name, passed with `headingLevel={1}` because on a results
   * screen it IS the page's heading — and the phone clipped it into a 4×4
   * pixel box.
   */
  it("keeps the pair's own word off the glass and in the document", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <SearchResultsPane header="compact" />
      </TestHarness>
    );
    const heading = await screen.findByTestId("search-results-heading");
    expect(heading.getAttribute("data-heading")).toBe("hidden");
    // Clipped, not removed: `visuallyHidden` is a 1px box, and the heading is
    // still a heading in the accessibility tree.
    expect(heading.style.position).toBe("absolute");
    expect(screen.getByRole("heading", { level: 4 })).toBeTruthy();
  });

  it("DRAWS a caption the host supplied", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <SearchResultsPane
          header="compact"
          headingLevel={1}
          heading="Buy a car in Sochi"
        />
      </TestHarness>
    );
    const heading = await screen.findByTestId("search-results-heading");
    expect(heading.getAttribute("data-heading")).toBe("seen");
    expect(heading.textContent).toBe("Buy a car in Sochi");
    expect(heading.style.position).not.toBe("absolute");
    expect(heading.style.margin).toBe("0px");
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });

  it("takes the host's explicit answer either way", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    const { rerender } = render(
      <TestHarness server={server}>
        <SearchResultsPane header="compact" heading="Sochi" headingVisible={false} />
      </TestHarness>
    );
    expect(
      (await screen.findByTestId("search-results-heading")).getAttribute(
        "data-heading"
      )
    ).toBe("hidden");
    rerender(
      <TestHarness server={server}>
        <SearchResultsPane header="compact" headingVisible />
      </TestHarness>
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("search-results-heading").getAttribute("data-heading")
      ).toBe("seen")
    );
  });

  it("changes nothing in the banner arm, where the caption was never hidden", async () => {
    const server = mockServer({ "/query": { body: searchResponse() } });
    render(
      <TestHarness server={server}>
        <SearchResultsPane heading="Buy a car in Sochi" />
      </TestHarness>
    );
    const heading = await screen.findByTestId("search-results-heading");
    expect(heading.style.position).not.toBe("absolute");
    expect(heading.hasAttribute("data-heading")).toBe(false);
  });
});
