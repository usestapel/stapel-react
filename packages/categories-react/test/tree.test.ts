/**
 * Tree assembly from flat rows — the spec's named acceptance for this pair
 * (§8.2: build the tree from flat rows; resolve slug to pk).
 */
import { describe, expect, it, vi } from "vitest";
import {
  buildCategoryTree,
  categoryAncestorIds,
  categoryBreadcrumbs,
  categoryChildIds,
  flattenCategoryNodes,
  parseTreenodePks,
  resolveCategorySlug,
} from "../src/index.js";
import { ROWS, categoryRow, withoutLiveChildFields } from "./fixtures.js";

describe("treenode pk columns are comma-joined STRINGS", () => {
  it("parses a populated column root-first", () => {
    expect(parseTreenodePks("1,2,7")).toEqual([1, 2, 7]);
  });

  it("reads an empty column as no ancestors, not as [NaN]", () => {
    expect(parseTreenodePks("")).toEqual([]);
    expect(parseTreenodePks(null)).toEqual([]);
    expect(parseTreenodePks(undefined)).toEqual([]);
  });

  it("drops a non-numeric fragment instead of yielding NaN", () => {
    // NaN fails every `===` against a real id, which reads as "the parent is
    // missing" — the same wrong answer, two hours later.
    expect(parseTreenodePks("1,,x,3")).toEqual([1, 3]);
  });
});

describe("buildCategoryTree", () => {
  it("assembles parents and children from flat rows", () => {
    const index = buildCategoryTree(ROWS);
    expect(index.roots.map((n) => n.category.slug)).toEqual([
      "electronics",
      "vehicles",
    ]);
    const electronics = index.byId.get(1);
    expect(electronics?.children.map((n) => n.category.slug)).toEqual([
      "phones",
      "laptops",
    ]);
    expect(index.byId.get(4)?.depth).toBe(2);
  });

  it("orders siblings by tn_priority DESCENDING, ties broken by id", () => {
    const tied = [
      categoryRow(20, "b", "category.b", null, "", ""),
      categoryRow(10, "a", "category.a", null, "", ""),
    ];
    // Priority defaults to 0, so a catalogue that never set it is ALL ties —
    // an unstable order there reshuffles the menu between renders.
    expect(
      buildCategoryTree(tied).roots.map((n) => n.id)
    ).toEqual([10, 20]);
  });

  it("drops soft-deleted rows by default and keeps them on request", () => {
    expect(buildCategoryTree(ROWS).byId.has(7)).toBe(false);
    expect(buildCategoryTree(ROWS, { includeDeleted: true }).byId.has(7)).toBe(
      true
    );
  });

  it("drops inactive rows by default — the list endpoint never filters them", () => {
    // Only /carousel/ filters `active` server-side; the sync feed does not.
    expect(buildCategoryTree(ROWS).byId.has(6)).toBe(false);
    expect(buildCategoryTree(ROWS, { includeInactive: true }).byId.has(6)).toBe(
      true
    );
  });

  it("keeps a row whose parent was filtered out, as a root", () => {
    // A delta page can bring a child before its parent, and an editor can
    // deactivate a parent while leaving a child active. Dropping the subtree
    // would delete a live branch from the menu and give nobody a reason.
    const orphan = categoryRow(99, "orphan", "category.orphan", 6, "6", "");
    const index = buildCategoryTree([...ROWS, orphan]);
    expect(index.roots.map((n) => n.id)).toContain(99);
  });

  it("shows a parent cycle instead of blowing the stack or hiding it", () => {
    // Authored data can contain `a.parent = b, b.parent = a`. Recursing would
    // overflow; refusing to recurse and stopping there would drop both rows
    // out of the menu with no error anywhere. Both rows stay reachable.
    const a = categoryRow(80, "a", "category.a", 81, "81", "81");
    const b = categoryRow(81, "b", "category.b", 80, "80", "80");
    const index = buildCategoryTree([a, b]);
    expect(index.byId.has(80)).toBe(true);
    expect(index.byId.has(81)).toBe(true);
    expect(flattenCategoryNodes(index.roots).length).toBeLessThan(6);
  });

  it("reports the source row count, filtered or not", () => {
    expect(buildCategoryTree(ROWS).totalRows).toBe(ROWS.length);
  });
});

