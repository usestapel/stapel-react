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

describe("<CategoryPage>'s heading slot", () => {
  // A storefront's title is a sentence the pair cannot compose — "Buy a car in
  // Sochi · 54 364" mixes a verb, a place and a count that belong to three
  // other owners. Without this slot the host drew its own title ABOVE the
  // page's and left two headings in the document outline for one screen.
  it("draws the category's own name when the host supplies nothing", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPage slug="phones" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-category-title")).toBeTruthy();
    });
    expect(screen.getByTestId("categories-category-title").textContent).toBe(
      "category.phones"
    );
  });

  it("replaces the heading's CONTENT, leaving one heading in the outline", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPage
          slug="phones"
          heading={<span data-testid="host-heading">Buy a phone · 54 364</span>}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("host-heading")).toBeTruthy();
    });
    const titles = screen.getAllByTestId("categories-category-title");
    expect(titles).toHaveLength(1);
    // The host's text is INSIDE the page's heading element, not beside it.
    expect(titles[0]?.contains(screen.getByTestId("host-heading"))).toBe(true);
    expect(titles[0]?.textContent).not.toContain("category.phones");
  });

  it("hands a callback the category and the page's own subcategory count", async () => {
    // `count` is the only number this pair owns. A results count belongs to
    // the listings pair and is already in the host's state — which is why the
    // slot takes a node rather than a template.
    let seen: { slug: string; count?: number } | null = null;
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPage
          slug="phones"
          heading={(ctx) => {
            seen = { slug: ctx.category.slug, ...(ctx.count !== undefined ? { count: ctx.count } : {}) };
            return <span data-testid="host-heading">{ctx.category.slug}</span>;
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("host-heading").textContent).toBe("phones");
    });
    expect(seen).toEqual({ slug: "phones", count: 1 });
  });
});

describe("<CategoryPage>'s heading LEVEL", () => {
  // Which level the title takes is a fact about the document the page was
  // mounted into, and only the composing surface knows it. The words are the
  // `heading` slot's business; this is the tag.
  it("is an h3 when the host says nothing — the level the page has always drawn", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPage slug="phones" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-category-title")).toBeTruthy();
    });
    expect(
      screen.getByTestId("categories-category-title").tagName.toLowerCase()
    ).toBe("h3");
  });

  it("takes the level the host states, with the same words inside it", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPage slug="phones" headingLevel={1} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-category-title")).toBeTruthy();
    });
    const title = screen.getByTestId("categories-category-title");
    expect(title.tagName.toLowerCase()).toBe("h1");
    expect(title.textContent).toBe("category.phones");
    // Still exactly ONE heading for the page's own title.
    expect(screen.getAllByTestId("categories-category-title")).toHaveLength(1);
  });

  it("carries the host's heading slot at the host's level", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPage
          slug="phones"
          headingLevel={2}
          heading={<span data-testid="host-heading">Buy a phone</span>}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("host-heading")).toBeTruthy();
    });
    const title = screen.getByTestId("categories-category-title");
    expect(title.tagName.toLowerCase()).toBe("h2");
    expect(title.contains(screen.getByTestId("host-heading"))).toBe(true);
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
