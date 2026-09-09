/**
 * The two phone-landing surfaces: `<CategoryTileGrid>` and
 * `<CategoryQuickSearchPanel>`.
 *
 * What is worth asserting here is what each one REFUSES to do. The grid never
 * builds a URL out of an opaque icon reference and never leaves an art corner
 * empty; the panel never puts a number in its button unless the count it was
 * handed is a ready, countable one — a floor is spoken as a floor, and a
 * missing, in-flight or refused count is spoken as no number at all.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { loadFailed, loadLoading, loadReady } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import {
  CATEGORY_TILE_LABEL_TESTID,
  CategoryQuickSearchPanel,
  CategoryTileGrid,
} from "../src/default/index.js";
import type { CarouselEntry, QuickSearchCount } from "../src/default/index.js";
import { categoryLabel } from "../src/index.js";
import {
  PHONE_WIDTH,
  TestProviders,
  installViewport,
  mockServer,
  resetViewportListeners,
  setViewport,
} from "./harness.js";
import {
  ELECTRONICS,
  FULL_PAGE,
  LAPTOPS,
  PHONES,
  VEHICLES,
  categoryRow,
} from "./fixtures.js";

const CAROUSEL = [ELECTRONICS, VEHICLES];

/**
 * Rows a HOST hands in: a category's CHILDREN, which the carousel endpoint
 * does not serve at all. Built the way a container builds them — off the tree
 * it already has, through the pair's own `categoryLabel`.
 */
const CHILD_TILES: readonly CarouselEntry[] = [PHONES, LAPTOPS].map(
  (category) => ({
    category,
    label: categoryLabel(category),
    icon: null,
    href: `/c/${category.slug}`,
  })
);
const OK = {
  "/categories/carousel/": { body: CAROUSEL },
  "/categories/": { body: FULL_PAGE },
};

/**
 * Rows whose icon is already an ADDRESS, so `tileArt` draws `<img>` rather
 * than the monogram — what `eagerCount` (D242) has anything to say about.
 */
function imageEntry(id: number): CarouselEntry {
  const category = categoryRow(
    100 + id,
    `image-tile-${id}`,
    `category.imageTile${id}`,
    null,
    "",
    ""
  );
  return {
    category,
    label: categoryLabel(category),
    icon: `https://cdn.test/tile/${id}.png`,
    href: `/c/${category.slug}`,
  };
}

const IMAGE_TILES: readonly CarouselEntry[] = [1, 2, 3].map(imageEntry);
const MANY_IMAGE_TILES: readonly CarouselEntry[] = Array.from(
  { length: 10 },
  (_, i) => imageEntry(i + 1)
);
/** Past the overflow dialog's own search threshold (20) — see
 * `ALL_CATEGORIES_SEARCH_THRESHOLD` in `CategoryTileGrid.tsx`. */
const MANY_TILES_25: readonly CarouselEntry[] = Array.from(
  { length: 25 },
  (_, i) => imageEntry(i + 1)
);

beforeAll(() => {
  installViewport();
});
beforeEach(() => {
  resetViewportListeners();
  setViewport(PHONE_WIDTH);
});

