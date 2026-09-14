/**
 * THE BAND THAT USED A THIRD OF ITS WIDTH AND PAID FOR IT IN ROWS.
 *
 * Measured on the live storefront's `/c/transport` at 1440 (headless Chromium,
 * 2026-09-13): the results column is 1088px wide, and the popular-values block
 * inside it drew a columns box **377px wide** — three columns of a make and its
 * count — leaving 711px of white beside it and stacking twelve values four rows
 * deep. The band came to 160px of a 518px page head.
 *
 * Two causes, and they compound:
 *
 *  1. `inline-size: fit-content` sized the box to its WORDS, so the pane's
 *     width was never used. That rule was added for a real defect (three
 *     ~360px columns holding «Chery 5»), but it cures a symptom of the second
 *     cause;
 *  2. the container-query ladder asked for `breakpoints.desktop` (1200px)
 *     before granting a fourth column — and this block is the window minus a
 *     280px rail minus the gap, so at 1440 it is 1088px and the top rung
 *     **could never fire**. The rungs were window-scale numbers measuring a
 *     container that is never window-sized. The module's own doc says a media
 *     query would be wrong for exactly this reason; the rungs then used the
 *     window's breakpoints anyway.
 *
 * THE FIX IS THE MECHANISM THE EXPANDED BAND ALREADY USES — native multicol
 * with a `column-width`, which asks the element's own width how many columns
 * fit and needs no container query, no rungs and no hoisted sheet.
 *
 * ── Why 150 and not the old 200, measured rather than reasoned ─────────────
 *
 * `column-width` is a MINIMUM: the browser fits as many columns of at least
 * that measure as it can, then widens them to fill. Swept in a real browser
 * over the live twelve values and over a worst case of «Mercedes-Benz 1 204»
 * (the longest make on the stand with a four-digit count), at `column-gap: 32`:
 *
 * | column-width | 1088px pane  | 840px  | 600px  | 380px  |
 * |--------------|--------------|--------|--------|--------|
 * | 200          | 4 cols, 3 rows | 3×4  | 2×6    | 1×12   |
 * | 170          | 4 cols, 3 rows | 4×3  | 3×4    | 2×6    |
 * | 160          | 4 cols, 3 rows | 4×3  | 3×4    | 2×6    |
 * | **150**      | **6 cols, 2 rows** | 4×3 | 3×4 | 2×6   |
 *
 * 150 is the knee, and nothing wraps at it: the USED column is 155px at the
 * storefront's pane and never below 152px at any width in the sweep, because
 * the browser widens the columns to fill. The old claim that a value wraps
 * under its own number below 200 is false at the default type step — measured,
 * `wrap0` at every pane width for all three candidates.
 *
 * `column-width` and `inline-size: fit-content` are INCOMPATIBLE and that is
 * also measured, not assumed: together they collapse the box to ONE column
 * (200px wide, twelve rows). So the responsive arm drops `fit-content` — it is
 * a block that fills its pane, and the measure keeps the columns tight.
 *
 * What this suite pins is what a reader gets: twelve values in two rows in the
 * pane the storefront actually gives this block, a block that still degrades to
 * two columns on a narrow host, and a numeric arm nobody touched.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  POPULAR_VALUES_COLUMN_GAP,
  POPULAR_VALUES_LIMIT,
  POPULAR_VALUES_MAX_COLUMNS,
  POPULAR_VALUE_COLUMN_WIDTH,
  PopularValues,
} from "../src/default/index.js";
import type { FacetGroup } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

afterEach(cleanup);

/** The results column of the live storefront at 1440: the window, less the
 * 280px rail, less the gap. Measured on the stand, not assumed. */
const STOREFRONT_PANE = 1088;

/**
 * How many columns native multicol puts in a box of this width — the browser's
 * own rule, `floor((available + gap) / (column-width + gap))`, stated here so
 * the suite asserts ROWS A READER SEES rather than a constant's value. Checked
 * against a real Chromium for every row of the table above.
 */
