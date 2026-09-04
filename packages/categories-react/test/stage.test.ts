/**
 * `browseStage` / `childControl` — the browse contract's two-level rule.
 *
 * Tiles are exactly two levels: the home screen, and a root's own page. Every
 * page below a root is a feed, whatever its own `children_as` says — that
 * field now only shapes the FILTER a feed page puts at the top of its rail
 * (`childControl`), never the stage. The fixtures below cover the five cases
 * the browse-stages SPEC's evening correction names by name.
 */
import { describe, expect, it, vi } from "vitest";
import { browseStage, childControl, hasChildren } from "../src/index.js";
import { categoryRow, withoutLiveChildFields } from "./fixtures.js";
import { TREE_CARS, TREE_PARTS, TREE_TRANSPORT, treeNode } from "./fixtures.js";

describe("browseStage", () => {
  it("sends a root WITH children to the tile grid", () => {
    expect(browseStage(TREE_TRANSPORT)).toBe("tiles");
    const root = categoryRow(1, "electronics", "category.electronics", null, "", "2,3");
    expect(browseStage(root)).toBe("tiles");
  });

  it("sends a depth-1 node — a root's own child — to the FEED even with tiles-children", () => {
    // TREE_PARTS sits under TREE_TRANSPORT (path "141/161") and itself has
    // seven tiles-shaped children — under the old three-level reading that
    // was a tile grid. The correction: tiles are two levels, full stop.
    expect(TREE_PARTS.path).toBe("141/161");
    expect(TREE_PARTS.children_as).toBe("tiles");
    expect(browseStage(TREE_PARTS)).toBe("feed");
    expect(childControl(TREE_PARTS)).toBe("list");
  });

  it("sends a chips parent to the FEED — the same as any other non-root", () => {
    expect(TREE_CARS.children_as).toBe("chips");
    expect(browseStage(TREE_CARS)).toBe("feed");
    expect(childControl(TREE_CARS)).toBe("segmented");
  });

  it("sends a leaf to the feed with no child control at all", () => {
    const leaf = treeNode(9, "leaf", "category.leaf", "1/9");
    expect(browseStage(leaf)).toBe("feed");
    expect(childControl(leaf)).toBe("none");
  });

  it("a /tree/ node at the depth cap still knows it is a root with children", () => {
    // A shallow `?depth=1` read cuts every node's `children` to `[]`, roots
    // included — but the server never sends `children_as: null` on a row
    // that has some, so that field survives the cut where the array does not.
    const cutRoot = treeNode(1, "electronics", "category.electronics", "1", {
      children_as: "tiles",
      children: [],
    });
    expect(browseStage(cutRoot)).toBe("tiles");
  });

  it("reads a flat row's tn_children_pks over children_as or a cut array (older-server fallback)", () => {
    // No children_pks/children_count — the shape a server predating
    // stapel-categories 0.20.5 sends, which is exactly the case this
    // fallback tier exists for.
    const parent = withoutLiveChildFields(
      categoryRow(1, "electronics", "category.electronics", null, "", "2,3")
    );
    const leaf = withoutLiveChildFields(
      categoryRow(3, "laptops", "category.laptops", 1, "1", "")
    );
    expect(browseStage(parent)).toBe("tiles");
    expect(browseStage(leaf)).toBe("feed");
    // A root that (incorrectly) claims "chips" is still tiles — the field
    // does not decide the stage, only the child control does.
    expect(browseStage({ ...parent, children_as: "chips" })).toBe("tiles");
    expect(childControl({ ...parent, children_as: "chips" })).toBe("segmented");
  });

  it("does not guess a stage from a row that says nothing about its parentage", () => {
    expect(browseStage({ children_as: "tiles" })).toBe("feed");
    expect(browseStage({})).toBe("feed");
  });

  it("sends a transparent node to 'feed' with no parent in hand", () => {
    const transparent = categoryRow(
      1410,
      "offer",
      "category.offer",
      141,
      "141",
      "1,2",
      { children_as: "transparent" }
    );
    expect(browseStage(transparent)).toBe("feed");
  });

  it("delegates a transparent node to its parent's own shape", () => {
    const root = categoryRow(141, "uslugi", "category.uslugi", null, "", "1410");
    const transparent = categoryRow(
      1410,
      "offer",
      "category.offer",
      141,
      "141",
      "1,2",
      { children_as: "transparent" }
    );
    expect(browseStage(transparent, root)).toBe(browseStage(root));
    expect(browseStage(transparent, root)).toBe("tiles");
  });
});

describe("childControl", () => {
  it("is 'none' for a childless row", () => {
    const leaf = categoryRow(4, "used-phones", "category.used_phones", 2, "1,2", "");
    expect(childControl(leaf)).toBe("none");
  });

  it("is 'segmented' for a chips parent, 'list' for everything else with children", () => {
    expect(childControl(TREE_CARS)).toBe("segmented");
    expect(childControl(TREE_PARTS)).toBe("list");
  });

  it("does not guess children from a row that says nothing about them", () => {
    expect(childControl({})).toBe("list");
  });

  it("is 'none' for a transparent node — never a destination for a filter", () => {
    const transparent = categoryRow(
      1410,
      "offer",
      "category.offer",
      141,
      "141",
      "1,2",
      { children_as: "transparent" }
    );
    expect(childControl(transparent)).toBe("none");
  });
});

describe("hasChildren / browseStage — children_pks over tn_children_pks (stapel-categories 0.20.5)", () => {
  it("resolves a childless row as a leaf when children_pks is empty despite a stale tn_children_pks", () => {
    // A live "services" root showed exactly this shape: tn_children_pks named
    // ids nobody can fetch any more (soft-deleted/retired), and the reader's
    // own children_pks — the real answer — is empty.
    const stale = categoryRow(50, "leaf-stale", "category.leaf_stale", 1, "1", "99", {
      children_pks: [],
      children_count: 0,
    });
    expect(hasChildren(stale)).toBe(false);
    expect(browseStage(stale)).toBe("feed");
    expect(childControl(stale)).toBe("none");
  });

  it("falls back to tn_children_pks, with a dev warning, when children_pks and children_count are both absent", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const legacy = withoutLiveChildFields(
      categoryRow(1, "electronics", "category.electronics", null, "", "2,3")
    );
    expect(hasChildren(legacy)).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("tn_children_pks");
    warn.mockRestore();
  });
});
