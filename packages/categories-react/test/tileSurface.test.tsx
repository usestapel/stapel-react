/**
 * THE TILE IS AN ICON AND A NAME, NOT A BOX.
 *
 * `surface-sunken` behind every tile was inherited from the first carousel
 * strip and never re-decided: on the walked storefront a dozen of them read as
 * a wall of dark rectangles, each fill competing with the picture it contains.
 * `tileSurface="flat"` — now the default — takes the fill away at rest and
 * gives it back on hover and on `:focus-visible`, where it means "this is the
 * one you are about to open".
 *
 * What is asserted: the DECLARATIONS, on both sides of the seam. The inline
 * style is where the card's fill lives and where the flat tile's must not be
 * (an inline fill would beat the sheet's own hover rule), and the rule set is
 * where the two states live, since jsdom lays nothing out and can enter no
 * pseudo-class.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  CATEGORY_TILE_CLASS,
  CATEGORY_TILE_FLAT_CLASS,
  CATEGORY_TILE_LABEL_TESTID,
  CATEGORY_TILE_STYLE_HREF,
  CategoryCarouselStrip,
  CategoryTileGrid,
  categoryTileCss,
  tileStageRows,
} from "../src/default/index.js";
import type { CarouselEntry } from "../src/default/index.js";
import { categoryLabel } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { ELECTRONICS, FULL_PAGE, VEHICLES } from "./fixtures.js";

const CAROUSEL = [ELECTRONICS, VEHICLES];
const OK = {
  "/categories/carousel/": { body: CAROUSEL },
  "/categories/": { body: FULL_PAGE },
};

afterEach(cleanup);

const ENTRIES: readonly CarouselEntry[] = CAROUSEL.map((category) => ({
  category,
  label: categoryLabel(category),
  icon: null,
  href: `/c/${category.slug}`,
}));

async function mount(
  surface?: "flat" | "card",
  size?: "regular" | "compact"
): Promise<HTMLElement> {
  render(
    <TestProviders server={mockServer(OK)}>
      <CategoryTileGrid
        entries={ENTRIES}
        // The «All» tile leads the grid and names its caption differently —
        // this suite is about an ordinary tile's own anatomy.
        allTile={false}
        {...(surface !== undefined ? { tileSurface: surface } : {})}
        {...(size !== undefined ? { size } : {})}
      />
    </TestProviders>
  );
  await waitFor(() => {
    expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
  });
  const list = screen.getByTestId("categories-tile-grid-list");
  const tile = list.querySelector<HTMLElement>(`.${CATEGORY_TILE_CLASS}`);
  expect(tile, "no tile carries the pair's own class").not.toBeNull();
  return tile as HTMLElement;
}

describe("<CategoryTileGrid tileSurface> — flat is the default", () => {
  it("draws no fill of its own at rest", async () => {
    const tile = await mount();
    expect(screen.getByTestId("categories-tile-grid").dataset["tileSurface"]).toBe(
      "flat"
    );
    expect(tile.classList.contains(CATEGORY_TILE_FLAT_CLASS)).toBe(true);
    // Nothing inline: the fill is the sheet's now, in both directions. An
    // inline `background` — even `transparent` — would beat the hover rule.
    expect(tile.style.background).toBe("");
    expect(tile.style.backgroundColor).toBe("");
    // And the sheet says so, at rest.
    expect(categoryTileCss()).toContain(
      `.${CATEGORY_TILE_FLAT_CLASS}{background-color:transparent;border:none}`
    );
  });

  it("takes the surface back on hover and on keyboard focus", () => {
    const css = categoryTileCss();
    expect(css).toContain(
      `.${CATEGORY_TILE_FLAT_CLASS}:hover,` +
        `.${CATEGORY_TILE_FLAT_CLASS}:focus-visible{` +
        `background-color:var(--stapel-surface-sunken)}`
    );
    // The fill is the CARD's own token: the hovered tile is the same tile, not
    // a new colour. And it is a custom property, so both themes resolve it at
    // paint time rather than freezing whichever mounted first.
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/);
    // The focus RING is untouched: nothing here writes `outline`.
    expect(css).not.toContain("outline");
  });

  it("keeps the radius the grid was already laid out for", async () => {
    const tile = await mount();
    // The flat tile loses its fill and nothing else — the hovered shape is the
    // shape the track reserved.
    expect(tile.style.borderRadius).toBe("12px");
  });
});

describe('<CategoryTileGrid tileSurface="card"> — today\'s tile, unchanged', () => {
  it("keeps the inline fill and takes no hover rule", async () => {
    const tile = await mount("card");
    expect(screen.getByTestId("categories-tile-grid").dataset["tileSurface"]).toBe(
      "card"
    );
    expect(tile.classList.contains(CATEGORY_TILE_FLAT_CLASS)).toBe(false);
    expect(tile.style.background).toBe("var(--stapel-surface-sunken)");
  });
});

/**
 * THE FLAT TILE IS A STACK, NOT A CARD WITH THE CARD TAKEN AWAY.
 *
 * Taking the fill away was half the change. The card anatomy puts the caption
 * in the top-left corner and the art in the bottom-right, and the filled box
 * is what held those two marks together: with no fill they are two unrelated
 * things with a void between, and six of them across a desktop row read as a
 * loose list (owner's walk of 0.27.0, both themes). Proximity replaces the
 * box — the icon centred with the caption centred under it, which is the
 * arrangement the phone landing already reads correctly without a fill.
 */
