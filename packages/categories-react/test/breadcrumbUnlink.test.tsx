/**
 * `CategoryCrumb.linked` — a transparent wrapper's crumb prints as plain text,
 * every other crumb is still a link, and a host `unlink` predicate replaces
 * the automatic check rather than adding to it.
 *
 * Fixture: `uslugi (100) -> predlozhenie-uslug (101, the wrapper) ->
 * remont-obuvi (102) -> chistka-obuvi (103, current)` — `catalog/wrapper.ts`'s
 * own census example, sized to a breadcrumb trail.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CategoryBreadcrumbsBar, CategoryPage } from "../src/default/index.js";
import { TestProviders, mockServer, rowRoutes } from "./harness.js";
import { FEATURES, FULL_PAGE, USLUGI_CURRENT, USLUGI_ROWS } from "./fixtures.js";

const OK = {
  "/categories/carousel/": { body: [] },
  "/features/": { body: FEATURES },
  "/categories/": { body: FULL_PAGE },
  ...rowRoutes(USLUGI_ROWS),
};

describe("<CategoryBreadcrumbsBar> unlinks a transparent wrapper", () => {
  it("prints the wrapper as text and links every other ancestor", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryBreadcrumbsBar categoryId={USLUGI_CURRENT.id} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-breadcrumbs")).toBeTruthy();
    });

    // The wrapper's caption is on the page, but not inside an anchor.
    const wrapperText = screen.getByText("category.predlozhenie");
    expect(wrapperText.closest("a")).toBeNull();

    // The root and the group above the current page are still real links.
    expect(screen.getByText("category.uslugi").closest("a")).not.toBeNull();
    expect(screen.getByText("category.remont_obuvi").closest("a")).not.toBeNull();

    // The current crumb keeps its own rule: a label, never a link.
    expect(screen.getByText("category.chistka_obuvi").closest("a")).toBeNull();
  });

  it("a host `unlink` predicate replaces the automatic wrapper check", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryBreadcrumbsBar
          categoryId={USLUGI_CURRENT.id}
          unlink={(crumb) => crumb.category.id === 102}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-breadcrumbs")).toBeTruthy();
    });

    // The predicate names 102 (the group), not the wrapper — the automatic
    // check does not also run, so the wrapper is linked again.
    expect(screen.getByText("category.predlozhenie").closest("a")).not.toBeNull();
    expect(screen.getByText("category.remont_obuvi").closest("a")).toBeNull();
  });
});

describe("<CategoryPage breadcrumbs={{unlink}}>", () => {
  it("forwards the host predicate to the breadcrumbs bar", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPage
          categoryId={USLUGI_CURRENT.id}
          breadcrumbs={{ unlink: (crumb) => crumb.category.id === 102 }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-breadcrumbs")).toBeTruthy();
    });
    expect(screen.getByText("category.predlozhenie").closest("a")).not.toBeNull();
    expect(screen.getByText("category.remont_obuvi").closest("a")).toBeNull();
  });

  it("with no breadcrumbs override, unlinks the wrapper automatically", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPage categoryId={USLUGI_CURRENT.id} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-breadcrumbs")).toBeTruthy();
    });
    expect(screen.getByText("category.predlozhenie").closest("a")).toBeNull();
  });
});
