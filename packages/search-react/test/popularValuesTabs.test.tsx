/**
 * THE BAND'S HEADING IS A PAIR OF TABS, AND BOTH OF THEM STAY ON SCREEN.
 *
 * What was drawn: a caption naming the axis with an "all of it" link beside it.
 * Pressing the link swapped the block for the full list — and the caption AND
 * the link went with it, so the way back was gone. Measured by the founder on
 * the live site (2026-09-13) against the reference classified, which draws the
 * same control as two tabs that are both always visible — "popular <section>"
 * and "all" — the selected one in the text colour and the other in the brand
 * colour, and pressing either switches the block under them.
 *
 * WHAT THIS ASSERTS — in terms of what a person sees and can press: that both
 * tabs are in the document in either state, which one is selected, that
 * pressing the unselected one is reported to the host, that the arrow keys
 * move the selection the way a tablist's do, and that the two colours are the
 * design system's own roles rather than hand-written values (both operands
 * are READ — the token out of antd's own `useToken`, the colour off the
 * element — so neither side is assumed).
 *
 * WHAT IT CANNOT SEE. jsdom lays out no text and computes no cascade: that
 * the two tabs sit on one line, that the type is 16–18px as drawn, that there
 * is no underline, and that the brand colour is legible on the page's ground
 * are BROWSER facts and are not tested here. The type step and the absence of
 * a text decoration are asserted as declarations only, which is a statement
 * about the style object and not about the pixels.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { ReactElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { theme as antdTheme } from "antd";
import { buildFacetGroups, parseSearchState } from "../src/index.js";
import type { FacetGroup } from "../src/index.js";
import { PopularValues, PopularValuesTabs } from "../src/default/index.js";
import type { PopularValuesTab } from "../src/default/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

afterEach(cleanup);

const MAKES: Readonly<Record<string, number>> = {
  toyota: 802,
  bmw: 611,
  honda: 540,
};

/** The label the HOST supplies — the section noun in the form the sentence
 * needs. The catalogue declares no plural, so the pair never builds it. */
const POPULAR_LABEL = "Popular passenger cars";

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
    facetLabels: { vendor: { label: "Make", translatable: false, values: {} } },
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

/**
 * One colour, spelled the one way.
 *
 * The token is a hex literal and the DOM re-serialises whatever is set on it
 * as `rgb()`/`rgba()` with spaces. Both are notation; the VALUE is the three
 * channels, so both sides are brought to the same spelling before they are
 * compared rather than one side being written out by hand.
 */
function css(value: string | undefined): string {
  const raw = (value ?? "").replace(/\s+/g, "").toLowerCase();
  const hex = /^#([0-9a-f]{6})$/.exec(raw);
  if (hex === null) return raw;
  const digits = hex[1] ?? "";
  const channel = (at: number): number => parseInt(digits.slice(at, at + 2), 16);
  return `rgb(${String(channel(0))},${String(channel(2))},${String(channel(4))})`;
}

/** The design system's own roles, read from antd rather than restated — so
 * the colour assertions have two measured operands and no assumed one. */
function readTokens(): { text: string; primary: string } {
  let read: { text: string; primary: string } | undefined;
  function Probe(): null {
    const { token } = antdTheme.useToken();
    read = { text: token.colorText, primary: token.colorPrimary };
    return null;
  }
  render(<Probe />);
  if (read === undefined) throw new Error("no tokens");
  return read;
}

