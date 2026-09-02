/**
 * THE DESKTOP FILTER RAIL IS AN INSTRUMENT, NOT A WALL.
 *
 * Measured on a live classified deployment's cars leaf at 1440×900: the 280px
 * rail carried **5717px of content** — 40 facet groups, 118 checkboxes and 66
 * fields as one flat column inside an INVISIBLE independent inner scroll. The
 * tail was physically unreachable (the walker never got there), and the
 * engineering phrase "not counted" printed 100+ times down the default view.
 *
 * The redesign this suite pins, part by part:
 *
 *  1. groups are DISCLOSURES, and which ones open is decided by evidence:
 *     anything chosen is open, then the top five counted groups by the sum of
 *     their options' counts — the answer's own statement of which axes this
 *     corpus is narrowed by (the same reasoning the chip row already sorts
 *     by). Everything else starts collapsed, in the rail AND in the sheet —
 *     a six-screen sheet is the same disease at a different width.
 *  2. from six groups up, a search box narrows the PANEL — presentation only,
 *     never the URL.
 *  3. the rail's inner scroll is VISIBLE, and a sticky footer inside it says
 *     what the filters did (the live count) and offers the way out (clear
 *     all). Desktop filters apply instantly; the bar is feedback, not an
 *     apply button — so the phone sheet, which HAS an apply footer, gets none.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { FacetPanelPane, SearchPage } from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import {
  DESKTOP_WIDTH,
  PHONE_WIDTH,
  TestHarness,
  TestProviders,
  mockServer,
  setViewport,
  useTestParams,
} from "./harness.js";

afterEach(() => {
  cleanup();
  setViewport(DESKTOP_WIDTH);
});

/**
 * Eight groups — a slice of the measured forty, with coverage stating its own
 * ranking: the sums descend from `price_band` (80) to `drive` (5), and
 * `steering` was skipped, so its options carry no counts at all.
 */
const WIDE_FACETS = {
  price_band: { low: 50, high: 30 },
  brand: { bosch: 40, makita: 20 },
  condition: { new: 30, used: 10 },
  colour: { red: 25 },
  fuel: { petrol: 20 },
  body: { sedan: 15 },
  drive: { awd: 5 },
} as const;

function wideServer(): ReturnType<typeof mockServer> {
  return mockServer({
    "/query": {
      body: searchResponse({
        facets: WIDE_FACETS,
        facet_meta: {
          approximate: false,
          candidates: 80,
          counted: Object.keys(WIDE_FACETS),
          skipped: ["steering"],
          dropped_filters: [],
          core_ranges: [],
        },
      }),
    },
    "/suggest": { body: { items: [], backend: "postgres" } },
  });
}

async function mountWidePanel(initial = "type=listing"): Promise<void> {
  render(
    <TestHarness server={wideServer()} initialSearch={initial}>
      <FacetPanelPane />
    </TestHarness>
  );
  await waitFor(() =>
    expect(screen.getByTestId("facet-group-price_band")).toBeTruthy()
  );
}

describe("which groups open is decided by the answer's own evidence", () => {
  it("opens the top five counted groups by coverage and collapses the rest", async () => {
    await mountWidePanel();
    // The five with the evidence: their options are on the page.
    for (const [slug, value] of [
      ["price_band", "low"],
      ["brand", "bosch"],
      ["condition", "new"],
      ["colour", "red"],
      ["fuel", "petrol"],
    ]) {
      expect(screen.getByTestId(`facet-option-${slug}-${value}`)).toBeTruthy();
    }
    // The tail: a header each, aria-expanded=false, options NOT in the DOM.
    for (const slug of ["body", "drive"]) {
      expect(
        screen.getByTestId(`facet-toggle-${slug}`).getAttribute("aria-expanded")
      ).toBe("false");
    }
    expect(screen.queryByTestId("facet-option-body-sedan")).toBeNull();
    expect(screen.queryByTestId("facet-option-drive-awd")).toBeNull();
  });

  it("a collapsed group is one click from whole", async () => {
    await mountWidePanel();
    fireEvent.click(screen.getByTestId("facet-toggle-body"));
    await waitFor(() =>
      expect(screen.getByTestId("facet-option-body-sedan")).toBeTruthy()
    );
  });

  it("opens ANY group with a chosen value, whatever its evidence", async () => {
    // `drive` ranks seventh of seven counted groups, and `steering` was never
    // counted at all — but both carry a constraint, and a constraint must
    // never hide the control that removes it.
    await mountWidePanel("type=listing&f.drive=awd&f.steering=left");
    expect(screen.getByTestId("facet-option-drive-awd")).toBeTruthy();
    expect(screen.getByTestId("facet-option-steering-left")).toBeTruthy();
    // Open, and still honestly labelled.
    expect(screen.getByTestId("facet-count-steering-left").textContent).toBe(
      "not counted"
    );
    // Its unchosen peer stays collapsed.
    expect(screen.queryByTestId("facet-option-body-sedan")).toBeNull();
  });

  it("collapses an unchosen skipped group instead of printing its uncounted wall", async () => {
    // The walker's exact case: a skipped slug whose options are drawn from
    // the CATEGORY SCHEMA, each row saying "not counted". With nothing
    // chosen the group is a header, not a column of that phrase — an
    // uncounted group has ZERO coverage and can never rank into the open
    // five.
    render(
      <TestHarness server={wideServer()}>
        <FacetPanelPane
          categoryFeatures={[
            {
              slug: "steering",
              name: "test.feature.steering",
              config: {
                type: "select",
                options: [
                  { value: "left", label: "left" },
                  { value: "right", label: "right" },
                ],
              },
            },
          ]}
        />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-toggle-steering")).toBeTruthy()
    );
    expect(
      screen.getByTestId("facet-toggle-steering").getAttribute("aria-expanded")
    ).toBe("false");
    expect(screen.queryByTestId("facet-option-steering-left")).toBeNull();
  });
});

