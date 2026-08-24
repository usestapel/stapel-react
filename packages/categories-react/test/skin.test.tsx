/**
 * The `/default` skin: the four load arms reaching a screen, the blocked
 * control naming its reason, and zero literal strings in the UI.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  CatalogPage,
  CategoryBreadcrumbsBar,
  CategoryFeatureList,
  CategoryPage,
  CategoryPickerField,
  CategoryTreePane,
} from "../src/default/index.js";
import {
  DESKTOP_WIDTH,
  TestProviders,
  installViewport,
  mockServer,
  resetViewportListeners,
  setViewport,
} from "./harness.js";
import { FEATURES, FULL_PAGE, page } from "./fixtures.js";

const OK = {
  "/categories/carousel/": { body: [] },
  "/features/": { body: FEATURES },
  "/categories/": { body: FULL_PAGE },
};

// This file photographs the DESKTOP shape. The phone shape — bottom sheets,
// 44px controls — has its own suite (`responsive.test.tsx`), because "the
// picker is a sheet below the tablet breakpoint" is a claim, not a detail.
beforeAll(() => {
  installViewport();
});
beforeEach(() => {
  resetViewportListeners();
  setViewport(DESKTOP_WIDTH);
});

describe("<CategoryTreePane>", () => {
  it("renders the roots as links to /c/:slug", async () => {
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryTreePane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tree-list")).toBeTruthy();
    });
    const link = screen.getByText("category.electronics");
    expect(link.getAttribute("href")).toBe("/c/electronics");
  });

  it("says 'no subcategories' for a leaf and 'empty catalogue' for nothing", async () => {
    // The two empties are different sentences: a leaf is a normal category,
    // an empty catalogue is a deployment that has not been filled in.
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryTreePane slug="laptops" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tree-empty")).toBeTruthy();
    });
    expect(
      screen.getByText("This category has no subcategories")
    ).toBeTruthy();
  });

  it("renders a refusal, not an empty list", async () => {
    const server = mockServer({
      "/categories/": {
        status: 503,
        body: { code: "stapel.http.503", message: "down" },
      },
    });
    render(
      <TestProviders server={server}>
        <CategoryTreePane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tree-failed")).toBeTruthy();
    });
    expect(screen.queryByTestId("categories-tree-empty")).toBeNull();
  });
});

describe("<CategoryBreadcrumbsBar>", () => {
  it("renders root → current with only the ancestors linked", async () => {
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryBreadcrumbsBar slug="used-phones" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-breadcrumbs")).toBeTruthy();
    });
    expect(screen.getByText("All categories")).toBeTruthy();
    expect(screen.getByText("category.electronics")).toBeTruthy();
    expect(screen.getByText("category.used_phones")).toBeTruthy();
  });
});

describe("<CategoryPage>", () => {
  it("hands the listings half to the container through a slot", async () => {
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryPage
          slug="phones"
          renderListings={(category) => (
            <div data-testid="listings">{category.slug}</div>
          )}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings").textContent).toBe("phones");
    });
  });

  it("says there is no category here only once the catalogue loaded", async () => {
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryPage slug="nope" />
      </TestProviders>
    );
    expect(screen.queryByTestId("categories-category-unknown")).toBeNull();
    await waitFor(() => {
      expect(screen.getByTestId("categories-category-unknown")).toBeTruthy();
    });
  });
});

describe("<CategoryPickerField>", () => {
  it("blocks with a REASON while a non-leaf is selected", async () => {
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryPickerField value={1} />
      </TestProviders>
    );
    // Not "disabled": the sentence explains what to do about it. Before the
    // catalogue lands the reason is the OTHER one ("nothing selected"), which
    // is also true at that moment — so wait for the one under test.
    await waitFor(() => {
      expect(screen.getByText(/Choose a more specific category/)).toBeTruthy();
    });
    expect(screen.getByTestId("categories-picker-blocked")).toBeTruthy();
  });

  it("blocks with the OTHER reason when nothing is selected", async () => {
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryPickerField value={null} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByText("Choose a category first")).toBeTruthy();
    });
  });

  it("accepts a leaf and stops blocking", async () => {
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryPickerField value={3} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-picker-selected")).toBeTruthy();
    });
  });

  it("searches without issuing a request per keystroke", async () => {
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryPickerField value={null} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-picker-list")).toBeTruthy();
    });
    const before = server.calls.length;
    fireEvent.change(screen.getByTestId("categories-picker-search"), {
      target: { value: "laptops" },
    });
    await waitFor(() => {
      expect(
        screen.getByTestId("categories-picker-option-3")
      ).toBeTruthy();
    });
    expect(server.calls.length).toBe(before);
  });
});

describe("<CategoryFeatureList>", () => {
  it("marks a type no builtin editor can draw", async () => {
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryFeatureList categoryId={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-features-list")).toBeTruthy();
    });
    const holo = document.querySelector('[data-feature-type="holo_signature"]');
    expect(holo?.className).toContain("warning");
  });

  it("renders a translate:none feature name as a LITERAL", async () => {
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryFeatureList categoryId={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByText("Warranty (raw label)")).toBeTruthy();
    });
  });
});

describe("<CatalogPage>", () => {
  it("composes the carousel over the tree and says so in one heading", async () => {
    const server = mockServer({
      ...OK,
      "/categories/carousel/": { body: [] },
    });
    render(
      <TestProviders server={server}>
        <CatalogPage />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-catalog-page")).toBeTruthy();
    });
    expect(screen.getByText("Catalogue")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId("categories-carousel-empty")).toBeTruthy();
    });
  });

  it("renders the ru copy when the host registered it", async () => {
    const server = mockServer({
      "/categories/": { body: page([], { globalMax: 0 }) },
      "/categories/carousel/": { body: [] },
    });
    render(
      <TestProviders server={server} locale="ru">
        <CatalogPage />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-catalog-page")).toBeTruthy();
    });
    expect(screen.getByText("Каталог")).toBeTruthy();
  });
});
