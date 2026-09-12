/**
 * THE VIEW SWITCH WAS CUT IN HALF BY THE SORT SELECT ON A PHONE.
 *
 * The phone toolbar is two controls on one line: how the results are ARRANGED
 * (a segmented switch) and how they are ORDERED (a select). The select holds a
 * floor — the width of its own longest label, so its box does not grow when
 * the answer names the sort — and the switch, which had none, is what gave:
 * at 390px the trailing option was cut mid-word behind the select's leading
 * edge, with nothing on screen to say a control had been cut. A segmented
 * control missing its last three letters does not read as a small control, it
 * reads as a broken page.
 *
 * The fix is a different control below the pane's phone breakpoint rather than
 * the same one squeezed: the options are their GLYPHS, and the names move to
 * `aria-label` off the same i18n keys the wide form prints — so nothing is
 * lost to a screen reader, to a keyboard, or to a locale whose word for "grid"
 * is longer than the English one.
 *
 * jsdom does no layout, so what is asserted here is the mechanism the width
 * comes out of — which arm is drawn at which viewport, what the options are
 * named, and the three flex declarations that make the pair fold as a unit
 * instead of one of them shrinking into the other.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { SearchPage } from "../src/default/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { CLASSIFIED_FEATURES, MANY_BRANDS, searchResponse } from "./fixtures.js";
import {
  DESKTOP_WIDTH,
  PHONE_WIDTH,
  TestProviders,
  mockServer,
  setViewport,
  useTestParams,
} from "./harness.js";

/** The narrowest phone the storefront is measured on, and the reference one. */
const WIDTHS = [360, PHONE_WIDTH] as const;

afterEach(() => {
  cleanup();
  setViewport(DESKTOP_WIDTH);
});

function server(): ReturnType<typeof mockServer> {
  return mockServer({
    "/query": {
      body: searchResponse({
        facets: { condition: { new: 7, used: 18 }, brand: MANY_BRANDS },
        facet_meta: {
          approximate: false,
          candidates: 25,
          counted: ["condition", "brand"],
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

function Page(): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams("type=listing");
  return (
    <SearchPage
      adapter={adapter}
      defaultType="listing"
      categoryFeatures={CLASSIFIED_FEATURES}
    />
  );
}

async function mountAt(width: number): Promise<HTMLElement> {
  setViewport(width);
  render(
    <TestProviders server={server()}>
      <Page />
    </TestProviders>
  );
  await waitFor(() => expect(screen.getByTestId("search-view-switch")).toBeTruthy());
  return screen.getByTestId("search-view-switch");
}

describe("the view switch on a phone", () => {
  for (const width of WIDTHS) {
    it(`renders its options as glyphs at ${String(width)}px`, async () => {
      const swtch = await mountAt(width);
      expect(swtch.getAttribute("data-view-switch")).toBe("compact");
      // The words are gone from the GLASS — this is the cut the fix removes.
      expect(swtch.textContent).not.toContain("List");
      expect(swtch.textContent).not.toContain("Grid");
      // Two options, two glyphs.
      expect(within(swtch).getAllByTestId("search-view-option-icon")).toHaveLength(2);
    });

    it(`still NAMES both arrangements at ${String(width)}px`, async () => {
      const swtch = await mountAt(width);
      // The names are the same i18n keys the wide form prints, now reaching a
      // reader through the option's accessible name rather than its face. A
      // glyph-only control that nobody can name is not a smaller control.
      for (const name of ["List", "Grid"]) {
        expect(within(swtch).getByRole("img", { name })).toBeTruthy();
        expect(within(swtch).getByRole("radio", { name })).toBeTruthy();
      }
    });

    it(`switches the arrangement when a glyph is chosen at ${String(width)}px`, async () => {
      const swtch = await mountAt(width);
      const grid = within(swtch).getByRole("radio", { name: "Grid" });
      await waitFor(() =>
        expect(
          screen.getByTestId("search-results-grid").getAttribute("data-layout")
        ).toBe("list")
      );
      fireEvent.click(grid);
      await waitFor(() =>
        expect(
          screen.getByTestId("search-results-grid").getAttribute("data-layout")
        ).toBe("grid")
      );
    });

    it(`folds the pair as ONE unit at ${String(width)}px, neither squeezing the other`, async () => {
      const swtch = await mountAt(width);
      const group = screen.getByTestId("search-toolbar-arrangement");
      // The group wraps — so a line too short for both controls breaks
      // BETWEEN them rather than cutting the trailing one.
      expect(getComputedStyle(group).flexWrap).toBe("wrap");
      // And neither control shrinks inside it: the switch keeps its glyphs,
      // the select keeps the width of its own longest label.
      expect(swtch.style.flex).toBe("0 0 auto");
      const sort = screen.getByTestId("search-sort-compact");
      expect(sort.style.flex).toBe("0 0 auto");
      expect(sort.style.minInlineSize).toBe("max-content");
    });
  }

  it("keeps the words at a desktop width, where there is room for them", async () => {
    const swtch = await mountAt(DESKTOP_WIDTH);
    expect(swtch.getAttribute("data-view-switch")).toBe("named");
    expect(swtch.textContent).toContain("List");
    expect(swtch.textContent).toContain("Grid");
  });
});