describe("the flat tile's anatomy", () => {
  it("centres the caption and puts the art above it", async () => {
    const tile = await mount();
    expect(tile.style.justifyContent).toBe("center");
    expect(tile.style.alignItems).toBe("center");
    const caption = tile.querySelector<HTMLElement>(
      `[data-testid="${CATEGORY_TILE_LABEL_TESTID}"]`
    );
    expect(caption).not.toBeNull();
    expect(caption?.style.textAlign).toBe("center");
    // ART FIRST in the DOM, caption second — the stack's reading order.
    const marks = [...tile.children];
    expect(marks.length).toBe(2);
    expect(marks[1]?.getAttribute("data-testid")).toBe(CATEGORY_TILE_LABEL_TESTID);
  });

  it("keeps the caption at the card's own type size, not the 80px tile's 12px", async () => {
    const tile = await mount();
    const caption = tile.querySelector<HTMLElement>(
      `[data-testid="${CATEGORY_TILE_LABEL_TESTID}"]`
    );
    // `labelCompact` belongs to the ~80px dense phone tile. A desktop tile
    // that borrowed it would be flat AND unreadable.
    expect(caption?.style.fontSize).toBe("");
    expect(caption?.style.webkitLineClamp).toBe("3");
  });

  it("occupies exactly the box the card tile did", async () => {
    const flat = await mount();
    const flatRatio = flat.style.aspectRatio;
    const flatPadding = flat.style.padding;
    cleanup();
    const card = await mount("card");
    // Only the ARRANGEMENT moves: every reservation, track height and
    // measured stage is unchanged by the surface.
    expect(flatRatio).toBe(card.style.aspectRatio);
    expect(flatPadding).toBe(card.style.padding);
  });

  it("leaves the card anatomy exactly where it was", async () => {
    const tile = await mount("card");
    expect(tile.style.justifyContent).toBe("space-between");
    const caption = tile.querySelector<HTMLElement>(
      `[data-testid="${CATEGORY_TILE_LABEL_TESTID}"]`
    );
    expect(caption?.style.textAlign).toBe("");
    // CAPTION first, art second — the corners.
    const marks = [...tile.children];
    expect(marks[0]?.getAttribute("data-testid")).toBe(CATEGORY_TILE_LABEL_TESTID);
  });
});

/**
 * THE STAGE RESERVES THE ROWS IT WILL DRAW, AND NO MORE.
 *
 * Six tiles in five columns is two rows; five in five is one. A stage holding
 * a fixed number of rows leaves the difference as an empty band under the last
 * tile, before whatever block comes next (~100px on the storefront's
 * `/c/transport` desktop). The rule is exported because a host holding the
 * box from outside this pair had nothing to ask and was guessing a height.
 */
