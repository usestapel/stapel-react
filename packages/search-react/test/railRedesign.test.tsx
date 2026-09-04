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
import {
  PHONE_FACETS,
  PHONE_RANGE_FEATURES,
  searchResponse,
} from "./fixtures.js";
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
          core_ranges: [], plan: "category", withheld: [], categories: [],
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

  it("does not draw an unchosen group with no evidence at all (D249)", async () => {
    // The walker's exact case, one release on: a skipped slug whose options
    // are drawn from the CATEGORY SCHEMA, each row saying "not counted". It
    // used to render as a collapsed header, and a live laptops leaf drew six
    // of six groups that way — six headings a person can open and narrow
    // nothing by. No evidence and nothing chosen is not a filter.
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
    // The counted groups of the same answer still arrive, so this is the
    // panel drawing what it has rather than a panel that failed to load.
    await waitFor(() =>
      expect(screen.getByTestId("facet-group-brand")).toBeTruthy()
    );
    expect(screen.queryByTestId("facet-group-steering")).toBeNull();
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

  it("states the live count in a footer at the foot of the rail", async () => {
    setViewport(DESKTOP_WIDTH);
    mountPage();
    await waitFor(() =>
      expect(screen.getByTestId("facets-footer-bar")).toBeTruthy()
    );
    const bar = screen.getByTestId("facets-footer-bar");
    // STATIC in the column layout. Pinned to the scroll port's floor it sat
    // on top of the last two groups, which a storefront was lifting off with
    // `!important`; the sheet, whose port IS the sheet, still pins it.
    expect(bar.getAttribute("data-position")).toBe("static");
    expect(bar.style.position).toBe("");
    // Inside the rail, so it travels with the panel it belongs to.
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

/**
 * ── The rail's ORDER, which is the half the redesign did not carry ─────────
 *
 * Openness was ranked by evidence; the SEQUENCE was left as `buildFacetGroups`
 * and `buildRangeGroups` emitted it, i.e. the catalogue importer's. On the
 * deployed mobile-phones leaf that read, top to bottom: Category, Where to
 * look, Price, then battery health, parcel weight, parcel length, parcel
 * height, parcel width, minimum order count and packing count — 908px of
 * parcel logistics — and only THEN brand, model and colour.
 *
 * The rail is sticky and viewport-tall with its own inner scroll, so what that
 * order actually costs is not "a longer page": at 1440×900 the brand facet sat
 * at y≈1500 and never entered the viewport at any page scroll. A buyer on the
 * phones leaf saw seven ways to filter by shipping weight and no way to filter
 * by brand (walker D120/D121 on the desktop, D74 on the phone).
 *
 * The chip row has ranked exactly this since D16. The panel now shares its
 * comparator rather than holding a second opinion.
 */
describe("the rail ranks by evidence, not by schema order", () => {
  function phoneServer(): ReturnType<typeof mockServer> {
    return mockServer({
      "/query": {
        body: searchResponse({
          facets: PHONE_FACETS,
          facet_meta: {
            approximate: false,
            candidates: 43,
            counted: Object.keys(PHONE_FACETS),
            skipped: [],
            dropped_filters: [],
            core_ranges: ["price"], plan: "category", withheld: [], categories: [],
          },
        }),
      },
      "/suggest": { body: { items: [], backend: "postgres" } },
    });
  }

  async function mountPhoneLeaf(initial = "type=listing"): Promise<HTMLElement> {
    const { container } = render(
      <TestHarness server={phoneServer()} initialSearch={initial}>
        <FacetPanelPane categoryFeatures={PHONE_RANGE_FEATURES} />
      </TestHarness>
    );
    await waitFor(() =>
      expect(screen.getByTestId("facet-group-vendor")).toBeTruthy()
    );
    return container;
  }

  /** Every facet group and range row the panel drew, in DOM order. */
  function railOrder(container: HTMLElement): readonly string[] {
    return [
      ...container.querySelectorAll(
        '[data-testid^="facet-group-"],[data-testid^="facet-range-"]'
      ),
    ].map((node) => node.getAttribute("data-testid") ?? "");
  }

  it("puts the price and the counted facets above every numeric attribute", async () => {
    const container = await mountPhoneLeaf();
    const order = railOrder(container);
    const at = (id: string): number => order.indexOf(id);

    // The core axis leads.
    expect(at("facet-range-price")).toBe(0);
    // The brand — the axis a buyer of a phone narrows by — is above ALL seven
    // parcel/wholesale numbers. It used to be below every one of them.
    for (const slug of [
      "akb",
      "weight_for_delivery",
      "length_for_delivery",
      "height_for_delivery",
      "width_for_delivery",
      "wholesale_min_order_count",
      "wholesale_packing_count",
    ]) {
      expect(at("facet-group-vendor"), slug).toBeLessThan(
        at(`facet-range-${slug}`)
      );
    }
    // …and the counted facets rank among themselves by coverage: condition
    // (43 across two options) over vendor (32 across three).
    expect(at("facet-group-condition")).toBeLessThan(at("facet-group-vendor"));
  });

  it("keeps the numeric tail — it is ranked, not deleted", async () => {
    const container = await mountPhoneLeaf();
    const order = railOrder(container);
    // A buyer who genuinely wants a shipping-weight bound still has one, in
    // its own block below the facets.
    expect(
      screen.getByTestId("search-ranges-attributes").contains(
        screen.getByTestId("facet-range-weight_for_delivery")
      )
    ).toBe(true);
    expect(order).toContain("facet-range-wholesale_packing_count");
  });

  it("an ANSWERED axis is never folded away", async () => {
    // A constraint the person set must never sink below the fold of a
    // viewport-tall rail: the control that removes it is the one they came
    // for. The rail used to rank it to the top for this and now keeps SCHEMA
    // order — which is stable under a click, where a rail that reshuffles as
    // you tick is not — so the invariant moved to the fold: an answered group
    // is drawn wherever the schema put it, and drawn OPEN.
    const container = await mountPhoneLeaf("type=listing&f.vendor=apple");
    expect(railOrder(container)).toContain("facet-group-vendor");
    expect(screen.getByTestId("facet-option-vendor-apple")).toBeTruthy();
  });
});