describe("<CategoryTileGrid>", () => {
  it("leads with an All tile pointing at the base path, then one tile per row", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });

    const list = screen.getByTestId("categories-tile-grid-list");
    const links = [...list.querySelectorAll("a")];
    expect(links).toHaveLength(CAROUSEL.length + 1);
    expect(links[0]?.getAttribute("href")).toBe("/c");
    expect(screen.getByTestId("categories-tile-grid-all")).toBeTruthy();
    expect(links[1]?.getAttribute("href")).toBe("/c/electronics");
    expect(links[1]?.getAttribute("data-category-slug")).toBe("electronics");
  });

  it("honours basePath for the All tile and for every category tile", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid basePath="/catalogue" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    const links = [
      ...screen.getByTestId("categories-tile-grid-list").querySelectorAll("a"),
    ];
    expect(links[0]?.getAttribute("href")).toBe("/catalogue");
    expect(links[1]?.getAttribute("href")).toBe("/catalogue/electronics");
  });

  it("drops the All tile when the row is already inside a category", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid allTile={false} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    expect(screen.queryByTestId("categories-tile-grid-all")).toBeNull();
    expect(
      screen.getByTestId("categories-tile-grid-list").querySelectorAll("a")
    ).toHaveLength(CAROUSEL.length);
  });

  it("hands the OPAQUE reference to the host and builds no URL of its own", async () => {
    const seen: string[] = [];
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          renderIcon={(reference) => {
            seen.push(reference);
            return <span data-testid={`art-${reference}`} />;
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    // Only `electronics` carries a reference; `vehicles` does not, so the
    // resolver is asked about exactly one row and the other gets the glyph.
    expect(seen).toEqual(["carousel/electronics"]);
    expect(screen.getByTestId("art-carousel/electronics")).toBeTruthy();
    expect(
      screen.getByTestId("categories-tile-grid-list").querySelectorAll("img")
    ).toHaveLength(0);
  });

  it("draws the monogram — never a hole and never a guessed image — with no resolver", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    const list = screen.getByTestId("categories-tile-grid-list");
    // One per CATALOGUE ROW, and the All tile is not one of them. The art
    // fallback is the category's own INITIAL, not a muted disc: a grid of
    // identical grey circles reads as images still loading, which is the
    // state a live catalogue with no uploaded art is permanently in.
    //
    // The All tile used to be counted here too, and a phone walk of the
    // landing is what took it back out: it stands first among ten siblings
    // that all draw a picture, so a lone faint capital there read as an image
    // that had failed rather than as a fallback. It has no `catalog_icon` to
    // wait for — it is the grid's own control — so it draws a pictogram
    // instead (`test/tileLabelBreak.test.tsx`), and the monogram stays
    // exactly what it always was: the answer for a row whose art the
    // catalogue has not supplied.
    expect(
      list.querySelectorAll('[data-stapel-tile-art="monogram"]')
    ).toHaveLength(CAROUSEL.length);
    expect(
      list.querySelectorAll('[data-stapel-tile-art="all"]')
    ).toHaveLength(1);
    expect(list.querySelectorAll("img")).toHaveLength(0);
  });

  it("carries catalog_icon through when the row has no carousel_icon", async () => {
    // Both references are the empty string on the live deployment, so the
    // monogram is what renders there — but the CARRY has to work for a
    // deployment that has art, and the fallback order is `carousel_icon` then
    // `catalog_icon`. Only an end-to-end assertion catches a bag that drops
    // the second one.
    const seen: string[] = [];
    const withCatalogIconOnly = {
      ...VEHICLES,
      catalog_icon: "catalog/vehicles",
      carousel_icon: "",
    };
    render(
      <TestProviders
        server={mockServer({
          "/categories/carousel/": { body: [withCatalogIconOnly] },
          "/categories/": { body: FULL_PAGE },
        })}
      >
        <CategoryTileGrid
          allTile={false}
          renderIcon={(reference) => {
            seen.push(reference);
            return <span data-testid="art" />;
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    expect(seen).toEqual(["catalog/vehicles"]);
  });

  it("draws the host's own rows when `entries` is given", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid entries={CHILD_TILES} allTile={false} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    const links = [
      ...screen.getByTestId("categories-tile-grid-list").querySelectorAll("a"),
    ];
    expect(links).toHaveLength(CHILD_TILES.length);
    expect(links[0]?.getAttribute("href")).toBe("/c/phones");
    expect(links[1]?.getAttribute("href")).toBe("/c/laptops");
  });

  it("asks the server NOTHING on the override arm", async () => {
    // The carousel handler refuses. An implementation that mounted the bag and
    // then ignored its answer would still have made the call — and would still
    // pass a test that only looked at the rendered rows.
    const server = mockServer({
      "/categories/carousel/": { status: 503, body: {} },
    });
    render(
      <TestProviders server={server}>
        <CategoryTileGrid entries={CHILD_TILES} allTile={false} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    expect(server.queries("/categories/carousel/")).toHaveLength(0);
    expect(screen.queryByTestId("categories-tile-grid-failed")).toBeNull();
  });

  it("still leads with the All tile when the override keeps it", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid entries={CHILD_TILES} basePath="/catalogue" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-all")).toBeTruthy();
    });
    const links = [
      ...screen.getByTestId("categories-tile-grid-list").querySelectorAll("a"),
    ];
    expect(links[0]?.getAttribute("href")).toBe("/catalogue");
    expect(links).toHaveLength(CHILD_TILES.length + 1);
  });

  it("treats an EMPTY override as a real answer, not as 'ask the server'", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid entries={[]} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-empty")).toBeTruthy();
    });
    expect(screen.queryByTestId("categories-tile-grid-list")).toBeNull();
  });

  it("says the catalogue features nothing rather than spinning forever", async () => {
    render(
      <TestProviders server={mockServer({ "/categories/carousel/": { body: [] } })}>
        <CategoryTileGrid />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-empty")).toBeTruthy();
    });
    expect(screen.queryByTestId("categories-tile-grid-list")).toBeNull();
  });

  it("refuses with a retry, not with an empty row", async () => {
    render(
      <TestProviders
        server={mockServer({ "/categories/carousel/": { status: 503, body: {} } })}
      >
        <CategoryTileGrid />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-failed")).toBeTruthy();
    });
    expect(screen.queryByTestId("categories-tile-grid-empty")).toBeNull();
  });
});

