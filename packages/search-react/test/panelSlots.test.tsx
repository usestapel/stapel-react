/**
 * Four decisions a SURFACE makes and this pair used to make for it.
 *
 *  - **The "Category" pane.** On a catalogue leaf the category IS the page —
 *    the reader walked a tree of tiles to get here — and the panel printed
 *    `Category: 32/149/163` with a "clear" button under it, which is machine
 *    state shown to a shopper and a control that throws away the page they
 *    chose. `categoryFilter={false}` removes the pane, the placeholder and
 *    that raw-id fallback together.
 *  - **The top of the results column.** `resultsHeader` spans both columns, so
 *    anything a surface wanted over the LIST — a category's introduction, a
 *    promoted band — went over the filter rail too. `resultsLead` is inside
 *    the column, above the toolbar.
 *  - **How wide a popular-values block is.** One number for every surface, on
 *    a block whose width is the results column's rather than the window's.
 *  - **A blocked sort option's reason.** It was on the row in the compact arm
 *    and behind the open dropdown at every other width.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { PopularValues, SearchPage, SortSelect } from "../src/default/index.js";
import { popularValuesLadderCss } from "../src/default/index.js";
import type { FacetGroup, SearchParamsAdapter } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import {
  TestHarness,
  TestProviders,
  mockServer,
  useTestParams,
} from "./harness.js";

function serverWithFacets(): ReturnType<typeof mockServer> {
  return mockServer({
    "/query": {
      body: searchResponse({
        facets: { brand: { bosch: 12 } },
        facet_meta: {
          approximate: false,
          candidates: 25,
          counted: ["brand"],
          skipped: [],
          dropped_filters: [],
          core_ranges: [],
          plan: "category",
          withheld: [],
          categories: [],
        },
      }),
    },
  });
}

function Page(props: {
  readonly initial?: string;
  readonly categoryFilter?: boolean;
  readonly resultsLead?: ReactElement;
}): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams(
    props.initial ?? "type=listing"
  );
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      {...(props.categoryFilter !== undefined
        ? { categoryFilter: props.categoryFilter }
        : {})}
      {...(props.resultsLead !== undefined
        ? { resultsLead: props.resultsLead }
        : {})}
    />
  );
}

// --------------------------------------------------------------------------
// the category pane
// --------------------------------------------------------------------------

describe("<SearchPage categoryFilter={false}>", () => {
  it("prints the id path when the pane is left ON — the shape this exists to remove", async () => {
    render(
      <TestProviders server={serverWithFacets()}>
        <Page initial="type=listing&category=32/149/163" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-category")).toBeTruthy();
    });
  });

  it("removes the pane ENTIRELY — no cascade, no placeholder, no raw-id line", async () => {
    render(
      <TestProviders server={serverWithFacets()}>
        <Page initial="type=listing&category=32/149/163" categoryFilter={false} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-facets")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-category")).toBeNull();
    expect(screen.queryByTestId("search-category-slot")).toBeNull();
    expect(screen.queryByTestId("search-category-clear")).toBeNull();
    // The id path itself, which is what a shopper actually saw.
    expect(screen.queryByText(/32\/149\/163/)).toBeNull();
  });
});

// --------------------------------------------------------------------------
// the results lead
// --------------------------------------------------------------------------

describe("<SearchPage resultsLead>", () => {
  it("renders inside the results column, above the toolbar", async () => {
    render(
      <TestProviders server={serverWithFacets()}>
        <Page resultsLead={<p>Про эту категорию</p>} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results-lead")).toBeTruthy();
    });
    const lead = screen.getByTestId("search-results-lead");
    const sort = screen.getByTestId("search-sort");
    // `compareDocumentPosition` rather than a query over a wrapper: what is
    // being asserted is the ORDER inside the column, and the column's own box
    // is an implementation detail of the pane.
    expect(
      lead.compareDocumentPosition(sort) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // …and NOT over the filter rail, which is what `resultsHeader` would do.
    expect(screen.queryByTestId("search-results-header")).toBeNull();
  });

  it("reserves nothing when the surface has nothing to say", async () => {
    render(
      <TestProviders server={serverWithFacets()}>
        <Page />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeTruthy();
    });
    expect(screen.queryByTestId("search-results-lead")).toBeNull();
  });
});

// --------------------------------------------------------------------------
// the popular-values ladder
// --------------------------------------------------------------------------

const MAKES: FacetGroup = {
  slug: "make",
  label: "Марка",
  labelSource: "server",
  feature: undefined,
  counted: true,
  selected: [],
  options: [
    { value: "toyota", count: 802, label: "Toyota", labelSource: "server", selected: false },
    { value: "ford", count: 512, label: "Ford", labelSource: "server", selected: false },
  ],
};

describe("<PopularValues columns=\"responsive\">", () => {
  it("keeps the numeric form — a host that decided its layout keeps the decision", () => {
    render(
      <TestHarness server={serverWithFacets()}>
        <PopularValues group={MAKES} columns={2} onApply={() => undefined} />
      </TestHarness>
    );
    const block = screen.getByTestId("popular-values-make");
    expect(block.getAttribute("data-columns")).toBe("2");
    expect(block.className).not.toContain("stapel-popular-values");
  });

  it("climbs a 1/2/3/4 ladder by the width of the BLOCK, not of the window", () => {
    render(
      <TestHarness server={serverWithFacets()}>
        <PopularValues group={MAKES} columns="responsive" onApply={() => undefined} />
      </TestHarness>
    );
    const block = screen.getByTestId("popular-values-make");
    expect(block.getAttribute("data-columns")).toBe("responsive");
    expect(block.className).toContain("stapel-popular-values");

    const css = popularValuesLadderCss();
    // The container is what decides: this block sits in the results column,
    // which on a 1440px desktop is the window minus a 280px rail. A media
    // query would give it four columns at a width it never has.
    expect(css).toContain("container-type:inline-size");
    expect(css).toContain("column-count:1");
    for (const columns of [2, 3, 4]) {
      expect(css).toContain(`column-count:${String(columns)}`);
    }
    // Ascending, so the widest matching rung wins by ordinary cascade order.
    const rungs = [...css.matchAll(/min-width: (\d+)px/g)].map((m) =>
      Number(m[1])
    );
    expect(rungs).toEqual([...rungs].sort((a, b) => a - b));
    // …and no inline `column-count`, which would beat every rung.
    expect(
      (block.querySelector("[data-popular-columns]") as HTMLElement | null)?.style
        .columnCount
    ).toBeFalsy();
  });
});

// --------------------------------------------------------------------------
// the blocked sort option
// --------------------------------------------------------------------------

/** The shipped caption for `sort=distance` (`search.sort.distance`). */
const NEAREST = "Nearest first";

