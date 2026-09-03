/**
 * A tile's art, and the order of its three arms.
 *
 * The pair's old rule was "never an `<img>`", which was really "never a
 * GUESSED url" — the library does not know a deployment's CDN base. Once a
 * catalogue is seeded, `catalog_icon` holds the uploaded asset's own address,
 * and refusing to draw THAT would be refusing to show art the server already
 * resolved. So: the host's `renderIcon` first, then an address the row already
 * carries, then the monogram — and an opaque reference is still never turned
 * into a URL.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryTileGrid } from "../src/default/index.js";
import type { CarouselEntry } from "../src/default/index.js";
import { categoryIconSrc, categoryLabel } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { ELECTRONICS, PHONES } from "./fixtures.js";

const SEEDED = "https://cdn.test/catalog/electronics.png";

function entry(icon: string | null): CarouselEntry {
  return {
    category: ELECTRONICS,
    label: categoryLabel(ELECTRONICS),
    icon,
    href: "/c/electronics",
  };
}

const OPAQUE = entry("catalog/electronics");
const ADDRESSED = entry(SEEDED);
const BARE: CarouselEntry = {
  category: PHONES,
  label: categoryLabel(PHONES),
  icon: null,
  href: "/c/phones",
};

function mount(entries: readonly CarouselEntry[], renderIcon?: () => string) {
  return render(
    <TestProviders server={mockServer({})}>
      <CategoryTileGrid
        entries={entries}
        allTile={false}
        {...(renderIcon !== undefined ? { renderIcon } : {})}
      />
    </TestProviders>
  );
}

describe("categoryIconSrc", () => {
  it("passes an address through, in the three forms a CDN sends one", () => {
    expect(categoryIconSrc(SEEDED)).toBe(SEEDED);
    expect(categoryIconSrc("//cdn.test/a.png")).toBe("//cdn.test/a.png");
    expect(categoryIconSrc("/media/a.png")).toBe("/media/a.png");
  });

  it("refuses everything a URL would have to be INVENTED from", () => {
    expect(categoryIconSrc("catalog/electronics")).toBeNull();
    expect(categoryIconSrc("")).toBeNull();
    expect(categoryIconSrc("   ")).toBeNull();
    expect(categoryIconSrc(null)).toBeNull();
    expect(categoryIconSrc(undefined)).toBeNull();
    // Nothing in this contract sends one, and a catalogue row must not be
    // able to put inline content into a storefront's menu.
    expect(categoryIconSrc("data:image/svg+xml;base64,AAA")).toBeNull();
  });
});

describe("<CategoryTileGrid> art", () => {
  it("draws the seeded picture, lazily, named by the category", () => {
    const { container } = mount([ADDRESSED]);
    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe(SEEDED);
    expect(image?.getAttribute("loading")).toBe("lazy");
    // The alt is the tile's own label, so picture and caption cannot disagree.
    expect(image?.getAttribute("alt")).toBe(screen.getByText("category.electronics").textContent);
    expect(image?.style.objectFit).toBe("contain");
    expect(image?.style.aspectRatio).toBe("3 / 2");
  });

  it("keeps the glyph for an opaque reference — no URL is invented", () => {
    const { container } = mount([OPAQUE]);
    expect(container.querySelector("img")).toBeNull();
    expect(
      container.querySelector('[data-stapel-tile-art="monogram"]')
    ).toBeTruthy();
  });

  it("keeps the glyph for a row with no reference at all", () => {
    const { container } = mount([BARE]);
    expect(container.querySelector("img")).toBeNull();
    expect(
      container.querySelector('[data-stapel-tile-art="monogram"]')
    ).toBeTruthy();
  });

  it("lets the host's renderIcon win over the server's address", () => {
    // The storefront hardcodes its root glyphs today; seeding the catalogue
    // must not take that override away.
    const { container } = mount([ADDRESSED], () => "host glyph");
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("host glyph");
  });
});