function panelWith(count?: LoadState<QuickSearchCount>, locale?: string) {
  return render(
    <TestProviders
      server={mockServer(OK)}
      {...(locale !== undefined ? { locale } : {})}
    >
      <CategoryQuickSearchPanel
        heading="Find a car"
        ctaHref="/s?type=listing"
        {...(count !== undefined ? { count } : {})}
      />
    </TestProviders>
  );
}

describe("<CategoryQuickSearchPanel>", () => {
  it("counts in the button label when the answer is exact", () => {
    panelWith(loadReady({ count: 128, kind: "exact" }));
    expect(screen.getByTestId("categories-quick-search-cta").textContent).toBe(
      "Show 128 listings"
    );
  });

  it("speaks a lower bound as a floor, never as a total", () => {
    panelWith(loadReady({ count: 500, kind: "at_least" }));
    expect(screen.getByTestId("categories-quick-search-cta").textContent).toBe(
      "Show 500+ listings"
    );
  });

  it("puts no number in the label while loading, on a refusal, or with none at all", () => {
    const uncounted = [
      undefined,
      loadLoading(),
      loadFailed(new Error("engine down")),
      // `null` is "the engine cannot say" — and it must never render as 0.
      loadReady<QuickSearchCount>({ count: null, kind: "unknown" }),
      loadReady<QuickSearchCount>({ count: 0, kind: "unknown" }),
    ] as const;
    for (const count of uncounted) {
      const { unmount } = panelWith(count);
      expect(
        screen.getByTestId("categories-quick-search-cta").textContent
      ).toBe("Show listings");
      unmount();
    }
  });

  it("uses the locale's own plural form, not English's two", () => {
    panelWith(loadReady({ count: 2, kind: "exact" }), "ru");
    expect(screen.getByTestId("categories-quick-search-cta").textContent).toBe(
      "Показать 2 объявления"
    );
  });

  it("renders the host's fields and nothing where there are none", () => {
    const { unmount } = render(
      <TestProviders server={mockServer(OK)}>
        <CategoryQuickSearchPanel
          heading="Find a car"
          onSubmit={() => undefined}
          fields={<span data-testid="host-field" />}
        />
      </TestProviders>
    );
    expect(screen.getByTestId("host-field")).toBeTruthy();
    unmount();

    panelWith(loadReady({ count: 1, kind: "exact" }));
    expect(screen.queryByTestId("categories-quick-search-fields")).toBeNull();
  });

  it("takes the href seam so a middle-click still opens the search", () => {
    panelWith(loadReady({ count: 3, kind: "exact" }));
    expect(
      screen.getByTestId("categories-quick-search-cta").getAttribute("href")
    ).toBe("/s?type=listing");
  });
});

describe("tile density (the owner's ruling on tile size)", () => {
  // Measured on the live storefront: at 390px the cozy tile is ~143px wide and
  // the two-row grid pushes the feed ~240px down; on a 1440px catalogue column
  // the same fraction-of-container geometry inflates each tile to ~550px — a
  // wall of grey. "compact" answers both with one mechanism: more visible
  // columns AND an absolute cap on the column, so a wide container gets a
  // modest strip instead of billboards.
  function tileList(): HTMLElement {
    return screen.getByTestId("categories-tile-grid-list");
  }

  it("cozy (the default) keeps the reference geometry — 2.5 visible columns", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid />
      </TestProviders>
    );
    await waitFor(() => expect(tileList()).toBeTruthy());
    expect(tileList().style.gridAutoColumns).toContain("/ 2.5");
    expect(tileList().style.gridAutoColumns).not.toContain("min(");
  });

  it("compact shows 4+ columns and caps the column in absolute pixels", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid density="compact" />
      </TestProviders>
    );
    await waitFor(() => expect(tileList()).toBeTruthy());
    const columns = tileList().style.gridAutoColumns;
    expect(columns).toContain("min(");
    expect(columns).toContain("/ 4.4");
    expect(columns).toContain("128px");
  });

  it("compact still renders every tile — density changes geometry, not rows", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid density="compact" entries={CHILD_TILES} allTile={false} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(
        screen.getAllByTestId("categories-tile-grid-list")[0]?.querySelectorAll("a")
      ).toHaveLength(2)
    );
  });
});

