/**
 * THE THREE THINGS THE OWNER READ AS BROKEN ON THE LIVE CARS LEAF.
 *
 * Screenshot of `/c/transport-avtomobili` at ~1600px, 2026-09-13:
 *
 *  1. The make axis's values box is its own scroll port, and the PLATFORM's bar
 *     was painted over the row's last column — «Chery 5» read as «Chery» with
 *     the 5 under a grey strip. The list's first value was also drawn flush
 *     against the box that filters it, so it read as clipped BY the input.
 *  2. The "collapse" control kept a red outline standing around it after a
 *     MOUSE click.
 *  3. The make block above the feed spread three columns across the whole
 *     results pane: a make, 300px of nothing, the next make.
 *
 * jsdom lays nothing out and enters no pseudo-class, so what is asserted here
 * is what the page DECLARES — which class a box carries, what its inline style
 * says, what the hoisted rule set says, and which attribute a control stamps
 * on itself for which input device. The geometry those declarations produce is
 * the stand's job, not this suite's.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { buildFacetGroups, parseSearchState } from "../src/index.js";
import type { FacetGroup } from "../src/index.js";
import type { FeatureDef } from "@stapel/attributes-react";
import {
  FacetGroupControl,
  POINTER_FOCUS_ATTR,
  POINTER_FOCUS_CLASS,
  POPULAR_VALUES_LADDER,
  POPULAR_VALUES_MAX_COLUMNS,
  PopularValues,
  RAIL_SCROLLBAR_CLASS,
  RAIL_SCROLLBAR_WIDTH,
  SCROLL_LIST_INSET_BLOCK_START,
  pointerFocusCss,
  railScrollbarCss,
} from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

const OPTIONS = { defaultType: "listing" } as const;

/** A vocabulary level as the counter returns one — the storefront's own cars
 * leaf, counts and all. */
const MAKES: Readonly<Record<string, number>> = {
  lada: 6,
  chery: 5,
  geely: 5,
  haval: 5,
  hyundai: 5,
  kia: 5,
  renault: 4,
  toyota: 4,
  audi: 3,
  bmw: 3,
  chevrolet: 3,
  mazda: 3,
};

const CAPTIONS: Readonly<Record<string, string>> = {
  lada: "ВАЗ (LADA)",
  chery: "Chery",
  geely: "Geely",
  haval: "HAVAL",
  hyundai: "Hyundai",
  kia: "Kia",
  renault: "Renault",
  toyota: "Toyota",
  audi: "Audi",
  bmw: "BMW",
  chevrolet: "Chevrolet",
  mazda: "Mazda",
};

const VENDOR: FeatureDef = {
  slug: "vendor",
  name: "test.feature.vendor",
  config: { type: "ref_select", optionsRef: { level: "Vendor", vocabulary: "cars" } },
};

