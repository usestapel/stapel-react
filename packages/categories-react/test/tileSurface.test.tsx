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
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  CATEGORY_TILE_CLASS,
  CATEGORY_TILE_FLAT_CLASS,
  CategoryTileGrid,
  categoryTileCss,
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
