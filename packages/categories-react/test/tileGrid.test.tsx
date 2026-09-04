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
    // One per tile, All included. The art fallback is the category's own
    // INITIAL, not a muted disc: a grid of identical grey circles reads as
    // images still loading, which is the state a live catalogue with no
    // uploaded art is permanently in.
    expect(
      list.querySelectorAll('[data-stapel-tile-art="monogram"]')
    ).toHaveLength(CAROUSEL.length + 1);
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