describe("<SortSelect> annotates a blocked option at every width", () => {
  async function distanceRow(compact: boolean): Promise<string> {
    render(
      <TestHarness server={serverWithFacets()}>
        <SortSelect {...(compact ? { compact: true } : {})} />
      </TestHarness>
    );
    // antd opens its list on mousedown over the selector.
    const selector = screen
      .getByTestId("search-sort")
      .querySelector(".ant-select-content");
    expect(selector).toBeTruthy();
    fireEvent.mouseDown(selector as Element);
    let row = "";
    await waitFor(() => {
      const texts = [
        ...document.querySelectorAll(".ant-select-item-option-content"),
      ].map((node) => node.textContent ?? "");
      const found = texts.find((text) => text.startsWith(NEAREST));
      expect(found).toBeTruthy();
      row = found ?? "";
    });
    return row;
  }

  it("names the reason ON the row in the full-width form", async () => {
    // Without a centre the server answers `error.400.search_sort_needs_center`
    // — so the row that would earn it says so, where a thumb and a screen
    // reader both meet it. It used to be a line under the closed control,
    // which the open dropdown covers.
    const row = await distanceRow(false);
    expect(row).toContain("—");
    expect(row.length).toBeGreaterThan(NEAREST.length);
  });

  it("names it on the row in the compact form too", async () => {
    const row = await distanceRow(true);
    expect(row).toContain("—");
  });
});
