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
 * this file's first constant block: the compact tile's caption column was
 * ~63px at that width (the scroller's old `min(100% / 4.4 − 8px, 128px)`
 * column, less `spacing[2]` of padding on each side), a nine-letter root name
 * measures 62px at the compact label's 12px, and a twelve-letter one therefore
 * measures ~83px. 83 into 63 does not go, so the break was forced by the
 * COLUMN and no style could answer it.
 *
 * So the column is what changed: `COMPACT_MIN_COLUMN_PX` (96px) is a floor
 * under the fraction, and the tile spends one step less inline padding, which
 * gives the caption 88px — room for the longest root name on one line. The
 * break rules follow it: captions break between words (`overflow-wrap:
 * normal`) and a caption too long even for that column ends in an ellipsis
 * rather than splitting a word.
 *
 * `labelHyphens` stays what it was: a PROP, defaulting to D90's `"manual"`.
 * With the column wide enough there is nothing left for the browser to
 * hyphenate on this catalogue, and a deployment with longer names than these
 * can still ask for `"auto"` by name.
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
import { fontSize } from "@stapel/tokens";
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
  /** What the caption column WAS: `min(100% / 4.4 − 8px, 128px)` over the
   * landing's ~382px port, less the tile's `spacing[2]` padding on each side. */
  captionColumnPx: 63,
  /** What it is now: the 96px floor, less the tile's `spacing[1]` inline
   * padding on each side. */
  captionColumnNowPx: 96 - 4 * 2,
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
    /* THE FIX, in the same arithmetic: the column the floor buys holds the
       same name on one line, which is what makes `overflow-wrap: normal`
       below a readable rule rather than a clipped one. */
    expect(STAND.captionColumnNowPx).toBeGreaterThan(longestPx);
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
      /* And the break itself is between WORDS: the column now fits the
         longest name, so `anywhere` — which is what set one twelve-letter
         root name over two lines with nothing marking the break — is gone.
         The clamp's ellipsis is the floor under a name no column can hold. */
      expect(caption.style.overflowWrap).toBe("normal");
      expect(caption.style.textOverflow).toBe("ellipsis");
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
      /* The break rule is the SAME under `auto`: a name with no hyphenation
         point in it (an SKU, a foreign word) is not split mid-word either —
         it takes the ellipsis. */
      expect(caption.style.overflowWrap).toBe("normal");
      expect(caption.style.textOverflow).toBe("ellipsis");
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

/**
 * THE SAME TILES WITH THE NAMES THE CATALOGUE ACTUALLY CARRIES.
 *
 * The readings above were taken off a transliterated catalogue; the storefront
 * that showed the two split captions is Russian, and the two hardest cases in
 * its root list are a twelve-letter single word and a four-word name. Both
 * have to come out of the same tile: the word on one line, the phrase broken
 * only at its spaces.
 */
const RU_NAMES = [
  "Недвижимость",
  "Электроника",
  "Для дома и дачи",
  "Личные вещи",
] as const;

const RU_ROOTS: readonly CarouselEntry[] = RU_NAMES.map((name, index) => ({
  // A LITERAL label: these are the catalogue's own names, already in the
  // language the storefront reads, and nothing translates them further.
  category: categoryRow(200 + index, `ru-${String(index)}`, name, null, "", ""),
  label: { kind: "literal", value: name },
  icon: null,
  href: `/c/ru-${String(index)}`,
}));

describe("the Russian root names, on the phone landing's compact tile", () => {
  it("breaks between words and never inside one", async () => {
    await mount(<CategoryTileGrid density="compact" entries={RU_ROOTS} />);
    const captions = tiles().map(captionIn);
    // The All tile plus one per root.
    expect(captions.length).toBe(RU_ROOTS.length + 1);
    for (const caption of captions) {
      expect(caption.style.overflowWrap).toBe("normal");
      expect(caption.style.hyphens).toBe("manual");
      // The last resort, and it is an ellipsis rather than a split word.
      expect(caption.style.textOverflow).toBe("ellipsis");
      expect(caption.style.overflow).toBe("hidden");
    }
    // Every name is still on the glass whole — the caption is the name, not a
    // prefix of it.
    for (const name of RU_NAMES) {
      expect(screen.getByText(name)).toBeTruthy();
    }
  });

  it("gives the tile a column wide enough for the longest of them", async () => {
    await mount(<CategoryTileGrid density="compact" entries={RU_ROOTS} />);
    const columns = screen.getByTestId("categories-tile-grid-list").style
      .gridAutoColumns;
    // The floor is what makes the rule above readable rather than clipped:
    // the longest name is ~83px at the caption's 12px and the column is 88px.
    expect(columns).toContain("clamp(96px,");
    expect(STAND.captionColumnNowPx).toBe(88);
    // The fraction and the cap above the floor are untouched — a wider
    // container is exactly the geometry it was.
    expect(columns).toContain("/ 4.4");
    expect(columns).toContain("128px");
  });

  it("keeps the caption on the type scale's smallest step, not below it", async () => {
    await mount(<CategoryTileGrid density="compact" entries={RU_ROOTS} />);
    for (const caption of tiles().map(captionIn)) {
      // `xs`. There is no step under it, which is why the COLUMN carries the
      // fit and the type does not shrink to buy it.
      expect(caption.style.fontSize).toBe(`${String(fontSize.xs.fontSize)}px`);
      expect(caption.style.webkitLineClamp).toBe("2");
    }
  });
});
