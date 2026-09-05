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
  rowRoutes,
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
  categoryRow,
} from "./fixtures.js";

const OK = {
  "/categories/carousel/": { body: [ELECTRONICS] },
  "/features/": { body: FEATURES },
  "/categories/": { body: FULL_PAGE },
  ...rowRoutes(ROWS),
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
async function renderCategoryPage(
  props: {
    readonly subcategories?: SubcategoryForm;
    readonly subcategoryLayout?: "scroll" | "wrap";
    readonly subcategoryMinTileWidth?: number;
    readonly breadcrumbs?: boolean;
    readonly slug?: string;
    readonly categoryId?: number;
    readonly gutter?: boolean;
    readonly server?: ReturnType<typeof mockServer>;
  } = {}
) {
  const { slug = "electronics", categoryId, server, ...rest } = props;
  const result = render(
    <TestProviders server={server ?? mockServer(OK)}>
      {categoryId === undefined ? (
        <CategoryPage slug={slug} {...rest} />
      ) : (
        <CategoryPage categoryId={categoryId} {...rest} />
      )}
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
    await renderCategoryPage({ subcategories: "tiles" });
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    expect(screen.queryByTestId("categories-tree")).toBeNull();
    expect(screen.queryByTestId("categories-tree-list")).toBeNull();
  });

  it("draws the category's own children as tiles, not the carousel's rows", async () => {
    // The carousel endpoint answers `electronics`; this landing IS
    // electronics, and what belongs on it is what is inside it.
    await renderCategoryPage({ subcategories: "tiles" });
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

  it("every tile carries the category's ID, so a host can route without the catalogue", async () => {
    // `/c/:slug` has no server-side lookup, so a cold slug costs the whole
    // table. The link that got there knows the id; carrying it is what lets a
    // router host hand the destination the cheap address.
    await renderCategoryPage({ subcategories: "tiles" });
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    const ids = [
      ...screen.getByTestId("categories-tile-grid-list").querySelectorAll("a"),
    ].map((a) => a.getAttribute("data-category-id"));
    expect(ids).toEqual([String(PHONES.id), String(LAPTOPS.id)]);
  });

  it("the tiles arm's default layout is still the scroller — D244", async () => {
    // No existing host changes shape: a 5-tile page must ask for `wrap`
    // explicitly rather than getting it because the host has 5 children.
    await renderCategoryPage({ subcategories: "tiles" });
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    expect(
      screen.getByTestId("categories-tile-grid-list").dataset["stapelTileLayout"]
    ).toBe("scroll");
  });

  it("subcategoryLayout=\"wrap\" reaches the tile grid, so 5 children fill the row instead of a scroller corner — D244", async () => {
    await renderCategoryPage({
      subcategories: "tiles",
      subcategoryLayout: "wrap",
    });
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    const list = screen.getByTestId("categories-tile-grid-list");
    expect(list.dataset["stapelTileLayout"]).toBe("wrap");
    expect(list.style.gridTemplateColumns).toContain("auto-fill");
  });

  it("subcategoryMinTileWidth passes through to the wrap arm", async () => {
    await renderCategoryPage({
      subcategories: "tiles",
      subcategoryLayout: "wrap",
      subcategoryMinTileWidth: 300,
    });
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    expect(
      screen.getByTestId("categories-tile-grid-list").style.gridTemplateColumns
    ).toContain("300px");
  });

  it("mounts NEITHER list when the host draws its own", async () => {
    await renderCategoryPage({ subcategories: "none" });
    expect(screen.queryByTestId("categories-tree")).toBeNull();
    expect(screen.queryByTestId("categories-tile-grid")).toBeNull();
  });

  it("past the cap the tiles HAND OVER to the cascade — never to nothing, never to the pane", async () => {
    // `phones` is depth 1, so its children are depth 2 — a level the canon
    // sends to a cascading selector. Rendering nothing here is what made 2924
    // of 2924 active leaves unreachable from a phone on a live catalogue;
    // falling back to the list would reintroduce browsing at exactly the depth
    // the model removed it from. The ladder is the third answer, and the only
    // one the canon names.
    await renderCategoryPage({ subcategories: "tiles", slug: "phones" });
    await waitFor(() => {
      expect(screen.getByTestId("categories-cascade-select-0")).toBeTruthy();
    });
    expect(screen.queryByTestId("categories-tile-grid")).toBeNull();
    expect(screen.queryByTestId("categories-tree")).toBeNull();
  });

  it("the handover offers the children the tiles refused to draw", async () => {
    await renderCategoryPage({ subcategories: "tiles", slug: "phones" });
    await waitFor(() => {
      expect(screen.getByTestId("categories-cascade-select-0")).toBeTruthy();
    });
    // `used-phones` is the leaf where the feature schema actually lives, one
    // tap below the page that used to be a dead end.
    expect(
      screen
        .getByTestId("categories-cascade-select-0")
        .querySelector("input")
    ).toBeTruthy();
    expect(screen.queryByTestId("categories-cascade-exhausted")).toBeNull();
  });

  it("still says nothing for a LEAF, in either arm", async () => {
    // `laptops` has no children. "This category has no subcategories" belongs
    // on a page that came looking for them, not above the listings.
    for (const form of ["pane", "tiles"] as const) {
      const { unmount } = await renderCategoryPage({ subcategories: form, slug: "laptops" });
      expect(screen.queryByTestId("categories-tree")).toBeNull();
      expect(screen.queryByTestId("categories-tile-grid")).toBeNull();
      unmount();
    }
  });
});

describe("<CategoryPage> by ID never transfers the catalogue", () => {
  it("draws the landing from two small reads and asks the list for nothing", async () => {
    // The whole point of the id address. On a live classified deployment the
    // list is 36 requests and 1.4 MB before the title can be drawn; this is
    // `GET {id}/` and `GET {id}/children/`.
    const server = mockServer(OK);
    await renderCategoryPage({
      categoryId: 1,
      subcategories: "tiles",
      breadcrumbs: false,
      server,
    });
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    expect(server.queries("/api/v1/categories/?")).toHaveLength(0);
    const paths = server.calls.map((call) => new URL(call.url).pathname);
    expect(paths).toContain("/categories/api/v1/categories/1/");
    expect(paths).toContain("/categories/api/v1/categories/1/children/");
    expect(paths.filter((p) => p.endsWith("/api/v1/categories/"))).toEqual([]);
  });

  it("hands over to the cascade past the cap on the id path too", async () => {
    await renderCategoryPage({
      categoryId: 2,
      subcategories: "tiles",
      breadcrumbs: false,
    });
    await waitFor(() => {
      expect(screen.getByTestId("categories-cascade-select-0")).toBeTruthy();
    });
  });
});

describe("<CategoryPage> lets the host say whether the trail belongs here", () => {
  it("draws the breadcrumbs by default", async () => {
    await renderCategoryPage();
    await waitFor(() => {
      expect(screen.getByTestId("categories-breadcrumbs")).toBeTruthy();
    });
  });

  it("mounts NOTHING when the host says the back arrow carries the trail", async () => {
    // The phone shape: the reference landing is back-arrow, search field and
    // tiles. Hiding the bar in the host's stylesheet — which is what a live
    // classified deployment did — still ships the crumbs to every phone and
    // still puts them in the accessibility tree.
    await renderCategoryPage({ breadcrumbs: false });
    expect(screen.queryByTestId("categories-breadcrumbs")).toBeNull();
    expect(screen.queryByTestId("categories-breadcrumbs-loading")).toBeNull();
    expect(screen.queryByTestId("categories-breadcrumbs-unknown")).toBeNull();
  });

  it("leaves the rest of the page alone with the trail off", async () => {
    // Turning off one row of chrome must not turn off the screen: the title
    // and the sub-categories are the page, not the bar's dependants.
    await renderCategoryPage({ breadcrumbs: false });
    await waitFor(() => {
      expect(screen.getByTestId("categories-tree-list")).toBeTruthy();
    });
  });

  it("composes with the sub-category arms rather than fighting them", async () => {
    await renderCategoryPage({ breadcrumbs: false, subcategories: "tiles" });
    await waitFor(() => {
      expect(screen.getByTestId("categories-tile-grid-list")).toBeTruthy();
    });
    expect(screen.queryByTestId("categories-breadcrumbs")).toBeNull();
    expect(screen.queryByTestId("categories-tree")).toBeNull();
  });
});

/**
 * A one-rung IMPORT WRAPPER at the root — `/c/uslugi`'s shape in miniature
 * (the browse-stages SPEC's census addendum): a root whose only child exists
 * purely to hold the real groups underneath it. The root's tile page must
 * show the groups, never a single tile pointing at the wrapper.
 */
const WRAPPER_ROOT = categoryRow(200, "uslugi", "category.uslugi", null, "", "201");
const WRAPPER = categoryRow(201, "offer", "category.offer", 200, "200", "202,203");
const WRAPPER_GROUP_A = categoryRow(
  202,
  "group-a",
  "category.group_a",
  201,
  "200,201",
  ""
);
const WRAPPER_GROUP_B = categoryRow(
  203,
  "group-b",
  "category.group_b",
  201,
  "200,201",
  ""
);
const WRAPPER_OK = {
  "/categories/carousel/": { body: [] },
  "/categories/": { body: FULL_PAGE },
  ...rowRoutes([WRAPPER_ROOT, WRAPPER, WRAPPER_GROUP_A, WRAPPER_GROUP_B]),
};

describe("the tiles arm skips a one-rung import wrapper", () => {
  it("draws the wrapper's own children, not a single tile for the wrapper", async () => {
    await renderCategoryPage({
      subcategories: "tiles",
      categoryId: WRAPPER_ROOT.id,
      server: mockServer(WRAPPER_OK),
    });
    await waitFor(() => {
      const hrefs = [
        ...screen
          .getByTestId("categories-tile-grid-list")
          .querySelectorAll("a"),
      ]
        .map((a) => a.getAttribute("href"))
        .filter((href) => href !== "/c");
      expect(hrefs).toEqual(["/c/group-a", "/c/group-b"]);
    });
    expect(screen.queryByText("category.offer")).toBeNull();
  });
});

/**
 * A PAGE INSIDE A SHELL MUST NOT INDENT ITSELF TWICE.
 *
 * `@stapel/shell-react`'s `<Layout.Content>` holds the page gutter
 * (`--stapel-page-gutter`, a responsive token role — 4px on a phone, 24px on a
 * desktop). A page that adds its own inline padding on top of it sits further
 * in than the header above it and the footer below it: three left edges down
 * one window, which is the defect the shared role exists to end.
 *
 * The default is unchanged, because a page mounted straight into a router with
 * nothing around it does own its own padding.
 */
describe("the page's own gutter", () => {
  it("keeps its inline padding by default — nothing is holding one for it", async () => {
    await renderCategoryPage();
    const page = screen.getByTestId("categories-category-page");
    expect(page.getAttribute("data-gutter")).toBe("on");
    expect(page.style.paddingInline).not.toBe("0");
  });

  it("drops the inline half when the composing surface already has one", async () => {
    await renderCategoryPage({ gutter: false });
    const page = screen.getByTestId("categories-category-page");
    expect(page.getAttribute("data-gutter")).toBe("off");
    expect(page.style.paddingInline).toBe("0");
  });

  it("keeps the BLOCK padding either way — vertical rhythm is the page's own", async () => {
    await renderCategoryPage({ gutter: false });
    // The space between a shell's header and this page's first line is not
    // the shell's to decide.
    expect(
      screen.getByTestId("categories-category-page").style.paddingBlock
    ).not.toBe("0");
  });
});