describe("tile layout (the wrapping arm the storefront had to draw itself)", () => {
  function tileList(): HTMLElement {
    return screen.getByTestId("categories-tile-grid-list");
  }

  it("wrap drops the scroll port for an auto-fill grid at the default width", async () => {
    // The host had to draw its own home grid because this component only ever
    // scrolled: a wrapped grid is a different geometry, not a wider one.
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid layout="wrap" />
      </TestProviders>
    );
    await waitFor(() => expect(tileList()).toBeTruthy());
    const columns = tileList().style.gridTemplateColumns;
    expect(columns).toContain("auto-fill");
    expect(columns).toContain("240px");
    // No scroll port, and no fixed row count: every tile is on screen.
    expect(tileList().style.overflowX).toBe("");
    expect(tileList().style.gridAutoFlow).toBe("");
    // `min(…, 100%)`: a bare minimum overflows a container narrower than one
    // tile, which is the one thing this layout must not do.
    expect(columns).toContain("min(");
  });

  it("wrap takes the host's minimum tile width", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid layout="wrap" minTileWidth={160} />
      </TestProviders>
    );
    await waitFor(() => expect(tileList()).toBeTruthy());
    expect(tileList().style.gridTemplateColumns).toContain("160px");
  });

  it("wrap renders every tile — layout changes geometry, not rows", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid layout="wrap" entries={CHILD_TILES} allTile={false} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(tileList().querySelectorAll("a")).toHaveLength(2)
    );
    expect(tileList().dataset["stapelTileLayout"]).toBe("wrap");
  });

  it("the default is still the scroller — no existing host changes shape", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid />
      </TestProviders>
    );
    await waitFor(() => expect(tileList()).toBeTruthy());
    expect(tileList().dataset["stapelTileLayout"]).toBe("scroll");
    expect(tileList().style.overflowX).toBe("auto");
    expect(tileList().style.gridTemplateColumns).toBe("");
  });

  it("wrap's tile boxes reserve their aspect from the grid column alone — nothing here reads an image's own size", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid layout="wrap" entries={IMAGE_TILES} allTile={false} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(tileList().querySelectorAll("img")).toHaveLength(IMAGE_TILES.length)
    );
    for (const image of [...tileList().querySelectorAll("img")]) {
      // The tile itself and the art corner around the image are both sized by
      // a fixed aspect ratio, never by the `<img>`'s own natural dimensions —
      // jsdom never loads the asset, so a value here can only have come from
      // the inline style the component wrote, not from the image settling.
      expect(image.closest("a")?.style.aspectRatio).toBe("4 / 3");
      expect(image.parentElement?.style.aspectRatio).toBe("3 / 2");
      expect(image.parentElement?.style.width).toBe("60%");
    }
  });
});

describe("eager loading (D242 — the first row must not depend on scroll)", () => {
  function tileList(): HTMLElement {
    return screen.getByTestId("categories-tile-grid-list");
  }

  it("defaults to the first 8 tiles eager, the rest lazy", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid entries={MANY_IMAGE_TILES} allTile={false} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(tileList().querySelectorAll("img")).toHaveLength(
        MANY_IMAGE_TILES.length
      )
    );
    const images = [...tileList().querySelectorAll("img")];
    images.slice(0, 8).forEach((image) => {
      expect(image.getAttribute("loading")).toBe("eager");
      expect(image.getAttribute("fetchpriority")).toBe("high");
    });
    images.slice(8).forEach((image) => {
      expect(image.getAttribute("loading")).toBe("lazy");
      expect(image.hasAttribute("fetchpriority")).toBe(false);
    });
  });

  it("honours a host's own eagerCount", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={IMAGE_TILES}
          allTile={false}
          eagerCount={1}
        />
      </TestProviders>
    );
    await waitFor(() =>
      expect(tileList().querySelectorAll("img")).toHaveLength(
        IMAGE_TILES.length
      )
    );
    const images = [...tileList().querySelectorAll("img")];
    expect(images[0]?.getAttribute("loading")).toBe("eager");
    expect(images[0]?.getAttribute("fetchpriority")).toBe("high");
    expect(images[1]?.getAttribute("loading")).toBe("lazy");
    expect(images[1]?.hasAttribute("fetchpriority")).toBe(false);
  });

  it("the All tile takes no eager slot — it never carries an image", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={IMAGE_TILES}
          eagerCount={1}
        />
      </TestProviders>
    );
    await waitFor(() =>
      expect(tileList().querySelectorAll("img")).toHaveLength(
        IMAGE_TILES.length
      )
    );
    // The All tile is index 0 in the DOM and has no `<img>` at all; the
    // eagerCount is spent on the first CATEGORY tile, not on it.
    expect(screen.getByTestId("categories-tile-grid-all").querySelector("img")).toBeNull();
    const images = [...tileList().querySelectorAll("img")];
    expect(images[0]?.getAttribute("loading")).toBe("eager");
  });
});

