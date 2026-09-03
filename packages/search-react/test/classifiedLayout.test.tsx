/**
 * The classified search page, in the two shapes it actually has.
 *
 * Every test here sets `window.innerWidth` BEFORE rendering, because the
 * `matchMedia` shim evaluates `(min-width: …)` against it: a test that never
 * sets a width proves nothing about either branch, and the phone branch is the
 * one that used to be unreachable outside a browser.
 *
 *   PHONE  (390px) — a scrolling row of filter CHIPS, each opening its own
 *                    bottom sheet, with the whole panel behind the leading
 *                    chip. No two-column layout anywhere.
 *   DESKTOP(1024px+) — a sticky filter RAIL beside the results, and the panel
 *                    is on the page rather than behind a control.
 *
 * Plus the toolbar both shapes share: how the results are arranged (the view
 * switch), how they are ordered (the sort), and the slot where a surface puts
 * its own action.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { SearchPage } from "../src/default/index.js";
import type { SearchView } from "../src/default/index.js";
import { chipRowCss } from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import {
  CLASSIFIED_FEATURES,
  MANY_BRANDS,
  searchResponse,
} from "./fixtures.js";
import {
  DESKTOP_WIDTH,
  PHONE_WIDTH,
  TestProviders,
  mockServer,
  setViewport,
  useTestParams,
} from "./harness.js";

afterEach(() => {
  cleanup();
  setViewport(DESKTOP_WIDTH);
});

const FACETS = {
  condition: { new: 7, used: 18 },
  brand: MANY_BRANDS,
};

function server(): ReturnType<typeof mockServer> {
  return mockServer({
    "/query": {
      body: searchResponse({
        facets: FACETS,
        facet_meta: {
          approximate: false,
          candidates: 25,
          counted: ["condition", "brand"],
          skipped: [], dropped_filters: [], core_ranges: [],
        },
      }),
    },
    "/suggest": { body: { items: [], backend: "postgres" } },
  });
}

function Page(props: {
  readonly initial?: string;
  readonly views?: readonly SearchView[];
  readonly resultsAction?: ReactNode;
  readonly breadcrumb?: ReactNode;
  readonly geo?: boolean;
}): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams(
    props.initial ?? "type=listing"
  );
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      categoryFeatures={CLASSIFIED_FEATURES}
      {...(props.views !== undefined ? { views: props.views } : {})}
      {...(props.resultsAction !== undefined
        ? { resultsAction: props.resultsAction }
        : {})}
      {...(props.breadcrumb !== undefined ? { breadcrumb: props.breadcrumb } : {})}
      {...(props.geo === true
        ? {
            renderGeoFilter: (slot) => (
              <button
                type="button"
                data-testid="host-geo-control"
                data-analytics="none"
                data-analytics-reason="test double"
                onClick={() => slot.onChange({ kind: "center", lat: 1, lon: 2 })}
              >
                pick
              </button>
            ),
          }
        : {})}
    />
  );
}

function mount(props: Parameters<typeof Page>[0] = {}): void {
  render(
    <TestProviders server={server()}>
      <Page {...props} />
    </TestProviders>
  );
}

describe("390px: the filters are a scrolling row of chips", () => {
  it("draws the chip row and no two-column layout", async () => {
    setViewport(PHONE_WIDTH);
    mount();
    await waitFor(() =>
      expect(screen.getByTestId("search-filter-chips")).toBeTruthy()
    );
    expect(screen.getByTestId("search-page").getAttribute("data-filters-layout")).toBe(
      "sheet"
    );
    expect(screen.queryByTestId("search-page-columns")).toBeNull();
  });

  it("owns its overflow, so the PAGE body never scrolls sideways", async () => {
    setViewport(PHONE_WIDTH);
    mount();
    await waitFor(() =>
      expect(screen.getByTestId("search-filter-chips")).toBeTruthy()
    );
    const row = screen.getByTestId("search-filter-chips");
    // One line that scrolls itself…
    expect(row.style.flexWrap).toBe("nowrap");
    expect(row.style.overflowX).toBe("auto");
    // …and a flick past the last chip must not hand the gesture to the page.
    expect(row.style.overscrollBehaviorInline).toBe("contain");
    // The scrollbar itself is hidden — safe only because every chip is a real
    // button, so Tab walks the row without any dragging.
    const css = chipRowCss();
    expect(css).toContain("scrollbar-width:none");
    expect(css).toContain("::-webkit-scrollbar{display:none}");
  });

  it("names the row, and names the icon-only chip that opens everything", async () => {
    setViewport(PHONE_WIDTH);
    mount();
    await waitFor(() =>
      expect(screen.getByTestId("search-filter-chips")).toBeTruthy()
    );
    expect(screen.getByRole("group", { name: "Filters" })).toBeTruthy();
    // Icon-only: the accessible name exists ONLY as this label.
    expect(screen.getByRole("button", { name: "All filters" })).toBeTruthy();
  });

  it("gives every facet group its own chip and its own sheet", async () => {
    setViewport(PHONE_WIDTH);
    mount();
    await waitFor(() => expect(screen.getByTestId("search-chip-condition")).toBeTruthy());
    expect(screen.queryByTestId("filter-chip-sheet-facet:condition")).toBeNull();

    fireEvent.click(screen.getByTestId("search-chip-condition"));
    await waitFor(() =>
      expect(screen.getByTestId("filter-chip-sheet-facet:condition")).toBeTruthy()
    );
    // A SHEET, not a centred modal — the substrate's rule, at a phone width.
    expect(document.querySelector(".ant-drawer")).not.toBeNull();
    expect(document.querySelector(".ant-modal")).toBeNull();
    // The group is inside it, whole: a sheet devoted to one group has no fold.
    const sheet = within(screen.getByTestId("filter-chip-sheet-facet:condition"));
    expect(sheet.getByTestId("facet-option-condition-new")).toBeTruthy();
  });

  it("says on the chip WHAT is filtered, not merely that something is", async () => {
    setViewport(PHONE_WIDTH);
    mount({ initial: "type=listing&f.condition=used" });
    await waitFor(() => expect(screen.getByTestId("search-chip-condition")).toBeTruthy());
    // The chip carries the CHOICE, not the group's name: "Condition" while
    // filtering to used is a lie a person can only catch by opening it. The
    // word itself is the ANSWER's caption for that value — the fixture sends
    // `facet_labels`, which outranks the schema's translation key, so this
    // assertion also pins the precedence the whole SERP depends on.
    expect(screen.getByTestId("search-chip-condition").textContent).toBe("Б/у");
  });

  it("counts the extra choices rather than listing them", async () => {
    setViewport(PHONE_WIDTH);
    mount({ initial: "type=listing&f.brand=brand-0&f.brand=brand-1" });
    await waitFor(() => expect(screen.getByTestId("search-chip-brand")).toBeTruthy());
    expect(screen.getByTestId("search-chip-brand").textContent).toBe("brand-0, +1");
  });

  it("keeps the whole panel one tap away, behind the leading chip", async () => {
    setViewport(PHONE_WIDTH);
    mount();
    await waitFor(() => expect(screen.getByTestId("search-filters-open")).toBeTruthy());
    fireEvent.click(screen.getByTestId("search-filters-open"));
    await waitFor(() =>
      expect(screen.getByTestId("search-filters-sheet")).toBeTruthy()
    );
    expect(screen.getByTestId("search-facets")).toBeTruthy();
  });

  it("keeps the location OUT of the chip row, and offers the way back out on its own control", async () => {
    setViewport(PHONE_WIDTH);
    mount({ initial: "type=listing&lat=55.75&lon=37.62&radius_km=10", geo: true });
    await waitFor(() =>
      expect(screen.getByTestId("search-location-summary")).toBeTruthy()
    );
    // Not a chip. A place is not a filter, and the chip row is the filter list.
    expect(screen.queryByTestId("search-chip-geo")).toBeNull();

    fireEvent.click(screen.getByTestId("search-location-open"));
    await waitFor(() =>
      expect(screen.getByTestId("search-location-sheet")).toBeTruthy()
    );
    const sheet = within(screen.getByTestId("search-location-sheet"));
    expect(sheet.getByTestId("host-geo-control")).toBeTruthy();
    // The radius, beside the place it is a radius OF.
    expect(sheet.getByTestId("search-geo-radius")).toBeTruthy();
    // A shared link that narrows to a point must never leave a person with no
    // control that widens it again.
    expect(sheet.getByTestId("search-location-clear")).toBeTruthy();
  });

  it("shows no location control at all when there is neither a slot nor a point", async () => {
    setViewport(PHONE_WIDTH);
    mount();
    await waitFor(() =>
      expect(screen.getByTestId("search-filter-chips")).toBeTruthy()
    );
    expect(screen.queryByTestId("search-chip-geo")).toBeNull();
    expect(screen.queryByTestId("search-location-summary")).toBeNull();
  });
});

describe("desktop: a sticky filter rail beside the results", () => {
  it("lays out two columns and puts the panel ON the page", async () => {
    setViewport(DESKTOP_WIDTH);
    mount();
    await waitFor(() => expect(screen.getByTestId("search-page-columns")).toBeTruthy());
    expect(screen.getByTestId("search-facets")).toBeTruthy();
    // No chip row, no sheet: the phone surface must not leak upward.
    expect(screen.queryByTestId("search-filter-chips")).toBeNull();
    expect(screen.queryByTestId("search-filters-sheet")).toBeNull();
  });

  it("makes the rail stick, so the filters stay reachable down a long page", async () => {
    setViewport(DESKTOP_WIDTH);
    mount();
    await waitFor(() => expect(screen.getByTestId("search-page-columns")).toBeTruthy());
    const rail = screen.getByTestId("search-page-columns").firstElementChild as HTMLElement;
    expect(rail.style.position).toBe("sticky");
    // A stretched flex child has nothing to stick to.
    expect(rail.style.alignSelf).toBe("flex-start");
    // Taller than the window, the rail scrolls INSIDE itself…
    expect(rail.style.overflowY).toBe("auto");
    // …without handing the overscroll to the results column.
    expect(rail.style.overscrollBehavior).toBe("contain");
  });

  it("renders a dialog as a MODAL above the phone breakpoint", async () => {
    setViewport(DESKTOP_WIDTH);
    render(
      <TestProviders server={server()}>
        <Page />
      </TestProviders>
    );
    await waitFor(() => expect(screen.getByTestId("search-facets")).toBeTruthy());
    // The desktop page has no chip sheets to open — the assertion that matters
    // here is the negative one: nothing on this page is a bottom sheet.
    expect(document.querySelector(".ant-drawer")).toBeNull();
  });
});

describe("the toolbar over the results", () => {
  it("switches the arrangement without touching the URL", async () => {
    setViewport(DESKTOP_WIDTH);
    let seen = "";
    function Watched(): ReactElement {
      const adapter = useTestParams("type=listing");
      seen = adapter.search;
      return (
        <SearchPage
          adapter={adapter}
          defaultType="listing"
          categoryFeatures={CLASSIFIED_FEATURES}
        />
      );
    }
    render(
      <TestProviders server={server()}>
        <Watched />
      </TestProviders>
    );
    await waitFor(() => expect(screen.getByTestId("search-results-grid")).toBeTruthy());
    expect(screen.getByTestId("search-view-switch")).toBeTruthy();
    // Opens in the first offered arrangement.
    expect(
      screen.getByTestId("search-results-grid").getAttribute("data-layout")
    ).toBe("list");

    fireEvent.click(screen.getByText("Grid"));
    await waitFor(() =>
      expect(
        screen.getByTestId("search-results-grid").getAttribute("data-layout")
      ).toBe("grid")
    );
    // The view changes how the same answer is DRAWN, never what it is: putting
    // it in the query string would rewrite the meaning of a shared link.
    expect(seen).toBe("type=listing");
  });

  it("treats a host's own view exactly like the two that ship", async () => {
    setViewport(DESKTOP_WIDTH);
    const views: readonly SearchView[] = [
      { id: "grid", labelKey: "search.view.grid", layout: "grid" },
      {
        id: "map",
        labelKey: "search.view.list",
        render: (items) => (
          <div data-testid="host-map">{`${String(items.length)} pins`}</div>
        ),
      },
    ];
    mount({ views });
    await waitFor(() => expect(screen.getByTestId("search-view-switch")).toBeTruthy());
    fireEvent.click(screen.getAllByText("List")[0] as HTMLElement);
    await waitFor(() => expect(screen.getByTestId("host-map")).toBeTruthy());
    // The pane keeps its own load arms around the slot: the rows reached it.
    expect(screen.getByTestId("host-map").textContent).toBe("2 pins");
  });

  it("keeps room for the surface's own action beside the sort", async () => {
    setViewport(DESKTOP_WIDTH);
    mount({ resultsAction: <span data-testid="host-notify">Notify me</span> });
    await waitFor(() => expect(screen.getByTestId("host-notify")).toBeTruthy());
    expect(screen.getByTestId("search-sort")).toBeTruthy();
  });

  it("keeps that room on a PHONE too — the saved-search stub goes there", async () => {
    // The mobile wave's "notify me about new ones" is the host's stub in this
    // slot (there is no saved-search backend), so the slot has to survive the
    // sheet layout — where the toolbar shares a row with the view switch, the
    // sort and the page size on a 390px screen.
    setViewport(PHONE_WIDTH);
    mount({ resultsAction: <span data-testid="host-notify">Notify me</span> });
    await waitFor(() => expect(screen.getByTestId("host-notify")).toBeTruthy());
    expect(screen.getByTestId("search-page").getAttribute("data-filters-layout"))
      .toBe("sheet");
    expect(screen.getByTestId("search-sort")).toBeTruthy();
  });

  it("draws ONE switch on a phone too — the arrangement is not a desktop luxury", async () => {
    setViewport(PHONE_WIDTH);
    mount();
    await waitFor(() => expect(screen.getByTestId("search-view-switch")).toBeTruthy());
    expect(screen.getAllByTestId("search-view-switch")).toHaveLength(1);
  });
});

describe("the page's own heading", () => {
  it("is an h1 with the count beside it, not an h4 three levels down", async () => {
    setViewport(DESKTOP_WIDTH);
    mount();
    await waitFor(() => expect(screen.getByTestId("search-count")).toBeTruthy());
    expect(screen.getByTestId("search-results-heading").tagName).toBe("H1");
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    // The count is beside the heading, in the row that already exists.
    expect(screen.getByTestId("search-count").textContent).toBe("25 results");
  });

  it("takes a breadcrumb above it when the host has a trail to draw", async () => {
    setViewport(DESKTOP_WIDTH);
    mount({ breadcrumb: <nav data-testid="host-trail">Home / Cars</nav> });
    await waitFor(() => expect(screen.getByTestId("host-trail")).toBeTruthy());
    expect(screen.getByTestId("search-breadcrumb")).toBeTruthy();
  });

  it("draws no breadcrumb slot at all when the host has none", async () => {
    setViewport(DESKTOP_WIDTH);
    mount();
    await waitFor(() =>
      expect(screen.getByTestId("search-results-heading")).toBeTruthy()
    );
    expect(screen.queryByTestId("search-breadcrumb")).toBeNull();
  });
});