describe("from six groups up, the panel takes a search of itself", () => {
  it("draws no search box over a panel of two groups", async () => {
    render(
      <TestHarness server={mockServer({ "/query": { body: searchResponse() } })}>
        <FacetPanelPane />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-group-brand")).toBeTruthy()
    );
    expect(screen.queryByTestId("facets-search")).toBeNull();
  });

  it("narrows by group OR option label, case-insensitively, and opens the hits", async () => {
    await mountWidePanel();
    const box = screen.getByTestId("facets-search");
    // "SEDAN" is an OPTION label of `body` — a group that starts collapsed.
    fireEvent.change(box, { target: { value: "SEDAN" } });
    await waitFor(() =>
      expect(screen.getByTestId("facet-option-body-sedan")).toBeTruthy()
    );
    // The match renders OPEN — a hit behind a closed header is not an answer.
    expect(screen.queryByTestId("facet-group-brand")).toBeNull();
    expect(screen.queryByTestId("facet-group-price_band")).toBeNull();
  });

  it("filters presentation only — the URL never hears about the query", async () => {
    let latest = { search: "", history: [] as readonly string[] };
    render(
      <TestHarness
        server={wideServer()}
        onAdapter={(adapter) => {
          latest = adapter;
        }}
      >
        <FacetPanelPane />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("facets-search")).toBeTruthy()
    );
    fireEvent.change(screen.getByTestId("facets-search"), {
      target: { value: "sedan" },
    });
    await waitFor(() =>
      expect(screen.queryByTestId("facet-group-brand")).toBeNull()
    );
    expect(latest.search).toBe("type=listing");
  });

  it("says so when nothing matches, in the panel's own empty-state idiom", async () => {
    await mountWidePanel();
    fireEvent.change(screen.getByTestId("facets-search"), {
      target: { value: "zzz-no-such-filter" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("facets-search-empty")).toBeTruthy()
    );
    expect(screen.queryByTestId("facet-group-price_band")).toBeNull();
  });
});

function Page(props: { readonly initial?: string }): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams(
    props.initial ?? "type=listing"
  );
  return <SearchPage adapter={adapter} defaultType="listing" />;
}

function mountPage(initial?: string): void {
  render(
    <TestProviders server={wideServer()}>
      <Page {...(initial !== undefined ? { initial } : {})} />
    </TestProviders>
  );
}

describe("the rail's inner scroll is visible, and its floor answers back", () => {
  it("shows a thin scrollbar in a stable gutter instead of an invisible scroll", async () => {
    setViewport(DESKTOP_WIDTH);
    mountPage();
    await waitFor(() =>
      expect(screen.getByTestId("search-page-columns")).toBeTruthy()
    );
    const rail = screen.getByTestId("search-page-columns")
      .firstElementChild as HTMLElement;
    // On overlay-scrollbar platforms an `overflow-y: auto` column shows
    // NOTHING until you happen to scroll inside it — 5717px of content with
    // no sign there is more.
    expect(rail.style.scrollbarWidth).toBe("thin");
    expect(rail.style.scrollbarGutter).toBe("stable");
  });

  it("states the live count in a sticky footer inside the rail", async () => {
    setViewport(DESKTOP_WIDTH);
    mountPage();
    await waitFor(() =>
      expect(screen.getByTestId("facets-footer-bar")).toBeTruthy()
    );
    const bar = screen.getByTestId("facets-footer-bar");
    expect(bar.style.position).toBe("sticky");
    expect(bar.style.bottom).toBe("0px");
    // Inside the rail, so it stays put while the panel scrolls under it.
    expect(
      screen.getByTestId("search-page-columns").firstElementChild?.contains(bar)
    ).toBe(true);
    // The fixture's answer: 25, exact. Feedback, in words that count a noun.
    expect(screen.getByTestId("facets-footer-count").textContent).toBe(
      "25 listings match"
    );
  });

  it("puts the clear-all control in the bar when filters are active", async () => {
    setViewport(DESKTOP_WIDTH);
    mountPage("type=listing&f.brand=bosch");
    await waitFor(() =>
      expect(screen.getByTestId("facets-footer-bar")).toBeTruthy()
    );
    const bar = within(screen.getByTestId("facets-footer-bar"));
    expect(bar.getByTestId("facets-clear-all")).toBeTruthy();
  });

  it("draws no bar in the phone sheet — that surface has its own footer", async () => {
    setViewport(PHONE_WIDTH);
    mountPage();
    await waitFor(() =>
      expect(screen.getByTestId("search-filters-open")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("search-filters-open"));
    await waitFor(() =>
      expect(screen.getByTestId("search-filters-sheet")).toBeTruthy()
    );
    expect(screen.queryByTestId("facets-footer-bar")).toBeNull();
    // The sheet's evidence-ranked disclosure still applies: the same tail
    // starts collapsed here too.
    expect(
      screen.getByTestId("facet-toggle-drive").getAttribute("aria-expanded")
    ).toBe("false");
  });

  it("draws no bar for a host that mounts the bare panel", async () => {
    render(
      <TestHarness server={wideServer()}>
        <FacetPanelPane />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-group-price_band")).toBeTruthy()
    );
    expect(screen.queryByTestId("facets-footer-bar")).toBeNull();
  });
});