describe("tile size (the reference's second-level tile, owner's ruling 2026-09-04)", () => {
  function tileList(): HTMLElement {
    return screen.getByTestId("categories-tile-grid-list");
  }

  it("regular (the default) keeps the reference root anatomy — a vertical tile", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid entries={CHILD_TILES} allTile={false} />
      </TestProviders>
    );
    await waitFor(() => expect(tileList().querySelectorAll("a")).toHaveLength(2));
    const tile = tileList().querySelectorAll("a")[0] as HTMLElement;
    expect(tile.style.flexDirection).toBe("column");
    expect(tile.style.aspectRatio).toBe("4 / 3");
  });

  it("compact is a horizontal row — name left, small picture right, ~half the height", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid entries={CHILD_TILES} allTile={false} size="compact" />
      </TestProviders>
    );
    await waitFor(() => expect(tileList().querySelectorAll("a")).toHaveLength(2));
    const tile = tileList().querySelectorAll("a")[0] as HTMLElement;
    expect(tile.style.flexDirection).toBe("row");
    // 8 / 3 is half the height of the regular tile's 4 / 3 at the same width.
    expect(tile.style.aspectRatio).toBe("8 / 3");
  });

  it("compact denser wrap grid defaults to 220px, not the regular 240px", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={CHILD_TILES}
          allTile={false}
          size="compact"
          layout="wrap"
        />
      </TestProviders>
    );
    await waitFor(() => expect(tileList()).toBeTruthy());
    expect(tileList().style.gridTemplateColumns).toContain("220px");
  });

  it("a host's own minTileWidth still wins over the compact default", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={CHILD_TILES}
          allTile={false}
          size="compact"
          layout="wrap"
          minTileWidth={180}
        />
      </TestProviders>
    );
    await waitFor(() => expect(tileList()).toBeTruthy());
    expect(tileList().style.gridTemplateColumns).toContain("180px");
  });
});

/**
 * The label's clamp, and the ONE number of it a deployment owns.
 *
 * The clamp is the only part of a tile's label that depends on the CATALOGUE's
 * words rather than on the tile: the storefront's longest root name needs a
 * third line on an anatomy the skin measured at two. Before `labelLines` the
 * only way to say so was an `!important` rule from outside — and the deployed
 * one aimed at `span:first-child`, which stopped being the label the moment
 * `density="compact"` drew its art first, so the override had been a silent
 * no-op on that surface. That is the shape of defect this prop exists to
 * retire, so the assertions below read the computed inline clamp of the label
 * in EVERY anatomy, not of whichever span happens to come first.
 */
describe("the label's clamp: labelLines", () => {
  function tileList(): HTMLElement {
    return screen.getByTestId("categories-tile-grid-list");
  }

  /** The clamp as the DOM holds it — the property the browser reads, not the
   * React prop that wrote it. */
  function clampOf(element: Element): string {
    return (element as HTMLElement).style.getPropertyValue(
      "-webkit-line-clamp"
    );
  }

  /** Every tile's label span, in whichever position its anatomy puts it: the
   * label is the span that carries the clamp, and the art corner never does. */
  function labels(): readonly HTMLElement[] {
    return [...tileList().querySelectorAll("a")].map((tile) => {
      const found = [...tile.querySelectorAll("span")].find(
        (span) => clampOf(span) !== ""
      );
      if (found === undefined) throw new Error("no clamped label in this tile");
      return found;
    });
  }

  it("defaults to three lines on the regular tile", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid entries={CHILD_TILES} allTile={false} />
      </TestProviders>
    );
    await waitFor(() => expect(tileList().querySelectorAll("a")).toHaveLength(2));
    for (const label of labels()) expect(clampOf(label)).toBe("3");
  });

  it("defaults to two lines on the compact density — the phone scroller's square", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={CHILD_TILES}
          allTile={false}
          density="compact"
        />
      </TestProviders>
    );
    await waitFor(() => expect(tileList().querySelectorAll("a")).toHaveLength(2));
    for (const label of labels()) expect(clampOf(label)).toBe("2");
    // And the label is the SECOND span here — the art is drawn first, which is
    // exactly what a host stylesheet aiming at `span:first-child` gets wrong.
    const tile = tileList().querySelectorAll("a")[0] as HTMLElement;
    expect(clampOf(tile.children[0] as HTMLElement)).toBe("");
  });

  it("defaults to two lines on the compact size — a horizontal row has no third", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={CHILD_TILES}
          allTile={false}
          size="compact"
        />
      </TestProviders>
    );
    await waitFor(() => expect(tileList().querySelectorAll("a")).toHaveLength(2));
    for (const label of labels()) expect(clampOf(label)).toBe("2");
  });

  it("takes a host's own count on the compact density (the storefront's third line)", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={CHILD_TILES}
          allTile={false}
          density="compact"
          labelLines={3}
        />
      </TestProviders>
    );
    await waitFor(() => expect(tileList().querySelectorAll("a")).toHaveLength(2));
    for (const label of labels()) expect(clampOf(label)).toBe("3");
  });

  it("reaches the All tile and the overflow tile too — not only the category rows", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={MANY_IMAGE_TILES}
          maxVisible={3}
          overflow="modal"
          labelLines={1}
        />
      </TestProviders>
    );
    await waitFor(() => expect(screen.getByTestId("categories-tile-grid-more")).toBeTruthy());
    // The All tile's label carries the grid's own testid.
    expect(clampOf(screen.getByTestId("categories-tile-grid-all"))).toBe("1");
    const more = screen.getByTestId("categories-tile-grid-more");
    const moreLabel = [...more.querySelectorAll("span")].find(
      (span) => clampOf(span) !== ""
    );
    expect(clampOf(moreLabel as HTMLElement)).toBe("1");
  });

  it("moves ONLY the clamp — the anatomy keeps its own size, alignment and break rules", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={CHILD_TILES}
          allTile={false}
          size="compact"
          labelLines={4}
        />
      </TestProviders>
    );
    await waitFor(() => expect(tileList().querySelectorAll("a")).toHaveLength(2));
    const label = labels()[0] as HTMLElement;
    expect(clampOf(label)).toBe("4");
    // The compact row's own label, unchanged: its type size, its start
    // alignment, and the two rules that keep a long caption readable.
    expect(label.style.fontSize).toBe("13px");
    expect(label.style.textAlign).toBe("start");
    expect(label.style.hyphens).toBe("manual");
    expect(label.style.overflowWrap).toBe("anywhere");
  });
});