describe("tileStageRows — the rows n tiles take in c columns", () => {
  it("is ceil(n / columns)", () => {
    expect(tileStageRows(6, 5)).toBe(2);
    expect(tileStageRows(5, 5)).toBe(1);
    expect(tileStageRows(1, 5)).toBe(1);
    expect(tileStageRows(10, 5)).toBe(2);
    expect(tileStageRows(11, 5)).toBe(3);
  });

  it("is ZERO rows for nothing, not one", () => {
    // A row reserved for no content is the hole an empty state replaces.
    expect(tileStageRows(0, 5)).toBe(0);
  });

  it("never divides by nothing", () => {
    expect(tileStageRows(6, 0)).toBe(6);
  });
});

describe("the reservation is one skeleton per tile, in the grid they land in", () => {
  async function reserved(count?: number): Promise<HTMLElement> {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          layout="wrap"
          reserve="pending"
          {...(count !== undefined ? { reserveCount: count } : {})}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-reserved-list")).toBeTruthy();
    });
    return screen.getByTestId("categories-tile-grid-reserved-list");
  }

  it("holds six tiles' worth when six are coming — two rows at five columns", async () => {
    const box = await reserved(6);
    expect(box.dataset["reservedTiles"]).toBe("6");
    expect(tileStageRows(6, 5)).toBe(2);
  });

  it("holds five when five are coming — one row at five columns", async () => {
    const box = await reserved(5);
    expect(box.dataset["reservedTiles"]).toBe("5");
    expect(tileStageRows(5, 5)).toBe(1);
  });

  it("still draws the arm's own four when nobody says", async () => {
    const box = await reserved();
    expect(box.dataset["reservedTiles"]).toBe("4");
  });
});

describe("the scroller declares no row it has no tile for", () => {
  it("drops to one row for a single tile", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid entries={ENTRIES.slice(0, 1)} allTile={false} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    // Two declared rows with one tile in them is an empty band and its gap.
    expect(
      screen.getByTestId("categories-tile-grid-list").style.gridTemplateRows
    ).toBe("repeat(1, auto)");
  });

  it("keeps the reference's two rows once there are two tiles", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid entries={ENTRIES} allTile={false} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    expect(
      screen.getByTestId("categories-tile-grid-list").style.gridTemplateRows
    ).toBe("repeat(2, auto)");
  });
});

/**
 * THE COMPACT TILE'S OWN AXIS.
 *
 * `size: "compact"` is a horizontal row half a tile high, and the owner's
 * 2026-09-04 anatomy put the name against one end of it and the picture
 * against the other. That is a CARD's arrangement for the same reason the
 * regular tile's corners were: the filled box is what makes two marks at
 * opposite ends read as one thing. Without a fill the row is two pieces of
 * scattered text with a gap in the middle — measured on the stand — so the
 * architect's verdict supersedes the 2026-09-04 ruling FOR THE FLAT SURFACE
 * ONLY: art first, caption second, adjacent, against the leading edge.
 *
 * Height, density and padding are the 2026-09-04 ruling either way; only the
 * arrangement inside the row moves.
 */
describe("size=compact + tileSurface=flat — a LIST ROW", () => {
  it("puts the art first and the caption second, adjacent", async () => {
    const tile = await mount("flat", "compact");
    const marks = [...tile.children];
    expect(marks.length).toBe(2);
    // ART leads; the caption follows it.
    expect(marks[0]?.getAttribute("data-testid")).not.toBe(
      CATEGORY_TILE_LABEL_TESTID
    );
    expect(marks[1]?.getAttribute("data-testid")).toBe(CATEGORY_TILE_LABEL_TESTID);
    // Adjacent, not at opposite ends: one gap between them and nothing
    // pushing them apart.
    expect(tile.style.justifyContent).toBe("flex-start");
    expect(tile.style.gap).toBe("8px");
  });

  it("is still a ROW, aligned on its centre line", async () => {
    const tile = await mount("flat", "compact");
    expect(tile.style.flexDirection).toBe("row");
    expect(tile.style.alignItems).toBe("center");
  });

  it("keeps the caption left-aligned and the half-tile height", async () => {
    const tile = await mount("flat", "compact");
    const caption = tile.querySelector<HTMLElement>(
      `[data-testid="${CATEGORY_TILE_LABEL_TESTID}"]`
    );
    // A list row's caption reads from the leading edge — never centred like
    // the regular flat tile's stack.
    expect(caption?.style.textAlign).toBe("start");
    // The 2026-09-04 height, untouched: only the arrangement moved.
    expect(tile.style.aspectRatio).toBe("8 / 3");
  });

  it("takes the same hover fill as every other flat tile", async () => {
    const tile = await mount("flat", "compact");
    expect(tile.classList.contains(CATEGORY_TILE_FLAT_CLASS)).toBe(true);
    expect(tile.style.background).toBe("");
  });
});

