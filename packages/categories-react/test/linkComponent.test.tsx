/**
 * Category chrome inside a SPA — storefront Wave D, named gap G-4.
 *
 * Breadcrumbs, the tree and the carousel are nothing BUT links, and every one
 * of them was a plain `<a href>`. Inside a router app that is a full page load
 * per click: the whole application thrown away and rebuilt to move between two
 * categories whose rows are already in memory — which is the entire point of
 * this pair's delta-synced, app-scoped catalogue.
 *
 * The claim under test is the one that matters and the one a prop-shaped test
 * would miss: with a `linkComponent`, **no `<a href>` is rendered directly**.
 * Without one, an anchor still is, because a host that never wired a router
 * must keep working.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { LinkComponent } from "@stapel/core";
import {
  CatalogPage,
  CategoryBreadcrumbsBar,
  CategoryCarouselStrip,
  CategoryPage,
  CategoryTreePane,
} from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { ELECTRONICS, FEATURES, FULL_PAGE } from "./fixtures.js";

const OK = {
  "/categories/carousel/": { body: [ELECTRONICS] },
  "/features/": { body: FEATURES },
  "/categories/": { body: FULL_PAGE },
};

/** A container's router adapter — the one line a host writes. */
const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
  <span role="link" data-router-to={href} {...rest}>
    {children}
  </span>
);

function anchors(container: HTMLElement): readonly Element[] {
  return [...container.querySelectorAll("a[href]")];
}

function routed(container: HTMLElement): readonly string[] {
  return [...container.querySelectorAll("[data-router-to]")].map(
    (node) => node.getAttribute("data-router-to") ?? ""
  );
}

describe("<CategoryTreePane>", () => {
  it("renders an anchor when the host hands in nothing", async () => {
    const { container } = render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTreePane />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tree-list")).toBeTruthy();
    });
    expect(anchors(container).length).toBeGreaterThan(0);
  });

  it("renders through the host's Link instead — no anchor at all", async () => {
    const { container } = render(
      <TestProviders server={mockServer(OK)}>
        <CategoryTreePane linkComponent={RouterLink} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tree-list")).toBeTruthy();
    });
    expect(anchors(container)).toHaveLength(0);
    expect(routed(container)).toContain("/c/electronics");
    // The row's slug still reaches the DOM through the host's component.
    expect(
      screen
        .getByText("category.electronics")
        .closest("[data-category-slug]")
        ?.getAttribute("data-category-slug")
    ).toBe("electronics");
  });
});

describe("<CategoryCarouselStrip>", () => {
  it("routes its tiles through the host's Link", async () => {
    const { container } = render(
      <TestProviders server={mockServer(OK)}>
        <CategoryCarouselStrip linkComponent={RouterLink} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-carousel-list")).toBeTruthy();
    });
    expect(anchors(container)).toHaveLength(0);
    expect(routed(container)).toContain("/c/electronics");
  });
});

describe("<CategoryBreadcrumbsBar>", () => {
  it("routes every crumb, and leaves the current one a label", async () => {
    const { container } = render(
      <TestProviders server={mockServer(OK)}>
        <CategoryBreadcrumbsBar slug="phones" linkComponent={RouterLink} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-breadcrumbs")).toBeTruthy();
    });
    // antd renders `href` on a crumb ITEM as its own anchor, so the link had
    // to become the crumb's TITLE — otherwise the seam would be bypassed by
    // the component it is inside.
    expect(anchors(container)).toHaveLength(0);
    const targets = routed(container);
    expect(targets).toContain("/c");
    expect(targets).toContain("/c/electronics");
    // Where you already are is not a link to where you already are.
    expect(targets).not.toContain("/c/phones");
    expect(screen.getByText("category.phones")).toBeTruthy();
  });

  it("still renders anchors with no linkComponent", async () => {
    const { container } = render(
      <TestProviders server={mockServer(OK)}>
        <CategoryBreadcrumbsBar slug="phones" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-breadcrumbs")).toBeTruthy();
    });
    expect(anchors(container).length).toBeGreaterThan(0);
  });
});

describe("the composed screens pass it down", () => {
  it("<CatalogPage> routes carousel and tree alike", async () => {
    const { container } = render(
      <TestProviders server={mockServer(OK)}>
        <CatalogPage linkComponent={RouterLink} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-tree-list")).toBeTruthy();
    });
    expect(anchors(container)).toHaveLength(0);
  });

  it("<CategoryPage> routes breadcrumbs and subcategories alike", async () => {
    const { container } = render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPage slug="electronics" linkComponent={RouterLink} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-breadcrumbs")).toBeTruthy();
    });
    expect(anchors(container)).toHaveLength(0);
    expect(routed(container)).toContain("/c/phones");
  });
});