describe("the makes band's heading is a tablist, and the way back stays", () => {
  it("draws both tabs, says which is selected, and reports a press", () => {
    const showAll = vi.fn();
    const showPopular = vi.fn();
    mount(
      <PopularValues
        group={vendorGroup()}
        onApply={() => undefined}
        popularLabel={POPULAR_LABEL}
        onShowAll={showAll}
        onShowPopular={showPopular}
      />
    );

    const list = screen.getByRole("tablist");
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(list.contains(tabs[0] ?? null)).toBe(true);
    expect(list.contains(tabs[1] ?? null)).toBe(true);

    // Both names are on screen at once — that is the whole defect.
    expect(tabs[0]?.textContent).toBe(POPULAR_LABEL);
    expect(tabs[1]?.textContent).toBe("All");

    // The band is drawing its own dozen, so the first tab is the selected one.
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("false");
    // Roving tab stop: a tablist is ONE stop, and the arrows move inside it.
    expect(tabs[0]?.getAttribute("tabindex")).toBe("0");
    expect(tabs[1]?.getAttribute("tabindex")).toBe("-1");

    fireEvent.click(tabs[1] as HTMLElement);
    expect(showAll).toHaveBeenCalledTimes(1);
    // Pressing the tab already selected asks the host for nothing.
    fireEvent.click(tabs[0] as HTMLElement);
    expect(showPopular).not.toHaveBeenCalled();
  });

  it("keeps the first tab pressable while the whole list is on screen", () => {
    const showPopular = vi.fn();
    mount(
      <PopularValues
        group={vendorGroup()}
        onApply={() => undefined}
        popularLabel={POPULAR_LABEL}
        activeTab="all"
        onShowPopular={showPopular}
      />
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("false");
    fireEvent.click(tabs[0] as HTMLElement);
    expect(showPopular).toHaveBeenCalledTimes(1);
  });

  it("moves the selection with the arrow keys, and switches back", () => {
    /* Held in real state, the way a host holds it: a spy that never re-renders
       would let this assert transitions the control can never actually be in
       (focus on one tab while the other stays selected forever). */
    function Switcher(): ReactElement {
      const [active, setActive] = useState<PopularValuesTab>("popular");
      return (
        <PopularValuesTabs
          popularLabel={POPULAR_LABEL}
          active={active}
          onSelect={setActive}
        />
      );
    }
    mount(<Switcher />);
    const selected = (): string | null | undefined =>
      screen.getAllByRole("tab").find((tab) => tab.getAttribute("aria-selected") === "true")
        ?.textContent;
    const tabs = screen.getAllByRole("tab");

    expect(selected()).toBe(POPULAR_LABEL);
    fireEvent.keyDown(tabs[0] as HTMLElement, { key: "ArrowRight" });
    expect(selected()).toBe("All");
    // Selection follows focus, so the tab it moved to is the one focused.
    expect(document.activeElement).toBe(tabs[1]);
    // …and back, which is the whole defect.
    fireEvent.keyDown(tabs[1] as HTMLElement, { key: "ArrowLeft" });
    expect(selected()).toBe(POPULAR_LABEL);
    expect(document.activeElement).toBe(tabs[0]);
    // The ends, named.
    fireEvent.keyDown(tabs[0] as HTMLElement, { key: "End" });
    expect(selected()).toBe("All");
    fireEvent.keyDown(tabs[1] as HTMLElement, { key: "Home" });
    expect(selected()).toBe(POPULAR_LABEL);
    // A key that is not the tablist's leaves the selection alone.
    fireEvent.keyDown(tabs[0] as HTMLElement, { key: "a" });
    expect(selected()).toBe(POPULAR_LABEL);
    // And the mouse does what the keyboard did.
    fireEvent.click(tabs[1] as HTMLElement);
    expect(selected()).toBe("All");
    fireEvent.click(tabs[0] as HTMLElement);
    expect(selected()).toBe(POPULAR_LABEL);
  });

  it("paints the two tabs from the design system's roles", () => {
    const tokens = readTokens();
    mount(
      <PopularValuesTabs
        popularLabel={POPULAR_LABEL}
        active="popular"
        onSelect={() => undefined}
      />
    );
    const tabs = screen.getAllByRole("tab");
    // The selected tab is the page's own text colour; the other is the brand.
    expect(css(tabs[0]?.style.color)).toBe(css(tokens.text));
    expect(css(tabs[1]?.style.color)).toBe(css(tokens.primary));
    // Neither is a literal: what is on the element is what the theme says.
    expect(tokens.text).not.toBe(tokens.primary);
    // A tab is not a link — the reference draws no underline on either.
    expect(tabs[0]?.style.textDecoration).toBe("none");
    expect(tabs[1]?.style.textDecoration).toBe("none");
  });

  it("names the values box as the panel the selected tab controls", () => {
    mount(
      <PopularValues
        group={vendorGroup()}
        onApply={() => undefined}
        popularLabel={POPULAR_LABEL}
        onShowAll={() => undefined}
      />
    );
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("data-testid")).toBe("popular-columns-vendor");
    const selected = screen.getAllByRole("tab")[0];
    expect(panel.getAttribute("aria-labelledby")).toBe(selected?.id);
    // The values themselves are still in it.
    expect(screen.getByTestId("popular-value-vendor-toyota")).toBeTruthy();
  });

  it("is exactly what it was for a host that names no section", () => {
    mount(
      <PopularValues
        group={vendorGroup()}
        onApply={() => undefined}
        onShowAll={() => undefined}
      />
    );
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByTestId("popular-all-vendor")).toBeTruthy();
  });
});