describe("tile overflow — «Все категории» past maxVisible (owner's ruling 2026-09-04)", () => {
  function tileList(): HTMLElement {
    return screen.getByTestId("categories-tile-grid-list");
  }

  it("overflow: 'none' (the default) ignores maxVisible — every row still draws", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid entries={MANY_IMAGE_TILES} allTile={false} maxVisible={3} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(tileList().querySelectorAll("a")).toHaveLength(MANY_IMAGE_TILES.length)
    );
    expect(screen.queryByTestId("categories-tile-grid-more")).toBeNull();
  });

  it("overflow: 'modal' caps the grid at maxVisible and draws the overflow tile", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={MANY_IMAGE_TILES}
          allTile={false}
          maxVisible={3}
          overflow="modal"
        />
      </TestProviders>
    );
    await waitFor(() => expect(tileList().querySelectorAll("a")).toHaveLength(3));
    expect(screen.getByTestId("categories-tile-grid-more")).toBeTruthy();
    // Not yet opened.
    expect(screen.queryByTestId("categories-tile-grid-dialog")).toBeNull();
  });

  it("the overflow tile opens a dialog listing EVERY child, not only the hidden ones", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={MANY_IMAGE_TILES}
          allTile={false}
          maxVisible={3}
          overflow="modal"
        />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("categories-tile-grid-more")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("categories-tile-grid-more"));
    await waitFor(() =>
      expect(screen.getByTestId("categories-tile-grid-dialog")).toBeTruthy()
    );
    expect(
      screen
        .getByTestId("categories-tile-grid-dialog-list")
        .querySelectorAll("a")
    ).toHaveLength(MANY_IMAGE_TILES.length);
  });

  it("carries no search box under the threshold", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid entries={CHILD_TILES} allTile={false} maxVisible={1} overflow="modal" />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("categories-tile-grid-more")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("categories-tile-grid-more"));
    await waitFor(() =>
      expect(screen.getByTestId("categories-tile-grid-dialog")).toBeTruthy()
    );
    expect(screen.queryByTestId("categories-tile-grid-dialog-search")).toBeNull();
    expect(
      screen
        .getByTestId("categories-tile-grid-dialog-list")
        .querySelectorAll("a")
    ).toHaveLength(CHILD_TILES.length);
  });

  it("grows a search box past the threshold and filters the list by label", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={MANY_TILES_25}
          allTile={false}
          maxVisible={3}
          overflow="modal"
        />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("categories-tile-grid-more")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("categories-tile-grid-more"));
    const search = await screen.findByTestId("categories-tile-grid-dialog-search");
    expect(
      screen
        .getByTestId("categories-tile-grid-dialog-list")
        .querySelectorAll("a")
    ).toHaveLength(25);

    fireEvent.change(search, { target: { value: "imageTile5" } });
    await waitFor(() =>
      expect(
        screen
          .getByTestId("categories-tile-grid-dialog-list")
          .querySelectorAll("a")
      ).toHaveLength(1)
    );
  });

  it("an unmatched search empties the list with a sentence, not silence", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={MANY_TILES_25}
          allTile={false}
          maxVisible={3}
          overflow="modal"
        />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("categories-tile-grid-more")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("categories-tile-grid-more"));
    const search = await screen.findByTestId("categories-tile-grid-dialog-search");
    fireEvent.change(search, { target: { value: "no such category" } });
    await waitFor(() =>
      expect(screen.getByTestId("categories-tile-grid-dialog-empty")).toBeTruthy()
    );
    expect(screen.queryByTestId("categories-tile-grid-dialog-list")).toBeNull();
  });

  it("Escape closes the dialog — SkinDialog's own keyboard affordance", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={MANY_IMAGE_TILES}
          allTile={false}
          maxVisible={3}
          overflow="modal"
        />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("categories-tile-grid-more")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("categories-tile-grid-more"));
    await waitFor(() =>
      expect(screen.getByTestId("categories-tile-grid-dialog")).toBeTruthy()
    );
    fireEvent.keyDown(screen.getByTestId("categories-tile-grid-dialog"), {
      key: "Escape",
      code: "Escape",
    });
    await waitFor(() =>
      expect(screen.queryByTestId("categories-tile-grid-dialog")).toBeNull()
    );
  });
});

