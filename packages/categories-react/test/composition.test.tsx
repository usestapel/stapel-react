/**
 * The seams a container reaches through, and what happens when it does not.
 *
 * Three defects the audit found, all the same shape — a capability that exists
 * one component down and cannot be reached from the screen the nav manifest
 * actually mounts, or an absence that renders as nothing:
 *
 *  - `renderIcon` stopped at `CategoryCarouselStrip`, so the `/c` route could
 *    never draw a category icon whatever the host did;
 *  - `renderListings` was `props.renderListings?.(…)` — an unfilled slot that
 *    rendered silence in the exact place every listing belongs;
 *  - `FeatureCompact.comment` — the catalogue author's note to the person
 *    filling in the form — had zero readers in the whole fleet.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  UNPERSISTED_WARNING,
  createCatalogStore,
  featureCommentLabel,
} from "../src/index.js";
import {
  CatalogPage,
  CategoryFeatureList,
  CategoryPage,
} from "../src/default/index.js";
import {
  DESKTOP_WIDTH,
  TestProviders,
  installViewport,
  mockServer,
  resetViewportListeners,
  setViewport,
} from "./harness.js";
import {
  ELECTRONICS,
  FEATURES,
  FEATURE_BRAND,
  FEATURE_POWER,
  FEATURE_WARRANTY,
  FULL_PAGE,
} from "./fixtures.js";

const OK = {
  "/categories/carousel/": { body: [ELECTRONICS] },
  "/features/": { body: FEATURES },
  "/categories/": { body: FULL_PAGE },
};

beforeAll(() => {
  installViewport();
});
beforeEach(() => {
  resetViewportListeners();
  setViewport(DESKTOP_WIDTH);
});

describe("<CatalogPage> forwards what the screen below it takes", () => {
  it("hands the icon resolver to the carousel", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CatalogPage
          renderIcon={(reference, entry) => (
            <span data-testid={`icon-${entry.category.slug}`}>{reference}</span>
          )}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("icon-electronics").textContent).toBe(
        "carousel/electronics"
      );
    });
  });

  it("draws no icon when the host resolves none — and no broken one either", async () => {
    const { container } = render(
      <TestProviders server={mockServer(OK)}>
        <CatalogPage />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-carousel-list")).toBeTruthy();
    });
    // A guessed CDN path would be a broken image on every deployment that
    // guessed differently, so the tile stays text-only.
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("<CategoryPage>'s listings slot", () => {
  it("names itself when the container left it unfilled", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPage slug="phones" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(
        document.querySelector('[data-stapel-slot="renderListings"]')
      ).toBeTruthy();
    });
    // Named, not decorative: the prop the container forgot is the message.
    expect(
      screen.getByTestId("categories-category-listings-slot").textContent
    ).toContain("renderListings");
  });

  it("disappears entirely once the container fills it", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
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
    expect(
      document.querySelector('[data-stapel-slot="renderListings"]')
    ).toBeNull();
  });
});

describe("a feature's help text reaches a screen", () => {
  it("is a KEY on the same terms as the name", () => {
    expect(featureCommentLabel(FEATURE_BRAND)).toEqual({
      kind: "key",
      value: "feature.brand.comment",
    });
    // `translate: "none"` opts the whole row out, comment included.
    expect(featureCommentLabel(FEATURE_WARRANTY)).toEqual({
      kind: "literal",
      value: "Tick if the box says so",
    });
    // No comment is not an empty comment.
    expect(featureCommentLabel(FEATURE_POWER)).toBeNull();
  });

  it("renders under the feature name, and only where there is one", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryFeatureList categoryId={2} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-features-list")).toBeTruthy();
    });
    expect(
      screen.getByTestId("categories-feature-comment-warranty").textContent
    ).toBe("Tick if the box says so");
    expect(
      screen.queryByTestId("categories-feature-comment-power_w")
    ).toBeNull();
  });
});

describe("running unpersisted is said out loud", () => {
  /**
   * The reachable shape of "no storage backend": `typeof localStorage` is
   * `"object"`, and READING the global throws. Safari with site data blocked
   * does exactly this, which is why the fallback exists at all — and why it
   * must not be silent, since the page keeps working and re-downloads the
   * whole catalogue on every navigation forever.
   */
  function withHostileStorage<T>(body: () => T): T {
    const real = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("The operation is insecure.");
      },
    });
    try {
      return body();
    } finally {
      if (real) Object.defineProperty(window, "localStorage", real);
      else delete (window as { localStorage?: unknown }).localStorage;
    }
  }

  it("warns once, naming the cost and the two ways out", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = withHostileStorage(() => createCatalogStore());
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toBe(UNPERSISTED_WARNING);
    warn.mockRestore();
    // Still a working store — degrading is right, degrading quietly is not.
    expect(store).toBeTruthy();
  });

  it("routes the notice to the caller's handler instead, when given one", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const seen: unknown[] = [];
    withHostileStorage(() =>
      createCatalogStore({ onUnpersisted: (error) => seen.push(error) })
    );
    expect(seen).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
