/**
 * D465 / D466 — TWO THINGS THAT MOVE WHEN THE ANSWER LANDS LATE.
 *
 * Both were measured by a desktop walker on a live stand, and both are the same
 * shape of defect: a piece of chrome that is drawn from the ANSWER while the
 * rest of its row or column is still drawn from a HOLD, so it is committed in
 * one place and then relocated when the hold ends.
 *
 * ── D465, the rail's footer bar ───────────────────────────────────────────
 *
 * On 9 of 12 loads the search answer arrives before the category schema. The
 * panel is told the schema is coming (`categoryFeaturesPending`) and holds the
 * whole group list in its loading box — but the footer bar reads the COUNT and
 * the active filters, which come from the answer, so it mounted under that box
 * at `data-facets-schema="pending"` and then travelled down the rail when the
 * groups replaced the box. Schema-first loads drew the rail in one commit and
 * shifted nothing, which is why it read as intermittent: CLS 0.0056 at 1280,
 * 0.0018 at 1920, 0.0076 at 1100.
 *
 * ── D466, the results toolbar ─────────────────────────────────────────────
 *
 * `<Count>` renders NOTHING until the answer lands. In a row spaced by
 * `justify: space-between` that is one item in the first frame and two in the
 * second, so the sort/view control was laid out at the leading edge and then
 * moved to the trailing one as the number arrived: x 328→459 at 1280, 564→863
 * at 1920, 312→796 at 1100 (0.003 / 0.0026 / 0.0095), and the same jump on a
 * seller's page.
 *
 * ── What this file can prove ──────────────────────────────────────────────
 *
 * jsdom lays nothing out: every `getBoundingClientRect` is a zero box, so a
 * test that compared two x values here would compare 0 with 0 and pass on a
 * page that jumped. What it CAN assert is the structure a browser then lays
 * out, and for both defects the structure is the whole mechanism:
 *
 *  - D465: the element is not in the tree during the hold. An element that is
 *    not mounted cannot be moved by the commit that ends the hold.
 *  - D466: the row holds the SAME two items in both frames, and the leading one
 *    is the only one that grows. Two flex items where the trailing one never
 *    grows or shrinks put that item's trailing edge at the row's trailing edge
 *    in every frame — its position is then a function of its own width alone,
 *    which is exactly "does not depend on the count's text width".
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { FacetPanelPane, SearchResultsPane } from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { DESKTOP_WIDTH, TestHarness, mockServer, setViewport } from "./harness.js";

afterEach(cleanup);

/** A search with a filter applied, so the rail has a "clear all" to offer and
 * the footer bar has a reason to exist at all. */
const FILTERED = "type=listing&f.brand=bosch";

describe("D465 — nothing mounts in the hold that the settled rail will move", () => {
  it("draws no footer bar while the schema is still in flight", async () => {
    setViewport(DESKTOP_WIDTH);
    render(
      <TestHarness
        server={mockServer({ "/query": { body: searchResponse() } })}
        initialSearch={FILTERED}
      >
        <FacetPanelPane footerBar categoryFeaturesPending />
      </TestHarness>
    );

    // The answer lands: the rail is on screen and says its shape is not
    // decided yet. This is the frame the walker caught the bar in.
    await waitFor(() => {
      expect(
        screen.getByTestId("search-facets").dataset["facetsSchema"]
      ).toBe("pending");
    });
    expect(screen.queryByTestId("facets-footer-bar")).toBeNull();
    // And the count it would have carried is not on the rail either — it is
    // the bar's own child, not a second element that survives on its own.
    expect(screen.queryByTestId("facets-footer-count")).toBeNull();
  });

  it("draws it once the rail has settled, in the place it keeps", async () => {
    setViewport(DESKTOP_WIDTH);
    render(
      <TestHarness
        server={mockServer({ "/query": { body: searchResponse() } })}
        initialSearch={FILTERED}
      >
        <FacetPanelPane footerBar />
      </TestHarness>
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("search-facets").dataset["facetsSchema"]
      ).toBe("settled");
    });
    await waitFor(() => {
      expect(screen.getByTestId("facets-footer-bar")).toBeTruthy();
    });
    expect(screen.getByTestId("facets-footer-bar").dataset["position"]).toBe(
      "sticky"
    );
  });
});

describe("D466 — the toolbar control does not travel when the count lands", () => {
  /** The two boxes of the wide toolbar row, in document order. */
  function toolbarChildren(): readonly HTMLElement[] {
    return Array.from(
      screen.getByTestId("search-results-toolbar").children
    ) as HTMLElement[];
  }

  it("keeps the same two items before and after the number arrives", async () => {
    setViewport(DESKTOP_WIDTH);
    render(
      <TestHarness
        server={mockServer({ "/query": { body: searchResponse({ count: 25 }) } })}
      >
        <SearchResultsPane toolbar={<button data-testid="sort">sort</button>} />
      </TestHarness>
    );

    // FRAME ONE — the count is unknown, and `<Count>` renders nothing.
    expect(screen.queryByTestId("search-count")).toBeNull();
    const before = toolbarChildren();
    expect(before).toHaveLength(2);
    expect(before[0]?.dataset["testid"]).toBe("search-results-toolbar-lead");
    expect(before[0]?.textContent).toBe("");
    expect(before[1]?.contains(screen.getByTestId("sort"))).toBe(true);

    // FRAME TWO — the answer lands and the number appears INSIDE the leading
    // box that was already holding its place.
    await waitFor(() => {
      expect(screen.getByTestId("search-count")).toBeTruthy();
    });
    const after = toolbarChildren();
    expect(after).toHaveLength(2);
    expect(after[0]?.dataset["testid"]).toBe("search-results-toolbar-lead");
    expect(after[0]?.contains(screen.getByTestId("search-count"))).toBe(true);
    expect(after[1]?.contains(screen.getByTestId("sort"))).toBe(true);
    // The very same elements, not a re-created row: nothing was unmounted and
    // remounted somewhere else between the two frames.
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
  });

  it("lets only the count's half absorb the width", async () => {
    setViewport(DESKTOP_WIDTH);
    render(
      <TestHarness
        server={mockServer({ "/query": { body: searchResponse({ count: 25 }) } })}
      >
        <SearchResultsPane toolbar={<button data-testid="sort">sort</button>} />
      </TestHarness>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-count")).toBeTruthy();
    });

    const [lead, end] = toolbarChildren();
    // The leading box grows into whatever is left; the trailing group neither
    // grows nor shrinks, so its trailing edge is the row's, in every frame and
    // at every count length.
    expect(lead?.style.flex).toBe("1 1 auto");
    expect(lead?.style.minInlineSize).toBe("0");
    expect(end?.style.flex).toBe("0 0 auto");
    // And the row does not space its children apart, which is what made the
    // control's position depend on HOW MANY children there were.
    expect(
      screen.getByTestId("search-results-toolbar").style.justifyContent
    ).toBe("");
  });
});
