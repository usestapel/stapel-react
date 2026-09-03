/**
 * THE PHONE SERP HEADER DOES NOT OVERLAP ITSELF (defect C12).
 *
 * Measured on a live 390×844 SERP, in both themes, on every result page — the
 * category listing, the text search and every filter slice:
 *
 * ```
 * {"kind":"clipped-left","t":"A chosen place on the map","x":-4}
 * {"kind":"overlap","a":"· Within 25 km","b":"Filters","px":43}
 * ```
 *
 * On screen that read as "…hosen place on the map · Within 25 kmlters", with
 * the red active-filter plaque floating in the top-right corner of the page,
 * attached to nothing. At 1440 it was clean, which is why nothing before this
 * caught it.
 *
 * ── What this suite can prove, and how ────────────────────────────────────
 *
 * jsdom lays NOTHING out: every `getBoundingClientRect` is a zero box, so a
 * test that compared two rects here would compare `0,0,0,0` with `0,0,0,0` and
 * pass on a page that overlapped everywhere. It would be a gate blind to the
 * thing it names.
 *
 * jsdom DOES run the cascade, and this component's rules ship in a hoisted
 * stylesheet, so what is asserted below is the real computed style of the real
 * rendered elements — and the four facts asserted are exactly the ones that
 * make an intersection impossible rather than merely unlikely:
 *
 *  1. the two halves are ITEMS OF ONE FLEX LINE. Flex items are placed
 *     sequentially along the main axis; two of them cannot occupy the same
 *     pixels. Every overlap in the measurement therefore had to come from
 *     either (2) or (3).
 *  2. the left half CLIPS: `overflow: hidden` on the box, and
 *     `text-overflow: ellipsis; white-space: nowrap` on the label inside it.
 *     That is what stops content painting outside its own box — an antd
 *     `<Button>` centres its children, so a shrunk box with no clipping
 *     overflows BOTH edges at once, which is precisely `x: -4` on the left
 *     and 43px over "Filters" on the right.
 *  3. the right half NEVER SHRINKS (`flex: 0 0 auto`) and holds nothing
 *     positioned out of the flow. The count was an antd `<Badge count>` — an
 *     absolutely positioned `sup` on the corner of what it wraps — which at
 *     the trailing edge of a full-width row lands outside the row entirely.
 *  4. the left half is the ONLY one that grows or shrinks, so a place name of
 *     any length is absorbed there and takes no width from the word.
 *
 * The boxes themselves were measured in a real browser at 390px against the
 * skin demo's `long-place` variant, which exists so the strict gate keeps
 * photographing this case.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LocationSummaryLine } from "../src/default/index.js";
import {
  LOCATION_LINE_END_CLASS,
  LOCATION_LINE_LABEL_CLASS,
  LOCATION_LINE_WHERE_CLASS,
  locationLineCss,
} from "../src/default/LocationSummaryLine.js";
import { searchResponse } from "./fixtures.js";
import { PHONE_WIDTH, TestHarness, mockServer, setViewport } from "./harness.js";

/** The live case: a chosen place, a radius, and three more constraints on a
 * 390px line — every element the measurement found colliding. */
const NARROWED =
  "type=listing&lat=55.7963&lon=49.1064&radius_km=25" +
  "&f.brand=bosch&f.condition=used&r.power=500..1500";

/** A place name of the length a geocoder really returns. */
const LONG_PLACE = "Voskresenskiye Vorota Passage, Tverskoy, Moscow";

afterEach(cleanup);

function mount(search = NARROWED, geoLabel: string = LONG_PLACE): void {
  setViewport(PHONE_WIDTH);
  render(
    <TestHarness
      server={mockServer({ "/query": { body: searchResponse() } })}
      initialSearch={search}
    >
      <LocationSummaryLine geoLabel={geoLabel} onOpenAll={() => undefined} />
    </TestHarness>
  );
}

