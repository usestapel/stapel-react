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

async function mount(surface?: "flat" | "card"): Promise<HTMLElement> {
  render(
    <TestProviders server={mockServer(OK)}>
      <CategoryTileGrid
        entries={ENTRIES}
        // The «All» tile leads the grid and names its caption differently —
        // this suite is about an ordinary tile's own anatomy.
        allTile={false}
        {...(surface !== undefined ? { tileSurface: surface } : {})}
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
