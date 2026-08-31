/**
 * THE BROWSE PROJECTION — what a person may be offered, and what the sync
 * contract keeps sending anyway.
 *
 * The endpoint is right to send inactive, soft-deleted and test rows: a
 * consumer that stopped receiving them could never learn that a row went
 * inactive, and the delta protocol would silently rot. So every assertion here
 * is about the CONSUMER — the browse hooks drop those rows, the admin opt-in
 * gets them back, and the cache underneath keeps every one of them.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  ADMIN_VISIBILITY,
  browsableCategories,
  buildCategoryTree,
  isBrowsableCategory,
  isTestCategory,
  useCategoryCarousel,
  useCategoryChildren,
} from "../src/index.js";
import type { CategoryVisibilityOptions } from "../src/index.js";
import { TestProviders, mockServer, testStore } from "./harness.js";
import {
  ELECTRONICS,
  GONE,
  PHONES,
  RETIRED,
  TEST_LEFTOVER,
  UNFLAGGED,
  VEHICLES,
  page,
} from "./fixtures.js";
import { CategoryTree } from "../src/index.js";

/** Live, inactive, tombstoned, test-flagged, and a real row whose slug merely
 * LOOKS like a fixture — the five cases the predicate has to tell apart. */
const MIXED = [ELECTRONICS, RETIRED, GONE, TEST_LEFTOVER, UNFLAGGED];

describe("isBrowsableCategory (the shared predicate)", () => {
  it("keeps only the rows a person may be offered", () => {
    expect(MIXED.filter((row) => isBrowsableCategory(row)).map((r) => r.slug)).toEqual([
      "electronics",
      "storefront-2",
    ]);
  });

  it("treats a MISSING is_test as 'not a test row'", () => {
    // The pinned schema does not carry the field. Reading its absence as
    // "test" would empty every catalogue served by that serializer, which
    // today is all of them.
    expect(isTestCategory(UNFLAGGED)).toBe(false);
    expect(isTestCategory(ELECTRONICS)).toBe(false);
    expect(isTestCategory(TEST_LEFTOVER)).toBe(true);
  });

  it("never guesses from a slug — only the deployment's own flags", () => {
    // `storefront-2` and `authz-1787369370` look equally like fixtures. Only
    // one of them SAYS it is one, and a heuristic over the other would delete
    // a live branch of somebody's catalogue with no error anywhere.
    expect(isBrowsableCategory(UNFLAGGED)).toBe(true);
    expect(isBrowsableCategory(TEST_LEFTOVER)).toBe(false);
  });

  it("gives each flag its own opt-out, and ADMIN_VISIBILITY all three", () => {
    const only = (options: CategoryVisibilityOptions): readonly string[] =>
      browsableCategories(MIXED, options).map((row) => row.slug);

    expect(only({ includeInactive: true })).toContain("retired");
    expect(only({ includeInactive: true })).not.toContain("gone");
    expect(only({ includeDeleted: true })).toContain("gone");
    expect(only({ includeTest: true })).toContain("authz-1787369370");
    expect(only(ADMIN_VISIBILITY)).toEqual(MIXED.map((row) => row.slug));
  });

  it("preserves the order it was given", () => {
    expect(browsableCategories([UNFLAGGED, ELECTRONICS]).map((r) => r.slug)).toEqual([
      "storefront-2",
      "electronics",
    ]);
  });
});

describe("buildCategoryTree runs the same predicate", () => {
  it("drops inactive, deleted and test rows from the browse tree", () => {
    const index = buildCategoryTree(MIXED);
    expect(index.roots.map((n) => n.category.slug)).toEqual([
      "electronics",
      "storefront-2",
    ]);
    // The snapshot it was built from is untouched: a filtered CACHE could not
    // apply the next delta.
    expect(index.totalRows).toBe(MIXED.length);
  });

  it("hands an admin the whole table back", () => {
    const index = buildCategoryTree(MIXED, ADMIN_VISIBILITY);
    expect(index.roots).toHaveLength(MIXED.length);
    expect(index.bySlug.get("authz-1787369370")).toBeTruthy();
  });
});

function TreeProbe(props: {
  readonly admin?: boolean;
}): ReactElement {
  return (
    <CategoryTree store={testStore()} {...(props.admin === true ? ADMIN_VISIBILITY : {})}>
      {(bag) => (
        <span data-testid="rows">
          {bag.state.status === "ready"
            ? bag.state.data.map((n) => n.category.slug).join(",")
            : bag.state.status}
        </span>
      )}
    </CategoryTree>
  );
}

const MIXED_PAGE = { "/categories/": { body: page(MIXED, { globalMax: 9 }) } };

describe("useCategoryCatalog, through <CategoryTree>", () => {
  it("offers only the live rows", async () => {
    render(
      <TestProviders server={mockServer(MIXED_PAGE)}>
        <TreeProbe />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("rows").textContent).toBe(
        "electronics,storefront-2"
      );
    });
  });

  it("returns the inactive and test rows for the admin opt-in", async () => {
    // `gone` is absent for a DIFFERENT reason, one layer down: the delta sync
    // evicts a `deleted: true` row from the snapshot (`catalog/sync.ts`), so
    // no projection over that snapshot can bring it back. The projection's job
    // here is `retired` and `authz-1787369370`.
    render(
      <TestProviders server={mockServer(MIXED_PAGE)}>
        <TreeProbe admin />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("rows").textContent).toBe(
        "electronics,retired,authz-1787369370,storefront-2"
      );
    });
  });
});

function ChildrenProbe(props: {
  readonly admin?: boolean;
}): ReactElement {
  const query = useCategoryChildren(
    ELECTRONICS.id,
    props.admin === true ? ADMIN_VISIBILITY : {}
  );
  return (
    <span data-testid={props.admin === true ? "admin" : "browse"}>
      {query.data === undefined
        ? ""
        : query.data.map((row) => row.slug).join(",")}
    </span>
  );
}

describe("useCategoryChildren", () => {
  const CHILDREN = [PHONES, RETIRED, GONE, TEST_LEFTOVER];

  it("filters the server's answer for a browse surface", async () => {
    render(
      <TestProviders
        server={mockServer({ "/children/": { body: CHILDREN } })}
      >
        <ChildrenProbe />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("browse").textContent).toBe("phones");
    });
  });

  it("hands an admin every row, from the SAME cached response", async () => {
    // Both projections read one query key. A filter applied in the queryFn
    // instead would have cached the browse answer and made the admin mount
    // either wrong or a second request.
    const server = mockServer({ "/children/": { body: CHILDREN } });
    render(
      <TestProviders server={server}>
        <>
          <ChildrenProbe />
          <ChildrenProbe admin />
        </>
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("admin").textContent).toBe(
        "phones,retired,gone,authz-1787369370"
      );
    });
    expect(screen.getByTestId("browse").textContent).toBe("phones");
    expect(server.queries("/children/")).toHaveLength(1);
  });
});

function CarouselProbe(): ReactElement {
  const query = useCategoryCarousel();
  return (
    <span data-testid="carousel">
      {query.data === undefined ? "" : query.data.map((row) => row.slug).join(",")}
    </span>
  );
}

describe("useCategoryCarousel", () => {
  it("still filters, because the server owns only the `active` half", async () => {
    render(
      <TestProviders
        server={mockServer({
          "/categories/carousel/": {
            body: [ELECTRONICS, GONE, TEST_LEFTOVER, VEHICLES],
          },
        })}
      >
        <CarouselProbe />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("carousel").textContent).toBe(
        "electronics,vehicles"
      );
    });
  });
});
