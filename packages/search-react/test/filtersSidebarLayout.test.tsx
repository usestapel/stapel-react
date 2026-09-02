/**
 * THE DESKTOP FILTER RAIL DOES NOT LAY ITS OWN HEADING OUT DOWN A COLUMN
 * (defect C14).
 *
 * Measured on the live 1440px SERP:
 *
 * ```
 * sidebarHeading {"w":43,"h":78,"lines":3}   // font-size 18px, line-height 26
 * ```
 *
 * — the word "Filters" in a 43×78 box, three lines, reading "Fil / ter / s"
 * down the left edge of the results. It is the first thing a shopper sees
 * beside what they searched for, and it reads as a broken page.
 *
 * ── What this suite can prove, and how ────────────────────────────────────
 *
 * jsdom lays NOTHING out: every `getBoundingClientRect` is a zero box, so a
 * test comparing rects here would compare `0,0,0,0` with `0,0,0,0` and pass on
 * a panel that broke everywhere. It would be a gate blind to the thing it
 * names — the same reasoning `serpHeaderLayout.test.tsx` sets out.
 *
 * jsdom DOES run the cascade, so what is asserted is the real computed style
 * of the real rendered elements, and the facts asserted are the ones that make
 * the measured box impossible rather than merely unlikely:
 *
 *  1. the heading may not SHRINK (`flex-shrink: 0`) and its minimum is its own
 *     content (`min-inline-size: max-content`). 43px of a 280px column was the
 *     button taking the width it wanted from a heading that was allowed to
 *     give it up.
 *  2. the heading may not BREAK INSIDE A WORD. antd's `.ant-typography` ships
 *     `word-break: break-word`, which is why the remains were three syllables
 *     stacked rather than one truncated word.
 *  3. the ROW wraps, so the long half has somewhere to go that is not the
 *     heading's width.
 *  4. the rail states both bounds, so the column it all happens in is 280px
 *     and not a share of whatever it was dropped into.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { FacetPanelPane, SearchPage } from "../src/default/index.js";
import { FILTERS_RAIL_WIDTH } from "../src/default/SearchPage.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import {
  DESKTOP_WIDTH,
  TestProviders,
  TestHarness,
  mockServer,
  setViewport,
  useTestParams,
} from "./harness.js";

afterEach(cleanup);

/** The live case: a shared link that already narrows by three things, so the
 * row carries BOTH halves — the heading and "Clear all filters (3)". With no
 * active filter there is no button and the defect cannot happen. */
const NARROWED = "type=listing&f.brand=bosch&f.condition=used&r.power=500..1500";

const SERVER = mockServer({
  "/query": {
    body: searchResponse({
      facets: { brand: { bosch: 12, makita: 4 } },
      facet_meta: {
        approximate: false,
        candidates: 16,
        counted: ["brand"],
        skipped: [],
        dropped_filters: [], core_ranges: [],
      },
    }),
  },
});

async function mountPanel(): Promise<void> {
  setViewport(DESKTOP_WIDTH);
  render(
    <TestHarness server={SERVER} initialSearch={NARROWED}>
      <FacetPanelPane />
    </TestHarness>
  );
  await waitFor(() => {
    expect(screen.getByTestId("facets-clear-all")).toBeTruthy();
  });
}

describe("the heading keeps its own width, and its own word", () => {
  it("never gives width to the sentence beside it", async () => {
    await mountPanel();
    const heading = getComputedStyle(screen.getByTestId("search-facets-heading"));
    // 43px of a 280px column was exactly this: a heading allowed to shrink
    // next to a button that wanted twenty-five characters.
    expect(heading.flexShrink).toBe("0");
    expect([heading.minInlineSize, heading.minWidth]).toContain("max-content");
  });

  it("never breaks inside the word, whatever antd's Typography says", async () => {
    await mountPanel();
    const heading = getComputedStyle(screen.getByTestId("search-facets-heading"));
    // `.ant-typography` ships `word-break: break-word`; that is what turned
    // "Filters" into three stacked syllables rather than a truncated word.
    expect(heading.wordBreak).toBe("normal");
    expect(heading.overflowWrap).toBe("normal");
  });

  it("states both rules INLINE, so no injection order can undo them", async () => {
    await mountPanel();
    // A class of ours against `.ant-typography` or `.ant-btn` is decided by
    // whichever stylesheet was injected last — not a decision, a coin toss
    // that happens to land right until a dependency reorders its emit.
    const inline = screen.getByTestId("search-facets-heading").getAttribute("style") ?? "";
    expect(inline).toContain("word-break: normal");
    expect(inline).toContain("min-inline-size: max-content");
  });
});

describe("the row gives the long half somewhere to go", () => {
  it("wraps, so the button drops to its own line instead of squeezing the word", async () => {
    await mountPanel();
    const row = getComputedStyle(screen.getByTestId("search-facets-head"));
    expect(row.display).toBe("flex");
    expect(row.flexWrap).toBe("wrap");
  });

  it("makes the BUTTON the half that gives", async () => {
    await mountPanel();
    const clear = getComputedStyle(screen.getByTestId("facets-clear-all"));
    expect(clear.flexShrink).toBe("1");
    // And it may wrap its own sentence: a two-line button is a button, a
    // three-line heading of one word is a defect.
    expect(clear.whiteSpace).toBe("normal");
    // And it grows for the second line rather than clipping it.
    expect(clear.height).toBe("auto");
  });

  it("keeps both halves as items of ONE flex line", async () => {
    await mountPanel();
    const row = screen.getByTestId("search-facets-head");
    expect(screen.getByTestId("search-facets-heading").parentElement).toBe(row);
    expect(screen.getByTestId("facets-clear-all").parentElement).toBe(row);
  });
});

function Page(): ReactElement {
  const adapter: SearchParamsAdapter = useTestParams(NARROWED);
  return <SearchPage adapter={adapter} defaultType="listing" />;
}

describe("the rail is a fixed instrument", () => {
  it("states a minimum as well as a maximum", async () => {
    setViewport(DESKTOP_WIDTH);
    render(
      <TestProviders server={SERVER}>
        <Page />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("search-page-columns")).toBeTruthy();
    });
    const rail = screen.getByTestId("search-facets").closest("div[style]");
    const columns = screen.getByTestId("search-page-columns");
    const box = Array.from(columns.children).find((node) =>
      node.contains(rail as Node)
    ) as HTMLElement;
    const style = getComputedStyle(box);
    // `flex-shrink: 0` alone held it only inside THIS row; the panel is handed
    // to hosts and to the sheet too, so the width is stated as a property of
    // the instrument.
    expect(style.minWidth).toBe(`${String(FILTERS_RAIL_WIDTH)}px`);
    expect(style.maxWidth).toBe(`${String(FILTERS_RAIL_WIDTH)}px`);
  });
});
