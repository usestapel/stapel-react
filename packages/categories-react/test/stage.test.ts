/**
 * `browseStage` — which page shape a category's own screen takes.
 *
 * Two of these assertions are the rule and two are the trap. The rule: a
 * `chips` parent renders the same FEED page a leaf does, because a partition
 * of one template is a filter control and not a level of the tree. The trap: a
 * node from a depth-capped tree read always arrives with an empty `children`
 * array, so "no children here" and "no children at all" are different facts
 * and only the flat row's `tn_children_pks` knows the second one.
 */
import { describe, expect, it } from "vitest";
import { browseStage } from "../src/index.js";
import { categoryRow } from "./fixtures.js";
import { TREE_CARS, TREE_PARTS, treeNode } from "./fixtures.js";

describe("browseStage", () => {
  it("sends a tiles parent to the tile grid", () => {
    expect(browseStage(TREE_PARTS)).toBe("tiles");
  });

  it("sends a chips parent to the FEED — the chip row is a filter, not a level", () => {
    expect(TREE_CARS.children_as).toBe("chips");
    expect(browseStage(TREE_CARS)).toBe("feed");
  });

  it("sends a childless node to the feed whatever the server said", () => {
    expect(browseStage(treeNode(9, "leaf", "category.leaf", "9"))).toBe("feed");
    // `children_as` is null on a childless row, but a build that sent "tiles"
    // anyway must not produce an empty tile grid.
    expect(
      browseStage(treeNode(9, "leaf", "category.leaf", "9", { children_as: "tiles" }))
    ).toBe("feed");
  });

  it("reads a flat row's comma-joined children, not an array", () => {
    const parent = categoryRow(1, "electronics", "category.electronics", null, "", "2,3");
    const leaf = categoryRow(3, "laptops", "category.laptops", 1, "1", "");
    expect(browseStage(parent)).toBe("tiles");
    expect(browseStage(leaf)).toBe("feed");
    expect(browseStage({ ...parent, children_as: "chips" })).toBe("feed");
  });

  it("prefers tn_children_pks over an array a depth cap emptied", () => {
    // The off-by-one that would give a whole level of the catalogue the wrong
    // page: at `?depth=3` every third-level node arrives with `children: []`.
    const row = { ...categoryRow(2, "phones", "category.phones", 1, "1", "4"), children: [] };
    expect(browseStage(row)).toBe("tiles");
  });

  it("does not guess 'leaf' from a row that says nothing about its children", () => {
    expect(browseStage({ children_as: "tiles" })).toBe("tiles");
    expect(browseStage({})).toBe("tiles");
  });
});
