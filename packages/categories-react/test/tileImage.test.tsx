/**
 * A tile's art, and the order of its three arms.
 *
 * The pair's old rule was "never an `<img>`", which was really "never a
 * GUESSED url" — the library does not know a deployment's CDN base. Once a
 * catalogue is seeded, `catalog_icon` holds the uploaded asset's own address,
 * and refusing to draw THAT would be refusing to show art the server already
 * resolved. So: the host's `renderIcon` first, then an address — the host's
 * `resolveIconSrc`, else the row's own field — and then the monogram. An
 * opaque reference is still never turned into a URL by the library, and every
 * arm may DECLINE rather than swallow the row.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryTileGrid } from "../src/default/index.js";
import type {
  CarouselEntry,
  CategoryTileGridProps,
} from "../src/default/index.js";
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

type ArtProps = Pick<CategoryTileGridProps, "renderIcon" | "resolveIconSrc">;

function mount(entries: readonly CarouselEntry[], art: ArtProps = {}) {
  return render(
    <TestProviders server={mockServer({})}>
      <CategoryTileGrid entries={entries} allTile={false} {...art} />
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
    const { container } = mount([ADDRESSED], {
      renderIcon: () => "host glyph",
    });
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("host glyph");
  });
});

describe("every arm may DECLINE — the defect the storefront reported", () => {
  // `renderIcon` used to be returned whenever the row carried a reference, so
  // a host with glyphs for five roots and `null` for everything else switched
  // the other two arms off for the whole catalogue: no seeded picture, no
  // monogram, an empty art corner on every other tile.
  it("a renderIcon returning null falls through to the row's own address", () => {
    const { container } = mount([ADDRESSED], { renderIcon: () => null });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(SEEDED);
  });

  it("a renderIcon returning null falls through to the monogram", () => {
    const { container } = mount([OPAQUE], { renderIcon: () => null });
    expect(container.querySelector("img")).toBeNull();
    expect(
      container.querySelector('[data-stapel-tile-art="monogram"]')
    ).toBeTruthy();
  });
});

describe("resolveIconSrc — an address for an opaque reference", () => {
  it("addresses the reference the library refuses to guess at", () => {
    // The host knows its CDN; the library does not. The seam takes the
    // CATEGORY, so a host with a store of opaque refs answers from the row
    // without projecting the whole catalogue into new entries.
    const { container } = mount([OPAQUE], {
      resolveIconSrc: (category) => `https://cdn.test/x/${category.slug}.png`,
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn.test/x/electronics.png"
    );
  });

  it("a resolver that DECLINES leaves the row's own address in place", () => {
    const { container } = mount([ADDRESSED], {
      resolveIconSrc: () => undefined,
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(SEEDED);
  });

  it("a resolver that declines a row with no address draws the monogram", () => {
    const { container } = mount([BARE], { resolveIconSrc: () => undefined });
    expect(container.querySelector("img")).toBeNull();
    expect(
      container.querySelector('[data-stapel-tile-art="monogram"]')
    ).toBeTruthy();
  });

  it("a resolver's answer still goes through categoryIconSrc", () => {
    // The rule survives the seam: what comes back has to BE an address, so a
    // resolver handing over a reference or a data: URI draws the glyph rather
    // than putting either into an `<img src>`.
    const { container } = mount([OPAQUE], {
      resolveIconSrc: () => "catalog/electronics",
    });
    expect(container.querySelector("img")).toBeNull();
    expect(
      container.querySelector('[data-stapel-tile-art="monogram"]')
    ).toBeTruthy();
  });

  it("renderIcon still wins over a resolver — the order is the contract", () => {
    const { container } = mount([OPAQUE], {
      renderIcon: () => "host glyph",
      resolveIconSrc: () => SEEDED,
    });
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("host glyph");
  });
});
