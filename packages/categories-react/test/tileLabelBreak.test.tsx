/**
 * THE PHONE LANDING'S FIRST SCREEN: how a caption breaks, and what the "All"
 * tile draws where its siblings draw a picture.
 *
 * Both were walked on a 390px phone (a client fleet's landing, anonymous,
 * pre-launch sweep §4) and both are measurements rather than opinions:
 *
 *   tiles:  {"text":"Nedvizhimost","w":63,"h":29,"lines":2}
 *           {"text":"Elektronika","w":63,"h":29,"lines":2}
 *           {"text":"Transport","w":62,"h":14,"lines":1}
 *
 * A ONE-WORD label on two lines is a break inside the word, and the skin
 * printed no hyphen at it — "Nedvizhim / ost". The arithmetic behind it is
 * this file's first constant block and it is not escapable by any line count:
 * the compact tile's caption column is ~63px at that width (the scroller's
 * `min(100% / 4.4 − 8px, 128px)` column, less `spacing[2]` of padding on each
 * side), a nine-letter root name measures 62px at the compact label's 12px,
 * and a twelve-letter one therefore measures ~83px. 83 into 63 does not go, so
 * SOME break is forced; the only question the skin gets to answer is whether
 * it is marked.
 *
 * `labelHyphens` is that answer, as a PROP. D90 measured a catalogue that read
 * worse hyphenated and its ruling is still the default; this catalogue
 * measured the opposite and asks for `"auto"` by name. The assertions below
 * are therefore two-sided — the default has to stay exactly what it was, or
 * the prop is a behaviour change wearing a prop's clothes.
 *
 * ── The "All" tile, and WHERE the reading has to be taken ──────────────────
 *
 * The sweep also read `categories-tile-grid-all` carrying zero `<img>`/`<svg>`
 * while `categories-tile-grid` carried ten, and called it the missing
 * pictogram. The conclusion is right and the probe was not: that test id is on
 * the LABEL SPAN (`tileBody` puts `testId` there, and this package's own
 * comment says the two special tiles keep their older names on that span), so
 * it holds zero art on any page, working or broken — the same class of
 * mis-aimed reading `CATEGORY_TILE_LABEL_TESTID` exists to end.
 *
 * So the art assertion is taken on the tile LINK, which is where art lives,
 * and it names the glyph rather than counting elements: `data-stapel-tile-art`
 * is `"all"` and not `"monogram"`. A count would pass again the day somebody
 * puts a decorative `<svg>` anywhere else in the tile.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CategoryTileGrid } from "../src/default/index.js";
import type { CarouselEntry } from "../src/default/index.js";
import { categoryLabel } from "../src/index.js";
import {
  PHONE_WIDTH,
  TestProviders,
  installViewport,
  mockServer,
  resetViewportListeners,
  setViewport,
} from "./harness.js";
import { FULL_PAGE, categoryRow } from "./fixtures.js";

/**
 * The stand's own readings of the compact tile at 390 × 844, and the geometry
 * they are produced by. Stated as numbers so a skin change that moves the
 * column or the type has to come back through this file.
 */
const STAND = {
  viewport: 390,
  /** `min(100% / 4.4 − 8px, 128px)` over the landing's ~382px port, less the
   * tile's `spacing[2]` padding on each side. */
  captionColumnPx: 63,
  /** "Transport" — nine letters, ONE line, the widest caption that fits. */
  shortestOverflowingLabel: { letters: 9, px: 62, lines: 1 },
  /** "Nedvizhimost" — twelve letters, two lines, broken mid-word. */
  longestLabel: { letters: 12, lines: 2 },
} as const;

/** The catalogue's two longest root names — the ones the walk measured. */
const ROOTS = [
  categoryRow(145, "nedvizhimost", "category.realEstate", null, "", ""),
  categoryRow(147, "elektronika", "category.electronics", null, "", ""),
];

const ENTRIES: readonly CarouselEntry[] = ROOTS.map((category) => ({
  category,
  label: categoryLabel(category),
  icon: null,
  href: `/c/${category.slug}`,
}));

const OK = {
  "/categories/carousel/": { body: ROOTS },
  "/categories/": { body: FULL_PAGE },
};

beforeAll(() => {
  installViewport();
});
beforeEach(() => {
  resetViewportListeners();
  setViewport(PHONE_WIDTH);
});

async function mount(node: React.ReactElement): Promise<void> {
  render(<TestProviders server={mockServer(OK)}>{node}</TestProviders>);
  await waitFor(() => {
    expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
  });
}

/** Every tile LINK in the grid, in order — the "All" tile first. */
function tiles(): readonly HTMLElement[] {
  return [
    ...screen
      .getByTestId("categories-tile-grid-list")
      .querySelectorAll<HTMLElement>("a"),
  ];
}

/** One tile's caption — by the name every anatomy puts on it, except the two
 * special tiles, which carry their own older name on the same span. */