describe("slug → category (the lookup the server does not have)", () => {
  it("resolves a slug to its node", () => {
    const index = buildCategoryTree(ROWS);
    expect(resolveCategorySlug(index, "used-phones")?.id).toBe(4);
  });

  it("answers undefined for a slug nothing carries", () => {
    // NOT the root, and not an exception: `/c/nope` is a real 404 page.
    expect(resolveCategorySlug(buildCategoryTree(ROWS), "nope")).toBeUndefined();
  });

  it("does not resolve a filtered-out category", () => {
    expect(resolveCategorySlug(buildCategoryTree(ROWS), "gone")).toBeUndefined();
  });

  it("resolves a duplicate slug deterministically, first in display order", () => {
    // The DB has `unique=True` on slug, so this can only come from a stale
    // snapshot row that has not been evicted yet. It must not be random.
    const dupA = categoryRow(30, "dup", "category.a", null, "", "", {
      tn_priority: 1,
    });
    const dupB = categoryRow(31, "dup", "category.b", null, "", "", {
      tn_priority: 9,
    });
    const index = buildCategoryTree([dupA, dupB]);
    expect(resolveCategorySlug(index, "dup")?.id).toBe(31);
  });
});

describe("breadcrumbs", () => {
  it("walks root → current, inclusive", () => {
    const index = buildCategoryTree(ROWS);
    expect(categoryBreadcrumbs(index, 4).map((n) => n.category.slug)).toEqual([
      "electronics",
      "phones",
      "used-phones",
    ]);
  });

  it("agrees with the server's own tn_ancestors_pks", () => {
    // Two independent answers to the same question. If they ever diverge the
    // crumb is subtly wrong, and this is where that shows up.
    const index = buildCategoryTree(ROWS);
    for (const row of ROWS) {
      const node = index.byId.get(row.id);
      if (node === undefined) continue;
      const walked = categoryBreadcrumbs(index, row.id)
        .slice(0, -1)
        .map((n) => n.id);
      expect(walked).toEqual([...categoryAncestorIds(row)]);
    }
  });

  it("gives a root exactly one crumb — itself", () => {
    expect(
      categoryBreadcrumbs(buildCategoryTree(ROWS), 1).map((n) => n.id)
    ).toEqual([1]);
  });

  it("gives [] for an unknown id rather than half a path", () => {
    // Half a breadcrumb reads as a top-level category.
    expect(categoryBreadcrumbs(buildCategoryTree(ROWS), 404)).toEqual([]);
    expect(categoryBreadcrumbs(buildCategoryTree(ROWS), null)).toEqual([]);
  });
});

describe("categoryChildIds — the live child set (stapel-categories 0.20.5)", () => {
  it("reads children_pks over tn_children_pks — ghosts in tn_children_pks are not the live answer", () => {
    // The real defect a live "services" root showed: tn_children_pks named
    // three ids, two of them soft-deleted. children_pks — the reader's own
    // live answer — names only the one that is really there.
    const withGhosts = categoryRow(40, "p", "category.p", null, "", "41,42,43", {
      children_pks: [43],
      children_count: 1,
    });
    expect(categoryChildIds(withGhosts)).toEqual([43]);
  });

  it("falls back to tn_children_pks, parsed, with a dev warning, when children_pks is absent (older server)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const legacy = withoutLiveChildFields(
      categoryRow(40, "p", "category.p", null, "", "41,42")
    );
    expect(categoryChildIds(legacy)).toEqual([41, 42]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