describe("the row is one flex line, so its two halves cannot intersect", () => {
  it("lays the place and the filters out as siblings of one flex row", () => {
    mount();
    const row = screen.getByTestId("search-location-summary");
    expect(getComputedStyle(row).display).toBe("flex");
    expect(getComputedStyle(row).flexWrap).not.toBe("wrap");
    // Both halves are CHILDREN of that row: a flex line places its items one
    // after another, and nothing outside the line can be pushed into it.
    const where = screen.getByTestId("search-location-open");
    const end = screen.getByTestId("search-location-filters-badge");
    expect(where.parentElement).toBe(row);
    expect(end.parentElement).toBe(row);
  });

  it("gives the growth and the shrink to the place, and none to the word", () => {
    mount();
    const where = getComputedStyle(screen.getByTestId("search-location-open"));
    const end = getComputedStyle(
      screen.getByTestId("search-location-filters-badge")
    );
    // The left absorbs whatever length the place name has…
    expect(where.flexGrow).toBe("1");
    expect(where.flexShrink).toBe("1");
    // …and the right keeps every pixel of "Filters". Both ends used to be
    // `1 1 auto`, so a long name took width from the word.
    expect(end.flexGrow).toBe("0");
    expect(end.flexShrink).toBe("0");
  });

  it("lets the shrinking half actually shrink", () => {
    mount();
    const where = getComputedStyle(screen.getByTestId("search-location-open"));
    // A flex item's default `min-width: auto` is the reason a row refuses to
    // shrink at all and overflows its container instead.
    expect([where.minInlineSize, where.minWidth]).toContain("0");
  });
});

describe("nothing paints outside its own box", () => {
  it("clips the place half rather than letting a centred label spill", () => {
    mount();
    const where = getComputedStyle(screen.getByTestId("search-location-open"));
    // `x: -4` was this, exactly: an antd Button centres its content, so a box
    // too narrow for its label overflows off BOTH edges.
    expect(where.overflow).toBe("hidden");
  });

  it("truncates the label with an ellipsis, on one line", () => {
    mount();
    const label = getComputedStyle(screen.getByTestId("search-location-label"));
    expect(label.textOverflow).toBe("ellipsis");
    expect(label.whiteSpace).toBe("nowrap");
    expect(label.overflow).toBe("hidden");
  });

  it("keeps the place and the radius in ONE truncating label", () => {
    mount();
    const label = screen.getByTestId("search-location-label");
    // The radius rode in its own box before, so it was free to travel past
    // the label's end and land on top of "Filters".
    expect(label.querySelector('[data-testid="search-location-radius"]')).not.toBeNull();
    expect(label.textContent).toContain(LONG_PLACE);
    expect(label.textContent).toContain("Within 25 km");
  });

  it("makes the label a BLOCK, because ellipsis does nothing on a flex box", () => {
    mount();
    // Measured: with the label turned into a flex container the place name
    // was cut mid-glyph with no ellipsis at all.
    expect(getComputedStyle(screen.getByTestId("search-location-label")).display).toBe(
      "block"
    );
  });

  it("reaches whatever the button wraps its children in", () => {
    // Descendant rules cannot be written as inline styles; that is the whole
    // reason this component hoists a sheet, the way <ListingCard> does.
    const css = locationLineCss();
    expect(css).toContain(`.${LOCATION_LINE_WHERE_CLASS}>span{min-inline-size:0}`);
    expect(css).toContain(`.${LOCATION_LINE_LABEL_CLASS}{display:block;`);
    expect(css).toContain(`.${LOCATION_LINE_END_CLASS}{flex:0 0 auto}`);
  });
});

describe("the count rides in the line, not off its corner", () => {
  it("renders the count as an in-flow child of the row's trailing half", () => {
    mount();
    const count = screen.getByTestId("search-location-filters-count");
    // Measured at y=72 for a row whose line was at y=93: an antd `<Badge
    // count>` is an absolutely positioned `sup` hung off the corner of what
    // it wraps, and at the trailing edge of a full-width row that is outside
    // the row.
    // jsdom resolves an unset `position` to "" rather than to its initial
    // value, so the assertion is the one that matters either way: not taken
    // out of the flow.
    expect(["absolute", "fixed"]).not.toContain(getComputedStyle(count).position);
    expect(count.closest('[data-testid="search-location-summary"]')).not.toBeNull();
    // Three, not four: the place this row states in words on its other end is
    // not also a number on this one.
    expect(count.textContent).toBe("3");
  });

  it("has nothing positioned out of the flow anywhere in the row", () => {
    mount();
    const row = screen.getByTestId("search-location-summary");
    const escaped = Array.from(row.querySelectorAll("*")).filter((node) => {
      const position = getComputedStyle(node).position;
      return position === "absolute" || position === "fixed";
    });
    expect(escaped).toEqual([]);
  });

  it("draws no count at all when nothing is applied", () => {
    mount("type=listing", "");
    expect(screen.queryByTestId("search-location-filters-count")).toBeNull();
    expect(
      screen.getByTestId("search-location-filters").getAttribute("data-active")
    ).toBe("false");
  });
});