describe("reserve — the box a HOST-owned fetch will land in", () => {
  /**
   * The `entries` override skips this component's own loading arm on purpose
   * (the host owns that read), and the hole it leaves is a layout shift: the
   * row appears a beat later and pushes everything under it. The storefront
   * held a hand-guessed height in its own stylesheet instead; `reserve` hands
   * back the box the pair already draws.
   */
  it("holds the loading arm's own box while the host has handed nothing over", () => {
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryTileGrid reserve allTile={false} />
      </TestProviders>
    );
    const reserved = screen.getByTestId("categories-tile-grid-reserved");
    // The same busy region every other pending surface in the fleet renders.
    expect(reserved.getAttribute("role")).toBe("status");
    expect(reserved.getAttribute("aria-busy")).toBe("true");
    expect(reserved.getAttribute("data-stapel-load-state")).toBe("loading");
    // The box is the ROW's geometry with the row's own tile ratio in it —
    // not an approximation of it.
    const box = reserved.firstElementChild as HTMLElement | null;
    expect(box?.style.display).toBe("grid");
    expect(
      [...reserved.querySelectorAll<HTMLElement>("[style]")].filter(
        (node) => node.style.aspectRatio === "4 / 3"
      ).length
    ).toBe(4);
    // And it costs the server nothing: the carousel is not mounted.
    expect(server.calls).toHaveLength(0);
    expect(screen.queryByTestId("categories-tile-grid-list")).toBeNull();
  });

  it("gives the box up the moment rows arrive", async () => {
    const server = mockServer(OK);
    const { rerender } = render(
      <TestProviders server={server}>
        <CategoryTileGrid reserve allTile={false} />
      </TestProviders>
    );
    expect(screen.getByTestId("categories-tile-grid-reserved")).toBeTruthy();
    rerender(
      <TestProviders server={server}>
        <CategoryTileGrid reserve entries={CHILD_TILES} allTile={false} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy()
    );
    expect(screen.queryByTestId("categories-tile-grid-reserved")).toBeNull();
    expect(server.calls).toHaveLength(0);
  });

  it("treats an EMPTY array as a real answer, not as a load still in flight", () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid reserve entries={[]} allTile={false} />
      </TestProviders>
    );
    expect(screen.queryByTestId("categories-tile-grid-reserved")).toBeNull();
    expect(screen.getByTestId("categories-tile-grid-empty")).toBeTruthy();
  });

  it('"pending" holds the box over rows the host still has in hand', () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid reserve="pending" entries={CHILD_TILES} allTile={false} />
      </TestProviders>
    );
    expect(screen.getByTestId("categories-tile-grid-reserved")).toBeTruthy();
    expect(screen.queryByTestId("categories-tile-grid-list")).toBeNull();
  });

  it("reserves NOTHING past the depth cap, where there are no tiles to expect", () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid reserve categoryDepth={5} />
      </TestProviders>
    );
    expect(screen.queryByTestId("categories-tile-grid")).toBeNull();
    expect(screen.queryByTestId("categories-tile-grid-reserved")).toBeNull();
  });

  it("changes nothing for a host that does not ask for it", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy()
    );
    expect(screen.queryByTestId("categories-tile-grid-reserved")).toBeNull();
  });
});

