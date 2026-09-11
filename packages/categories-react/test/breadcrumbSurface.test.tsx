/**
 * THE TRAIL PAINTS NOTHING.
 *
 * `<CategoryBreadcrumbsBar>` wraps itself in `<SkinTheme>` to hand antd the
 * theme its `Breadcrumb` is drawn with. `<SkinTheme>` defaults to
 * `surface="raised"`, which also puts `colorBgContainer` on its own root —
 * and a light theme paints that the same colour as the page, so for as long
 * as this skin existed the fill was invisible and nobody decided it.
 *
 * On a live storefront in dark it was measured by its integrator as a
 * 1392x24 lighter ribbon across the top of every `/c/:slug` page and every
 * listing page, under the header, with no radius and no border: a panel
 * behind one line of links.
 *
 * The assertion is the SURFACE STAMP, not a colour. jsdom lays nothing out
 * and resolves no antd token, so "is this band the same colour as the page"
 * is a question it cannot answer; `data-stapel-skin-surface` is what
 * `<SkinTheme>` publishes precisely so a package's test can prove which
 * surface it rendered on, and `"bare"` is the only value that paints neither
 * a background nor a colour. It read `"raised"` before this file.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { CategoryBreadcrumbsBar } from "../src/default/index.js";
import { TestProviders, mockServer, rowRoutes } from "./harness.js";
import { FEATURES, FULL_PAGE, USLUGI_CURRENT, USLUGI_ROWS } from "./fixtures.js";

const OK = {
  "/categories/carousel/": { body: [] },
  "/features/": { body: FEATURES },
  "/categories/": { body: FULL_PAGE },
  ...rowRoutes(USLUGI_ROWS),
};

afterEach(cleanup);

/** The skin root this bar renders itself inside — its own, not a parent's. */
function ownSkinRoot(): HTMLElement {
  const trail = screen.getByTestId("categories-breadcrumbs");
  const root = trail.closest<HTMLElement>("[data-stapel-skin-root]");
  expect(root, "the bar renders no skin root of its own").not.toBeNull();
  return root as HTMLElement;
}

describe("<CategoryBreadcrumbsBar> is a trail, not a panel", () => {
  it("renders on the bare surface, so it paints no band of its own", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryBreadcrumbsBar categoryId={USLUGI_CURRENT.id} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-breadcrumbs")).toBeTruthy();
    });

    const root = ownSkinRoot();
    // The value this file exists for: "raised" — SkinTheme's default — is the
    // band that was measured on the live storefront.
    expect(root.getAttribute("data-stapel-skin-surface")).toBe("bare");
    // `bare` is the arm that writes no paint, so the fill may not come back by
    // another route either.
    expect(root.style.backgroundColor).toBe("");
    // The one declaration a bare trail keeps, and it is the LIVE property
    // rather than the frozen token `raised` would have written.
    expect(root.style.color).toContain("--stapel-text");
  });

  it("still applies the mode a host pins, bare or not", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryBreadcrumbsBar categoryId={USLUGI_CURRENT.id} mode="dark" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-breadcrumbs")).toBeTruthy();
    });

    const root = ownSkinRoot();
    // Dropping the paint must not drop the THEME: the pin is what gives the
    // antd components below their dark tokens, and it is the reason the text
    // stays legible without an inherited `color`.
    expect(root.getAttribute("data-stapel-skin-mode")).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });
});