function columnsAt(available: number): number {
  return Math.max(
    1,
    Math.floor(
      (available + POPULAR_VALUES_COLUMN_GAP) /
        (POPULAR_VALUE_COLUMN_WIDTH + POPULAR_VALUES_COLUMN_GAP)
    )
  );
}

/** The twelve makes the live band prints on `/c/transport`. */
const MAKES: FacetGroup = {
  slug: "make_ref_select",
  label: "Make",
  labelSource: "server",
  feature: undefined,
  counted: true,
  selected: [],
  options: [
    ["vaz-lada", "ВАЗ (LADA)", 6],
    ["chery", "Chery", 5],
    ["geely", "Geely", 5],
    ["haval", "HAVAL", 5],
    ["hyundai", "Hyundai", 5],
    ["kia", "Kia", 5],
    ["toyota", "Toyota", 4],
    ["volkswagen", "Volkswagen", 4],
    ["mercedes-benz", "Mercedes-Benz", 3],
    ["ford", "Ford", 3],
    ["bmw", "BMW", 3],
    ["renault", "Renault", 3],
  ].map(([value, label, count]) => ({
    value: value as string,
    label: label as string,
    count: count as number,
    labelSource: "server" as const,
    selected: false,
  })),
};

function server() {
  return mockServer({
    "/query": { body: searchResponse() },
    "/suggest": { body: { items: [], backend: "postgres" } },
  });
}

function mount(columns: number | "responsive"): void {
  render(
    <TestHarness server={server()}>
      <PopularValues group={MAKES} columns={columns} onApply={() => undefined} />
    </TestHarness>
  );
}

function columnsBox(): HTMLElement {
  return screen.getByTestId("popular-columns-make_ref_select");
}

describe("the band uses the width it is given", () => {
  it("puts the twelve values in two rows in the storefront's own pane", () => {
    mount("responsive");
    const cols = columnsAt(STOREFRONT_PANE);
    expect(cols).toBeGreaterThanOrEqual(6);
    // What a reader actually counts: rows, not columns. Four was the measured
    // live figure and it is the thing this change buys back.
    expect(Math.ceil(POPULAR_VALUES_LIMIT / cols)).toBe(2);
  });

  it("is a block that fills its pane, not a box sized to its words", () => {
    mount("responsive");
    const style = columnsBox().getAttribute("style") ?? "";
    // `fit-content` is what left 711px of white beside a 377px box — and it is
    // measurably incompatible with a column measure (together: one column).
    expect(style).not.toContain("fit-content");
    expect(style).toContain(`column-width: ${String(POPULAR_VALUE_COLUMN_WIDTH)}px`);
    // No fixed count anywhere: the element's own width is the only input.
    expect(style).not.toContain("column-count");
  });

  it("asks no container query and hoists no ladder sheet", () => {
    mount("responsive");
    // The rungs were window-scale numbers measuring a container that is never
    // window-sized, which is why the fourth column could not fire at 1440.
    expect(document.querySelector("style[href='stapel-popular-values']")).toBeNull();
    expect(columnsBox().hasAttribute("data-popular-columns")).toBe(false);
  });

  it("still gives a narrow host two columns rather than one", () => {
    // A phone-width host container: the block is a table of contents there too.
    expect(columnsAt(380)).toBe(2);
    expect(columnsAt(600)).toBe(3);
  });
});

describe("what this must not change", () => {
  it("leaves a host's explicit column count alone, ceiling included", () => {
    mount(6);
    const style = columnsBox().getAttribute("style") ?? "";
    // A host that has decided its own layout keeps it — clamped, as before.
    expect(style).toContain(`column-count: ${String(POPULAR_VALUES_MAX_COLUMNS)}`);
    expect(style).toContain("fit-content");
  });

  it("still prints every value and its count", () => {
    mount("responsive");
    expect(
      screen.getByTestId("popular-value-make_ref_select-vaz-lada").textContent
    ).toContain("ВАЗ (LADA)");
    expect(
      screen.getByTestId("popular-count-make_ref_select-vaz-lada").textContent
    ).toBe("6");
    expect(columnsBox().children).toHaveLength(POPULAR_VALUES_LIMIT);
  });
});