describe("size=compact + tileSurface=card — the 2026-09-04 anatomy, exactly", () => {
  it("keeps the caption first and the picture at the far end", async () => {
    const tile = await mount("card", "compact");
    const marks = [...tile.children];
    expect(marks[0]?.getAttribute("data-testid")).toBe(CATEGORY_TILE_LABEL_TESTID);
    expect(tile.style.justifyContent).toBe("space-between");
    expect(tile.style.flexDirection).toBe("row");
    expect(tile.style.aspectRatio).toBe("8 / 3");
    // And it still has the fill that made those opposite ends read as one.
    expect(tile.style.background).toBe("var(--stapel-surface-sunken)");
  });
});

describe("size=regular + tileSurface=flat is untouched by the row rule", () => {
  it("is still the centred stack", async () => {
    const tile = await mount("flat", "regular");
    expect(tile.style.justifyContent).toBe("center");
    expect(tile.style.alignItems).toBe("center");
    expect(tile.style.aspectRatio).toBe("4 / 3");
    const marks = [...tile.children];
    expect(marks[1]?.getAttribute("data-testid")).toBe(CATEGORY_TILE_LABEL_TESTID);
    const caption = tile.querySelector<HTMLElement>(
      `[data-testid="${CATEGORY_TILE_LABEL_TESTID}"]`
    );
    expect(caption?.style.textAlign).toBe("center");
  });
});

/**
 * THE CONTAINER TAKES THE TILES' OWN SURFACE.
 *
 * The tiles went flat and the box around them did not: `SkinTheme` defaults to
 * `surface="raised"`, so the whole component still painted `colorBgContainer`
 * — a lighter strip the width of the grid on the desktop catalogue page, a
 * full panel on the phone and behind the landing's compact strip (owner's read
 * of 0.29.0, dark). The same block fill the tiles just lost, one box further
 * out.
 *
 * Everything this file draws — the wrap grid, the scroller, the reserve box —
 * sits INSIDE that wrapper and paints nothing of its own, so the one gate is
 * all three; the tests below check the wrapper in each of the three shapes to
 * prove it rather than assume it.
 */
describe("the grid container is flat when the tiles are", () => {
  function container(): HTMLElement {
    const node = screen
      .getByTestId("categories-tile-grid")
      .closest<HTMLElement>("[data-stapel-skin-root]");
    expect(node, "the grid is not inside a skin root").not.toBeNull();
    return node as HTMLElement;
  }

  it("paints no background and no border at rest", async () => {
    await mount();
    const box = container();
    expect(box.dataset["stapelSkinSurface"]).toBe("bare");
    expect(box.style.backgroundColor).toBe("");
    expect(getComputedStyle(box).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(box).borderStyle).toBe("");
    expect(box.style.boxShadow).toBe("");
  });

  it("still anchors its text to the token, which `bare` would have dropped", async () => {
    await mount();
    // `raised` writes `colorText` as a frozen value; the flat arm states the
    // custom property instead, so both themes resolve at paint time.
    expect(container().style.color).toBe("var(--stapel-text)");
  });

  it("leaves the tiles' hover fill as the only fill in the box", async () => {
    await mount();
    // Over a painted panel the hover step is nearly invisible in the dark
    // theme; on the page ground it is the one fill there is.
    expect(getComputedStyle(container()).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(categoryTileCss()).toContain("background-color:var(--stapel-surface-sunken)");
  });

  it("is flat for the phone strip and the dense grid too", async () => {
    // The scroller (the landing's own shape) and the compact density draw
    // inside the same wrapper — one gate, and this is the proof.
    for (const props of [
      { density: "compact" as const },
      { size: "compact" as const },
      {},
    ]) {
      cleanup();
      render(
        <TestProviders server={mockServer(OK)}>
          <CategoryTileGrid entries={ENTRIES} allTile={false} {...props} />
        </TestProviders>
      );
      await waitFor(() => {
        expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
      });
      expect(container().dataset["stapelSkinSurface"]).toBe("bare");
      expect(getComputedStyle(container()).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    }
  });

  it("is flat around the RESERVE box as well", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid layout="wrap" reserve="pending" reserveCount={6} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-reserved-list")).toBeTruthy();
    });
    expect(container().dataset["stapelSkinSurface"]).toBe("bare");
  });

  it('keeps the panel under "card" — a grid of filled tiles was designed on it', async () => {
    await mount("card");
    const box = container();
    expect(box.dataset["stapelSkinSurface"]).toBe("raised");
    // The wrapper's own fill, exactly as it has always been written.
    expect(box.style.backgroundColor).not.toBe("");
    expect(getComputedStyle(box).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  });
});