function vendorGroup(): FacetGroup {
  const groups = buildFacetGroups({
    facets: { vendor: MAKES },
    meta: {
      approximate: false,
      candidates: 63,
      counted: ["vendor"],
      skipped: [],
      dropped_filters: [],
      core_ranges: [],
      plan: "category",
      withheld: [],
      categories: [],
    },
    state: parseSearchState(new URLSearchParams("type=listing"), OPTIONS).state,
    facetLabels: { vendor: { label: "Марка", translatable: false, values: CAPTIONS } },
    categoryFeatures: [VENDOR],
  });
  const group = groups.find((candidate) => candidate.slug === "vendor");
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

/** The dictionary drawn inline, which is the arm both the rail and the
 * expanded field land on. */
function mountDictionary(): void {
  mount(<FacetGroupControl group={vendorGroup()} onToggle={() => undefined} />);
}

function styleOf(testId: string): string {
  return screen.getByTestId(testId).getAttribute("style") ?? "";
}

describe("the values box is a scroll port, and it says so in the skin's hand", () => {
  it("carries the same scrollbar class the rail does — one sheet, both ports", () => {
    mountDictionary();
    const list = screen.getByTestId("facet-dictionary-list-vendor");
    expect(list.classList.contains(RAIL_SCROLLBAR_CLASS)).toBe(true);
  });

  it("reserves the gutter, so the bar is never painted over the content", () => {
    mountDictionary();
    // Both halves: the sheet states it for the engines that honour it, and the
    // box states it inline so a host that never mounts the sheet still gets it.
    expect(railScrollbarCss()).toContain("scrollbar-gutter:stable");
    expect(styleOf("facet-dictionary-list-vendor")).toContain(
      "scrollbar-gutter: stable"
    );
  });

  it("opens the list one step below the box that filters it", () => {
    mountDictionary();
    expect(styleOf("facet-dictionary-list-vendor")).toContain(
      `padding-block-start: ${String(SCROLL_LIST_INSET_BLOCK_START)}px`
    );
  });

  it("keeps the COUNT clear of the gutter — «Chery 5», with the 5 readable", () => {
    mountDictionary();
    // The number is the one thing in a facet row that lives at the trailing
    // edge, which on WebKit (no `scrollbar-gutter`) is where an overlay thumb
    // lands. It carries the track's own width as padding.
    expect(styleOf("facet-count-vendor-chery")).toContain(
      `padding-inline-end: ${String(RAIL_SCROLLBAR_WIDTH)}px`
    );
    expect(screen.getByTestId("facet-count-vendor-chery").textContent).toBe("5");
  });

  it("draws the thumb from the token palette and never a literal colour", () => {
    expect(railScrollbarCss()).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(railScrollbarCss()).not.toMatch(/rgba?\(/);
    expect(railScrollbarCss()).toContain("scrollbar-width:thin");
  });
});

describe("the focus ring is the keyboard's and not the mouse's", () => {
  it("turns the ring off only while the POINTER stamp is on the control", () => {
    const css = pointerFocusCss();
    // Doubled class: antd's own ring is `.ant-btn:not(:disabled):focus-visible`
    // (0,3,0), and a tie is settled by stylesheet order, which a runtime
    // CSS-in-JS design system does not let this pair decide.
    expect(css).toContain(`.${POINTER_FOCUS_CLASS}.${POINTER_FOCUS_CLASS}`);
    expect(css).toContain(`[${POINTER_FOCUS_ATTR}]:focus-visible`);
    expect(css).toContain("outline:none");
    // The rule NEVER fires without the stamp: a control focused from the
    // keyboard has no `data-pointer-focus` on it, so nothing here reaches it
    // and the design system's own ring stands.
    expect(css.includes(`.${POINTER_FOCUS_CLASS}:focus-visible{`)).toBe(false);
    expect(css.includes(`:focus{`)).toBe(false);
  });

  it("stamps the control on a pointer press and clears it on blur", () => {
    mountDictionary();
    const fold = screen.getByTestId("facet-more-vendor");
    expect(fold.classList.contains(POINTER_FOCUS_CLASS)).toBe(true);
    expect(fold.hasAttribute(POINTER_FOCUS_ATTR)).toBe(false);

    fireEvent.pointerDown(fold);
    expect(fold.hasAttribute(POINTER_FOCUS_ATTR)).toBe(true);

    fireEvent.blur(fold);
    expect(fold.hasAttribute(POINTER_FOCUS_ATTR)).toBe(false);
  });

  it("gives the ring back the moment a KEY touches the same control", () => {
    mountDictionary();
    const fold = screen.getByTestId("facet-more-vendor");
    fireEvent.pointerDown(fold);
    expect(fold.hasAttribute(POINTER_FOCUS_ATTR)).toBe(true);
    fireEvent.keyDown(fold, { key: "Tab" });
    expect(fold.hasAttribute(POINTER_FOCUS_ATTR)).toBe(false);
  });

  it("still folds and unfolds — the ring rule touched no behaviour", () => {
    mountDictionary();
    const fold = screen.getByTestId("facet-more-vendor");
    const before = screen.queryAllByTestId(/^facet-option-vendor-/).length;
    fireEvent.click(fold);
    expect(
      screen.queryAllByTestId(/^facet-option-vendor-/).length
    ).toBeGreaterThan(before);
  });
});

describe("the popular-values block is as wide as its words", () => {
  it("sizes the columns to their content instead of dividing the pane", () => {
    mount(<PopularValues group={vendorGroup()} onApply={() => undefined} />);
    const columns = styleOf("popular-columns-vendor");
    expect(columns).toContain("inline-size: fit-content");
    // And never wider than the pane it sits in — the columns shrink, they do
    // not overflow.
    expect(columns).toContain("max-inline-size: 100%");
  });

  it("separates them with a step of the scale, not with the leftover width", () => {
    mount(<PopularValues group={vendorGroup()} onApply={() => undefined} />);
    expect(styleOf("popular-columns-vendor")).toContain("column-gap: 32px");
  });

  it("defaults to three columns and refuses more than four", () => {
    mount(
      <PopularValues group={vendorGroup()} onApply={() => undefined} columns={7} />
    );
    expect(styleOf("popular-columns-vendor")).toContain(
      `column-count: ${String(POPULAR_VALUES_MAX_COLUMNS)}`
    );
  });

  it("keeps the count immediately after the name", () => {
    mount(<PopularValues group={vendorGroup()} onApply={() => undefined} />);
    const name = screen.getByTestId("popular-value-vendor-lada");
    const count = screen.getByTestId("popular-count-vendor-lada");
    expect(name.closest("div")?.contains(count)).toBe(true);
    expect(count.textContent).toBe("6");
  });

  it("lets the ladder decide the responsive arm, and it tops out at four too", () => {
    mount(
      <PopularValues
        group={vendorGroup()}
        onApply={() => undefined}
        columns="responsive"
      />
    );
    // No inline `column-count`: an inline one would beat every rung in the
    // sheet. The box is still content-sized.
    expect(styleOf("popular-columns-vendor")).not.toContain("column-count");
    expect(styleOf("popular-columns-vendor")).toContain("inline-size: fit-content");
    const top = POPULAR_VALUES_LADDER[POPULAR_VALUES_LADDER.length - 1];
    expect(top?.columns).toBe(POPULAR_VALUES_MAX_COLUMNS);
  });
});
