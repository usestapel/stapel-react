/**
 * THE WAY INTO THE WHOLE AXIS RIDES WITH THE CAPTION.
 *
 * `<PopularValues>` put its «all of it» link UNDER the columns, at the start
 * edge. On a four-column block of twelve makes that is three rows and a gap
 * below the only words that say what the block is, and two reviewers walking
 * the live storefront missed it. The reference classified puts it immediately
 * after the caption, on the caption's own line — measured off the storefront
 * spec's own comparison frames of a vehicles leaf (2026-09-04).
 *
 * WHAT THIS ASSERTS — where the control IS, in terms a reader would use:
 * before the values rather than after them, and inside the same row as the
 * caption rather than in a row of its own. Document order and containment are
 * the two facts jsdom can actually establish about position.
 *
 * WHAT IT CANNOT SEE — and this is the half that matters most for this fix:
 * jsdom lays no text out, so "the link sits on the caption's baseline", "there
 * are 16px between them" and "it is painted in the brand colour" are browser
 * facts and are NOT tested here. The baseline claim in particular rests on
 * `align="baseline"` on the row, which jsdom parses and never evaluates.
 */
import { afterEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildFacetGroups, parseSearchState } from "../src/index.js";
import type { FacetGroup } from "../src/index.js";
import { PopularValues } from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

afterEach(cleanup);

const MAKES: Readonly<Record<string, number>> = {
  toyota: 802,
  bmw: 611,
  honda: 540,
  kia: 480,
};

function vendorGroup(): FacetGroup {
  const groups = buildFacetGroups({
    facets: { vendor: MAKES },
    meta: {
      approximate: false,
      candidates: 4213,
      counted: ["vendor"],
      skipped: [],
      dropped_filters: [],
      core_ranges: [],
      plan: "category",
      withheld: [],
      categories: [],
    },
    state: parseSearchState(new URLSearchParams("type=listing"), {
      defaultType: "listing",
    }).state,
    facetLabels: { vendor: { label: "Марка", translatable: false, values: {} } },
  });
  const group = groups.find((one) => one.slug === "vendor");
  if (group === undefined) throw new Error("no vendor group");
  return group;
}

function mount(node: ReactElement): void {
  render(
    <TestHarness server={mockServer({ "/query": { body: searchResponse() } })}>
      {node}
    </TestHarness>
  );
}

describe("<PopularValues> — where «all of it» sits", () => {
  it("comes BEFORE the values, not after them", () => {
    mount(
      <PopularValues
        group={vendorGroup()}
        onApply={() => undefined}
        onShowAll={() => undefined}
      />
    );
    const link = screen.getByTestId("popular-all-vendor");
    const columns = screen.getByTestId("popular-columns-vendor");
    expect(
      link.compareDocumentPosition(columns) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeGreaterThan(0);
  });

  it("shares one row with the caption", () => {
    mount(
      <PopularValues
        group={vendorGroup()}
        onApply={() => undefined}
        heading="Популярные марки"
        onShowAll={() => undefined}
      />
    );
    const link = screen.getByTestId("popular-all-vendor");
    const caption = screen.getByText("Популярные марки");
    const columns = screen.getByTestId("popular-columns-vendor");
    const row = link.parentElement;
    expect(row).not.toBeNull();
    // The nearest box holding the link holds the caption…
    expect(row?.contains(caption)).toBe(true);
    // …and NOT the values. Without the second half this assertion passes on
    // the shape it replaced, where caption, columns and link were three
    // children of one column: "shares a parent" is true of any two nodes far
    // enough up the tree, and the fact being claimed is that they share a
    // LINE.
    expect(row?.contains(columns)).toBe(false);
  });

  it("is still the control it was — one press, one call", () => {
    let opened = 0;
    mount(
      <PopularValues
        group={vendorGroup()}
        onApply={() => undefined}
        onShowAll={() => {
          opened += 1;
        }}
      />
    );
    fireEvent.click(screen.getByTestId("popular-all-vendor"));
    expect(opened).toBe(1);
  });

  it("draws no caption row at all when the surface asked for neither", () => {
    // `heading={null}` and no `onShowAll` is the band a host mounts under its
    // own title. It must not gain an empty row, which inside a gapped column
    // is charged a gap on both sides.
    mount(
      <PopularValues group={vendorGroup()} onApply={() => undefined} heading={null} />
    );
    const block = screen.getByTestId("popular-values-vendor");
    // The columns ARE the block's first and only box. (The hoisted focus-ring
    // stylesheet is in the document head, not here — React 19 moves it.)
    expect(block.firstElementChild?.getAttribute("data-testid")).toBe(
      "popular-columns-vendor"
    );
    expect(block.children).toHaveLength(1);
  });
});
