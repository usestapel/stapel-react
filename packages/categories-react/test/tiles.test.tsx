/**
 * WHERE TILES STOP.
 *
 * The catalogue model has tiles for the top level and for a top-level
 * category's children, and nothing deeper: below that a category is a
 * characteristic chosen through cascading child selectors, not a tile a person
 * navigates into. These assertions are about the cap being a SHARED number and
 * about the deeper rows still existing — they are not offered, not deleted.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  MAX_TILE_DEPTH,
  categoryOffersTileGrid,
  nodeOffersTileGrid,
  buildCategoryTree,
  CategoryTree,
  categoryLabel,
} from "../src/index.js";
import { CategoryPage, CategoryTileGrid } from "../src/default/index.js";
import type { CarouselEntry, SubcategoryForm } from "../src/default/index.js";
import {
  PHONE_WIDTH,
  TestProviders,
  installViewport,
  mockServer,
  resetViewportListeners,
  setViewport,
  testStore,
} from "./harness.js";
import {
  ELECTRONICS,
  FEATURES,
  FULL_PAGE,
  LAPTOPS,
  PHONES,
  ROWS,
  USED_PHONES,
} from "./fixtures.js";

const OK = {
  "/categories/carousel/": { body: [ELECTRONICS] },
  "/features/": { body: FEATURES },
  "/categories/": { body: FULL_PAGE },
};

const CHILD_TILES: readonly CarouselEntry[] = [PHONES, LAPTOPS].map(
  (category) => ({
    category,
    label: categoryLabel(category),
    icon: null,
    href: `/c/${category.slug}`,
  })
);

beforeAll(() => {
  installViewport();
});
beforeEach(() => {
  resetViewportListeners();
  setViewport(PHONE_WIDTH);
});

describe("the depth cap is one number", () => {
  it("caps the TILE's depth, so a landing draws tiles only from the top level", () => {
    // The cap is on what appears AS a tile, not on the page drawing it: a
    // landing draws its children, one level below itself. Capping the landing
    // instead would put depth-2 rows — level 3 of the tree — on screen as
    // tiles, which is exactly what the model sends to a cascading selector.
    expect(MAX_TILE_DEPTH).toBe(1);
    expect(categoryOffersTileGrid(0)).toBe(true);
    expect(categoryOffersTileGrid(1)).toBe(false);
    expect(categoryOffersTileGrid(2)).toBe(false);
    expect(categoryOffersTileGrid(7)).toBe(false);
  });

  it("treats the catalogue ROOT as above every category", () => {
    // The home screen has no depth of its own, and inventing a `-1` for it
    // would put the rule's arithmetic in every caller.
    expect(categoryOffersTileGrid(undefined)).toBe(true);
    expect(categoryOffersTileGrid(null)).toBe(true);
    expect(nodeOffersTileGrid(null)).toBe(true);
  });

  it("reads a built node's own depth", () => {
    const index = buildCategoryTree(ROWS);
    const electronics = index.bySlug.get("electronics");
    const phones = index.bySlug.get("phones");
    const usedPhones = index.bySlug.get("used-phones");
    expect(electronics?.depth).toBe(0);
    expect(phones?.depth).toBe(1);
    expect(usedPhones?.depth).toBe(2);
    expect(nodeOffersTileGrid(electronics)).toBe(true);
    expect(nodeOffersTileGrid(phones)).toBe(false);
    expect(nodeOffersTileGrid(usedPhones)).toBe(false);
  });
});

describe("<CategoryTileGrid> honours the cap", () => {
  it("draws tiles for a top-level category's landing", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid entries={CHILD_TILES} categoryDepth={0} allTile={false} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
  });

  it("renders NOTHING one level down — those tiles would be level 3", async () => {
    const { container } = render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid entries={CHILD_TILES} categoryDepth={1} allTile={false} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(container.querySelector("[data-testid]")).toBeNull();
    });
  });

  it("renders NOTHING at all past the cap — not an empty state", async () => {
    // An empty state would claim the category has no sub-categories. It has
    // them; they are offered as a characteristic, somewhere else.
    const { container } = render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid entries={CHILD_TILES} categoryDepth={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(container.querySelector("[data-testid]")).toBeNull();
    });
    expect(screen.queryByTestId("categories-tile-grid")).toBeNull();
    expect(screen.queryByTestId("categories-tile-grid-empty")).toBeNull();
  });

  it("asks the carousel endpoint NOTHING past the cap", async () => {
    // A component that fetched and then hid the answer would pay for rows
    // nobody may see.
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryTileGrid categoryDepth={3} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.queryByTestId("categories-tile-grid")).toBeNull();
    });
    expect(server.queries("/categories/carousel/")).toHaveLength(0);
  });

  it("keeps drawing the home screen's tiles when no depth is given", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTileGrid />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
  });
});

function TreeTileProbe(props: { readonly slug?: string }): ReactElement {
  return (
    <CategoryTree
      store={testStore()}
      {...(props.slug !== undefined ? { slug: props.slug } : {})}
    >
      {(bag) => (
        <>
          <span data-testid="offers">{String(bag.offersTiles)}</span>
          <span data-testid="rows">
            {bag.state.status === "ready"
              ? bag.state.data.map((n) => n.category.slug).join(",")
              : bag.state.status}
          </span>
        </>
      )}
    </CategoryTree>
  );
}

describe("<CategoryTree> says whether its level may be tiles", () => {
  it("the catalogue root offers tiles", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <TreeTileProbe />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("rows").textContent).toBe(
        "electronics,vehicles"
      );
    });
    expect(screen.getByTestId("offers").textContent).toBe("true");
  });

  it("a top-level category's landing offers tiles", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <TreeTileProbe slug="electronics" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("rows").textContent).toBe("phones,laptops");
    });
    expect(screen.getByTestId("offers").textContent).toBe("true");
  });

  it("a deeper landing does not — and still hands over the rows", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <TreeTileProbe slug="phones" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("offers").textContent).toBe("false");
    });
    // Nothing is deleted: the sub-category is right there for a list, a
    // breadcrumb or a cascading selector to render.
    expect(screen.getByTestId("rows").textContent).toBe(USED_PHONES.slug);
  });
});

/**
 * ONE FORM OF SUB-CATEGORIES, AND THE OTHER NOT MOUNTED.
 *
 * The defect this closes is a host hiding a pair's output with a stylesheet: a
 * live classified deployment renders `<CategoryPage>` (a titled list) and
 * `<CategoryTileGrid>` together on `/c/<top-level>` and hides the list in CSS,
 * so the same links are in the DOM twice. Every assertion below is therefore
 * about ABSENCE FROM THE DOCUMENT, never about visibility — a test that
 * accepted a hidden node would pass against the exact bug it exists to stop.
 */