/**
 * THE STRIP TAKES THE SAME SURFACE AS THE GRID.
 *
 * `<CategoryCarouselStrip>` is the landing's other row of tiles, and it had
 * the same two fills: `SkinTheme`'s default `raised` panel behind the row, and
 * an antd `Card` behind every entry inside it. One landing that is flat in one
 * row and panelled in the next is worse than either, so the strip takes the
 * same word, the same default and the same hover rule — `categoryTileCss()`
 * itself, not a second copy of it.
 */
describe("<CategoryCarouselStrip tileSurface> — flat is the default", () => {
  async function strip(surface?: "flat" | "card"): Promise<HTMLElement> {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryCarouselStrip
          {...(surface !== undefined ? { tileSurface: surface } : {})}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-carousel-list")).toBeTruthy();
    });
    return screen.getByTestId("categories-carousel-list");
  }

  function container(): HTMLElement {
    const node = screen
      .getByTestId("categories-carousel")
      .closest<HTMLElement>("[data-stapel-skin-root]");
    expect(node, "the strip is not inside a skin root").not.toBeNull();
    return node as HTMLElement;
  }

  it("paints no background and no border on the wrapper", async () => {
    await strip();
    const box = container();
    expect(box.dataset["stapelSkinSurface"]).toBe("bare");
    expect(box.style.backgroundColor).toBe("");
    expect(getComputedStyle(box).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(box).borderStyle).toBe("");
    expect(box.style.boxShadow).toBe("");
    // `bare` drops the text colour too — stated from the token instead.
    expect(box.style.color).toBe("var(--stapel-text)");
  });

  it("draws no card behind a tile, and the tile IS the link", async () => {
    const list = await strip();
    expect(list.querySelector(".ant-card")).toBeNull();
    const tile = list.querySelector<HTMLElement>(`.${CATEGORY_TILE_CLASS}`);
    expect(tile).not.toBeNull();
    expect(tile?.tagName).toBe("A");
    expect(tile?.classList.contains(CATEGORY_TILE_FLAT_CLASS)).toBe(true);
    // The whole tile is the target, and it carries no fill of its own.
    expect(tile?.style.background).toBe("");
    expect(tile?.style.backgroundColor).toBe("");
  });

  it("takes its hover fill from the GRID's rule set, not a second copy", async () => {
    await strip();
    // One sheet, deduped by `href`: a landing drawing both a strip and a grid
    // ships the rule once.
    expect(
      document.querySelectorAll(`style[data-href="${CATEGORY_TILE_STYLE_HREF}"]`)
        .length
    ).toBe(1);
    expect(categoryTileCss()).toContain(
      `.${CATEGORY_TILE_FLAT_CLASS}:hover,.${CATEGORY_TILE_FLAT_CLASS}:focus-visible{` +
        "background-color:var(--stapel-surface-sunken)}"
    );
  });

  it('keeps the panel and the cards under "card"', async () => {
    const list = await strip("card");
    expect(container().dataset["stapelSkinSurface"]).toBe("raised");
    expect(getComputedStyle(container()).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)"
    );
    expect(list.querySelector(".ant-card")).not.toBeNull();
    expect(list.querySelector(`.${CATEGORY_TILE_FLAT_CLASS}`)).toBeNull();
  });
});
