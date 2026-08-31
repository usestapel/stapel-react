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
import { render, screen, waitFor } from "@testing-library/react";
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
import { ELECTRONICS, FULL_PAGE, LAPTOPS, PHONES, VEHICLES } from "./fixtures.js";

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

  it("draws a placeholder — never a hole and never a guessed image — with no resolver", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    const list = screen.getByTestId("categories-tile-grid-list");
    // One per tile, All included.
    expect(
      list.querySelectorAll('[data-stapel-tile-art="placeholder"]')
    ).toHaveLength(CAROUSEL.length + 1);
    expect(list.querySelectorAll("img")).toHaveLength(0);
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