function captionIn(tile: HTMLElement): HTMLElement {
  const label = tile.querySelector<HTMLElement>("span[data-testid]");
  expect(label, "the tile names its caption").not.toBeNull();
  return label as HTMLElement;
}

describe("a caption too wide for the compact tile's column", () => {
  it("is a forced break — the arithmetic, before any style answers it", () => {
    /* Not a rendering accident and not a font-stack difference: at the
       measured 12px the widest ONE-line caption is nine letters of 62px in a
       63px column, so the per-letter advance is ~6.9px and a twelve-letter
       name is ~83px. This is the assertion that makes the rest of the file
       about the MARK rather than about whether a break happens. */
    const perLetterPx =
      STAND.shortestOverflowingLabel.px / STAND.shortestOverflowingLabel.letters;
    const longestPx = perLetterPx * STAND.longestLabel.letters;
    expect(longestPx).toBeGreaterThan(STAND.captionColumnPx);
    /* And it really is ONE word over TWO lines, which is what makes an
       unmarked break a reading cost rather than ordinary wrapping. */
    expect(STAND.longestLabel.lines).toBeGreaterThan(
      STAND.shortestOverflowingLabel.lines
    );
  });

  it("keeps D90's unmarked break when no host asks otherwise", async () => {
    /* THE DEFAULT IS THE WHOLE SAFETY OF THIS CHANGE. Every other deployment
       of this grid keeps the skin it measured; a fix that flipped the skin
       would close this catalogue's defect by re-opening D90's on all of
       them. */
    await mount(<CategoryTileGrid density="compact" entries={ENTRIES} />);
    for (const tile of tiles()) {
      const caption = captionIn(tile);
      expect(caption.style.hyphens).not.toBe("auto");
      /* And no language is stamped: `lang` here would be this pair claiming
         to know something the host's own document already says. */
      expect(caption.hasAttribute("lang")).toBe(false);
      /* The break rule D90 chose instead is untouched — a caption that could
         not break at all would be ellipsized on its first line, which is the
         defect `overflow-wrap` was added to prevent. */
      expect(caption.style.overflowWrap).toBe("anywhere");
    }
  });

  it("marks the break when the host asks for `auto` — WITH a language to mark it by", async () => {
    await mount(
      <CategoryTileGrid
        density="compact"
        labelHyphens="auto"
        entries={ENTRIES}
      />
    );
    const captions = tiles().map(captionIn);
    expect(captions.length).toBeGreaterThan(ENTRIES.length);

    for (const caption of captions) {
      expect(caption.style.hyphens).toBe("auto");
      /* THE HALF THAT IS EASY TO FORGET AND SILENT WHEN MISSING. `hyphens:
         auto` selects a pattern set by LANGUAGE; with none in scope the
         browser has no patterns, hyphenates nothing, and the declaration
         reads as a fix while changing not one pixel. The engine's locale is
         the same one every label on this tile was resolved through, so the
         two cannot disagree. */
      expect(caption.getAttribute("lang")).toBe("en");
      /* `anywhere` STAYS under `auto`: a name with no hyphenation point in
         it (an SKU, a foreign word) still has to break rather than clip. */
      expect(caption.style.overflowWrap).toBe("anywhere");
    }
  });
});

describe("the «All» tile's art", () => {
  it("is a pictogram, not the catalogue-row monogram", async () => {
    await mount(<CategoryTileGrid density="compact" entries={ENTRIES} />);
    const all = tiles()[0];
    expect(all, "the All tile leads the grid").toBeTruthy();
    /* It IS the All tile: the caption carries that tile's own older name. */
    expect(captionIn(all as HTMLElement).getAttribute("data-testid")).toBe(
      "categories-tile-grid-all"
    );

    /* THE DEFECT, as the eye read it off the screenshot: a lone faint capital
       where ten siblings draw a picture, which reads as an image that failed.
       The monogram is a fallback for a CATALOGUE ROW whose art has not been
       uploaded; this tile is the grid's own control and has no art to wait
       for. */
    expect(
      (all as HTMLElement).querySelector('[data-stapel-tile-art="monogram"]')
    ).toBeNull();
    expect(
      (all as HTMLElement).querySelector('[data-stapel-tile-art="all"]')
    ).not.toBeNull();
  });

  it("leaves the catalogue rows' own fallback exactly where it was", async () => {
    /* The monogram is not deleted and must not be: these two rows carry
       `icon: null`, which is the state every catalogue is in before anybody
       uploads art, and the letter is still the right answer there. */
    await mount(<CategoryTileGrid density="compact" entries={ENTRIES} />);
    for (const tile of tiles().slice(1)) {
      expect(
        tile.querySelector('[data-stapel-tile-art="monogram"]')
      ).not.toBeNull();
      expect(tile.querySelector('[data-stapel-tile-art="all"]')).toBeNull();
    }
  });
});