async function renderCategoryPage(form?: SubcategoryForm, slug = "electronics") {
  const result = render(
    <TestProviders server={mockServer(OK)}>
      <CategoryPage
        slug={slug}
        {...(form !== undefined ? { subcategories: form } : {})}
      />
    </TestProviders>
  );
  await waitFor(() => {
    expect(screen.getByTestId("categories-category-page")).toBeTruthy();
  });
  return result;
}

describe("<CategoryPage> renders exactly one form of sub-categories", () => {
  it("defaults to the pane, so no existing host changes behaviour", async () => {
    await renderCategoryPage();
    await waitFor(() => {
      expect(screen.getByTestId("categories-tree-list")).toBeTruthy();
    });
    expect(screen.queryByTestId("categories-tile-grid")).toBeNull();
    expect(screen.queryByTestId("categories-tile-grid-list")).toBeNull();
  });

  it("mounts the tiles and NOT the pane when asked for tiles", async () => {
    await renderCategoryPage("tiles");
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    expect(screen.queryByTestId("categories-tree")).toBeNull();
    expect(screen.queryByTestId("categories-tree-list")).toBeNull();
  });

  it("draws the category's own children as tiles, not the carousel's rows", async () => {
    // The carousel endpoint answers `electronics`; this landing IS
    // electronics, and what belongs on it is what is inside it.
    await renderCategoryPage("tiles");
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    const hrefs = [
      ...screen
        .getByTestId("categories-tile-grid-list")
        .querySelectorAll("a"),
    ].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/c/phones", "/c/laptops"]);
  });

  it("mounts NEITHER list when the host draws its own", async () => {
    await renderCategoryPage("none");
    expect(screen.queryByTestId("categories-tree")).toBeNull();
    expect(screen.queryByTestId("categories-tile-grid")).toBeNull();
  });

  it("past the cap the tiles arm renders nothing and does NOT fall back to the pane", async () => {
    // `phones` is depth 1, so its children are depth 2 — a level the canon
    // sends to a cascading selector. Falling back to the list here would
    // reintroduce browsing at exactly the depth the model removed it from.
    await renderCategoryPage("tiles", "phones");
    await waitFor(() => {
      expect(screen.getByTestId("categories-category-page")).toBeTruthy();
    });
    expect(screen.queryByTestId("categories-tile-grid")).toBeNull();
    expect(screen.queryByTestId("categories-tree")).toBeNull();
  });

  it("still says nothing for a LEAF, in either arm", async () => {
    // `laptops` has no children. "This category has no subcategories" belongs
    // on a page that came looking for them, not above the listings.
    for (const form of ["pane", "tiles"] as const) {
      const { unmount } = await renderCategoryPage(form, "laptops");
      expect(screen.queryByTestId("categories-tree")).toBeNull();
      expect(screen.queryByTestId("categories-tile-grid")).toBeNull();
      unmount();
    }
  });
});
