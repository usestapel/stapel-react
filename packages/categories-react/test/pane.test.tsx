/**
 * THE PANE ARM ON THE ID PATH NEVER TRANSFERS THE CATALOGUE.
 *
 * The defect these assertions close: hosts pass BOTH `categoryId` and `slug`
 * (the id is the cheap address, the slug is the canonical URL), and the
 * `"pane"` arm used to mount `<CategoryTreePane slug>` whenever a slug was on
 * the props — resolving the slug through the full multi-page catalogue sync
 * even though `GET {id}/children/` had ALREADY loaded the level's rows to gate
 * the page. Measured on a live classified deployment: 13.2 seconds of
 * skeletons under the "Subcategories" heading of a cold desktop landing, while
 * the same host's list page drew the same widget in 0.4 s from per-level
 * reads.
 *
 * So every test here asserts on the WIRE, not just the DOM: the rows must
 * render, and the catalogue list endpoint must never have been asked. A test
 * that only looked at the links would pass against the sync it exists to ban —
 * the catalogue answers the same question, eventually.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CATEGORY_MEASURE, CategoryPage } from "../src/default/index.js";
import {
  DESKTOP_WIDTH,
  TestProviders,
  installViewport,
  mockServer,
  resetViewportListeners,
  rowRoutes,
  setViewport,
} from "./harness.js";
import {
  ELECTRONICS,
  FEATURES,
  FULL_PAGE,
  LAPTOPS,
  PHONES,
  ROWS,
} from "./fixtures.js";

/**
 * The catalogue list endpoint IS routed, on purpose. A mock that 404'd it
 * would make an accidental sync fail loudly and the page fall to an error arm
 * — visible, but for the wrong reason. Answering it normally means the only
 * thing that catches a regression is the assertion on the recorded calls,
 * which is the property under test.
 */
const OK = {
  "/categories/carousel/": { body: [ELECTRONICS] },
  "/features/": { body: FEATURES },
  "/categories/": { body: FULL_PAGE },
  ...rowRoutes(ROWS),
};

/** The catalogue list/sync endpoint, as it appears in a recorded pathname. */
const CATALOG_LIST = "/api/v1/categories/";

beforeAll(() => {
  installViewport();
});
beforeEach(() => {
  resetViewportListeners();
  setViewport(DESKTOP_WIDTH);
});

describe('the "pane" arm on the id path', () => {
  it("renders the level the page already holds and never starts the catalogue sync", async () => {
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryPage
          categoryId={ELECTRONICS.id}
          slug="electronics"
          subcategories="pane"
          breadcrumbs={false}
        />
      </TestProviders>
    );

    // (a) The links render, labels and all, from `GET {id}/children/`.
    await waitFor(() => {
      expect(screen.getByTestId("categories-tree-list")).toBeTruthy();
    });
    const anchors = [
      ...screen.getByTestId("categories-tree-list").querySelectorAll("a"),
    ];
    expect(anchors.map((a) => a.getAttribute("href"))).toEqual([
      "/c/phones",
      "/c/laptops",
    ]);
    expect(screen.getByText("category.phones")).toBeTruthy();
    expect(screen.getByText("category.laptops")).toBeTruthy();

    // (c) The counts land as one small children read per ROW — the same
    // cached rung a cascade or the next landing reads — so wait for the chip
    // before auditing the wire, or a sync started late would slip past.
    await waitFor(() => {
      expect(
        screen
          .getByTestId("categories-tree-list")
          .querySelector("[data-category-children]")
      ).toBeTruthy();
    });

    // (b) NO request went to the catalogue list endpoint. This is the defect:
    // the pane used to resolve the slug through the full sync — ~36 requests
    // and 13.2 s cold on a live classified deployment — for rows it already
    // had in hand.
    const paths = server.calls.map((call) => new URL(call.url).pathname);
    expect(paths.filter((p) => p.endsWith(CATALOG_LIST))).toEqual([]);
    expect(paths).toContain(
      `/categories${CATALOG_LIST}${String(ELECTRONICS.id)}/children/`
    );
    expect(paths).toContain(
      `/categories${CATALOG_LIST}${String(PHONES.id)}/children/`
    );
  });

  it("draws a count Tag only where a children read answered with rows — an unanswered read draws nothing, quietly", async () => {
    // `laptops`' children read refuses: the row must still be a working link
    // with NO chip, NO chevron and NO error surface. A count is a decoration
    // on a link that already works; a skeleton or an alert here would rebuild
    // the very gate this split removes, and a bare `0` would state a fact
    // nobody verified.
    const server = mockServer({
      ...OK,
      [`/categories/${String(LAPTOPS.id)}/children/`]: {
        status: 500,
        body: { detail: "boom" },
      },
    });
    render(
      <TestProviders server={server}>
        <CategoryPage
          categoryId={ELECTRONICS.id}
          slug="electronics"
          subcategories="pane"
          breadcrumbs={false}
        />
      </TestProviders>
    );

    // `phones` has one browsable child, so its read lands as `1` and draws
    // the chip exactly as the catalogue path would.
    await waitFor(() => {
      expect(
        screen
          .getByTestId("categories-tree-list")
          .querySelector('[data-category-children="1"]')
      ).toBeTruthy();
    });
    expect(screen.getByText("1 subcategory")).toBeTruthy();

    const laptopsRow = screen
      .getByTestId("categories-tree-list")
      .querySelector(`[data-category-id="${String(LAPTOPS.id)}"]`);
    expect(laptopsRow).toBeTruthy();
    expect(laptopsRow?.querySelector("[data-category-children]")).toBeNull();
    expect(laptopsRow?.textContent).not.toContain("›");

    // Quiet means QUIET: the page shows neither the tree's failure arm nor a
    // loading gate for a chip that is not coming.
    expect(screen.queryByTestId("categories-tree-failed")).toBeNull();
    expect(screen.queryByTestId("categories-tree-loading")).toBeNull();

    // And the chips came from the per-parent reads, not from a catalogue that
    // would have answered the same question 36 requests later.
    const paths = server.calls.map((call) => new URL(call.url).pathname);
    expect(paths.filter((p) => p.endsWith(CATALOG_LIST))).toEqual([]);
  });
});

describe("the page's content measure", () => {
  it("defaults to CATEGORY_MEASURE", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPage categoryId={ELECTRONICS.id} subcategories="pane" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-category-page")).toBeTruthy();
    });
    expect(
      screen.getByTestId("categories-category-page").style.maxWidth
    ).toBe(CATEGORY_MEASURE);
  });

  it("takes a host's own measure instead of forcing an override from outside", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPage
          categoryId={ELECTRONICS.id}
          subcategories="pane"
          measure="80rem"
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-category-page")).toBeTruthy();
    });
    expect(
      screen.getByTestId("categories-category-page").style.maxWidth
    ).toBe("80rem");
  });
});