describe("the box a row waits in is the shape of the row that arrives", () => {
  /**
   * The loading arm drew every skeleton at 4/3 — the COZY tile's ratio — while
   * a `density="compact"` tile is a square and a `size="compact"` tile is 8/3.
   * So the row was one height while it waited and another when it landed:
   * 0.024 of layout shift on the storefront's home, paid on every cold load,
   * by the very arm that exists to prevent it.
   */
  function reservedRatios(): string[] {
    const reserved = screen.getByTestId("categories-tile-grid-reserved");
    return [...reserved.querySelectorAll<HTMLElement>("[style]")]
      .map((node) => node.style.aspectRatio)
      .filter((ratio) => ratio.length > 0);
  }

  it("reserves SQUARES for the compact density, which draws squares", () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid reserve density="compact" allTile={false} />
      </TestProviders>
    );
    expect(reservedRatios()).toEqual(["1 / 1", "1 / 1", "1 / 1", "1 / 1"]);
  });

  it("reserves the compact SIZE's own row shape", () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid reserve size="compact" allTile={false} />
      </TestProviders>
    );
    expect(reservedRatios()).toEqual(["8 / 3", "8 / 3", "8 / 3", "8 / 3"]);
  });

  it("keeps 4/3 for the cozy tile it always drew", () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid reserve allTile={false} />
      </TestProviders>
    );
    expect(reservedRatios()).toEqual(["4 / 3", "4 / 3", "4 / 3", "4 / 3"]);
  });

  it("is the same shape the carousel arm waits in", async () => {
    // One measurement, both arms: the pair's own loading arm and the host's
    // reservation must not disagree about the row they are holding.
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid density="compact" />
      </TestProviders>
    );
    const loading = screen.getByTestId("categories-tile-grid-loading");
    expect(
      [...loading.querySelectorAll<HTMLElement>("[style]")]
        .map((node) => node.style.aspectRatio)
        .filter((ratio) => ratio.length > 0)
    ).toEqual(["1 / 1", "1 / 1", "1 / 1", "1 / 1"]);
    await waitFor(() =>
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy()
    );
  });
});

/**
 * THE CAPTION HAS A NAME NOW.
 *
 * The gap a storefront integrator named by hand: an ordinary tile's caption
 * was an unnamed `<span>` inside the tile link, and WHICH span it is depends
 * on the anatomy — first on the regular and `size="compact"` tiles, second on
 * `density="compact"`, whose art leads. Everything reaching for it by
 * position therefore aims at the label on one surface and at the art on the
 * next, and reports a number either way: that is the `span:first-child`
 * `!important` clamp `labelLines` retired, and then a stand probe that read
 * `-webkit-line-clamp` off the tile LINK (`none`, on a page where the clamp
 * works) and counted the art box and the monogram among the caption's lines.
 *
 * So the assertions below do what a probe should be able to do: find the
 * caption by NAME in all three anatomies, and read the clamp off it.
 */
describe("the caption's test id", () => {
  function captions(): readonly HTMLElement[] {
    return screen.getAllByTestId(CATEGORY_TILE_LABEL_TESTID);
  }

  it("names the caption in all three anatomies, and it is the clamped span every time", async () => {
    for (const anatomy of [
      {},
      { density: "compact" as const },
      { size: "compact" as const },
    ]) {
      const view = render(
        <TestProviders server={mockServer(OK)}>
          <CategoryTileGrid entries={CHILD_TILES} allTile={false} {...anatomy} />
        </TestProviders>
      );
      await waitFor(() =>
        expect(
          screen.getByTestId("categories-tile-grid-list").querySelectorAll("a")
        ).toHaveLength(2)
      );
      const found = captions();
      expect(found).toHaveLength(2);
      expect(found.map((span) => span.textContent)).toEqual([
        "category.phones",
        "category.laptops",
      ]);
      // The named span IS the one carrying the clamp — a name pointing at the
      // art corner would read as coverage and measure nothing.
      for (const span of found) {
        expect(span.style.getPropertyValue("-webkit-line-clamp")).not.toBe("");
      }
      view.unmount();
    }
  });

  it("is the exported constant, so a host does not retype the string", () => {
    expect(CATEGORY_TILE_LABEL_TESTID).toBe("categories-tile-label");
  });

  it("leaves the two special tiles' own, older names exactly where they were", async () => {
    // `categories-tile-grid-all` is already ON the caption span, and a test
    // reading the clamp off it points at the right element. Renaming it to
    // share the new id would move nothing and break that.
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid
          entries={MANY_IMAGE_TILES}
          maxVisible={3}
          overflow="modal"
        />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("categories-tile-grid-more")).toBeTruthy()
    );
    const all = screen.getByTestId("categories-tile-grid-all");
    expect(all.tagName).toBe("SPAN");
    expect(all.style.getPropertyValue("-webkit-line-clamp")).not.toBe("");
    // …and every ORDINARY tile in the same grid answers to the shared name.
    expect(captions().length).toBeGreaterThanOrEqual(3);
  });
});
