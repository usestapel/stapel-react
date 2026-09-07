/**
 * THE COMPACT SORT CONTROL GREW BY 115px WHEN THE ANSWER LANDED.
 *
 * `<SortSelect compact>` draws `value={active ?? null}`, and for an address
 * that names no `sort` the applied one is only known once the page in cache
 * reports it — a whole round trip after the first paint. So the control
 * painted as a bare caret and then grew by the width of its label: measured
 * on a category leaf, the caret's own box moved from x=22 to x=137, the
 * largest single term in that page's layout shift. The floor was written
 * `minWidth: 0` INLINE, so no consumer stylesheet could hold the box either.
 *
 * The control now reserves the width of the longest label it can be asked to
 * show, measured by the browser at the font it will show it in — an
 * `aria-hidden` sizer stacked with the select in one grid cell. jsdom does no
 * layout, so what these tests assert is the mechanism the width comes out of:
 * the element that sizes the cell, and the fact that neither it nor its
 * content depends on the answer.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SortSelect, longestSortLabel } from "../src/default/index.js";
import { SearchResults } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

/** The shipped English labels, longest first (`search.sort.*`). */
const LONGEST = "Price: low to high";
/** What the server sorted the fixture's page by (`search.sort.relevance`). */
const APPLIED = "Most relevant";

function mount(): void {
  render(
    <TestHarness server={mockServer({ "/query": { body: searchResponse() } })}>
      {/* The applied sort is read off the page in cache, so something has to
          put a page there — `useAppliedSort` never issues a request itself. */}
      <SearchResults>{() => <SortSelect compact />}</SearchResults>
    </TestHarness>
  );
}

describe("the compact sort control's box", () => {
  it("is held by a sizer that does not depend on the answer", async () => {
    mount();

    // FRAME ONE: the answer has not landed, so the control has no label yet —
    // this is the frame the 115px came out of.
    const sizer = screen.getByTestId("search-sort-sizer");
    expect(screen.getByTestId("search-sort").textContent).not.toContain(APPLIED);
    expect(sizer.textContent).toBe(LONGEST);
    expect(sizer.getAttribute("aria-hidden")).toBe("true");
    // Scaffolding, not content: it takes width and no height.
    expect(sizer.style.visibility).toBe("hidden");
    expect(sizer.style.blockSize).toBe("0");

    // THE ANSWER LANDS and the control finally says what the page is ordered
    // by — the moment it used to grow in.
    await waitFor(() => {
      expect(screen.getByTestId("search-sort").textContent).toContain(APPLIED);
    });

    // The box is the same box: the same node, holding the same label.
    expect(screen.getByTestId("search-sort-sizer")).toBe(sizer);
    expect(sizer.textContent).toBe(LONGEST);
  });

  it("stacks the sizer and the select in one cell, so the cell is the label's", () => {
    mount();
    const sizer = screen.getByTestId("search-sort-sizer");
    const select = screen.getByTestId("search-sort");
    expect(sizer.style.gridArea).toBe("1 / 1");
    expect(select.style.gridArea).toBe("1 / 1");
    // The select is what fills the cell; it must not be what sizes it — that
    // is the whole defect, since its content arrives late.
    expect(select.style.minWidth).toBe("0");
    // The desktop arm's 200px floor is NOT the compact arm's answer: a control
    // that refuses to be narrower than 200px wraps a two-control toolbar onto
    // two rows at 390px.
    expect(select.style.minWidth).not.toBe("200px");
    expect(sizer.parentElement).toBe(select.parentElement);
    expect(screen.getByTestId("search-sort-compact")).toBe(select.parentElement);
  });

  it("measures the longest label, ties keeping the first", () => {
    expect(longestSortLabel(["ab", "abcd", "abc"])).toBe("abcd");
    expect(longestSortLabel(["abcd", "efgh"])).toBe("abcd");
    expect(longestSortLabel([])).toBe("");
  });
});
