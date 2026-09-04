/**
 * `isTransparentWrapper` / `browseChildren` — the census addendum's one-hop
 * rule: a node with exactly one child, itself with children of its own, is a
 * wrapper a tile page skips over to its grandchildren. Plus
 * `isTransparentNode` — stapel-categories 0.20.4's AUTHORED value
 * (`children_as: "transparent"`), which fires whether or not the node has
 * siblings.
 */
import { describe, expect, it, vi } from "vitest";
import {
  browseChildren,
  isTransparentNode,
  isTransparentWrapper,
  isWrapperAncestor,
} from "../src/index.js";
import { categoryRow, treeNode } from "./fixtures.js";

describe("isTransparentWrapper — flat Category rows", () => {
  it("is true for a single child that itself has children", () => {
    // "Services" (141) -> "Services offer" (1410, import wrapper) -> 34 groups.
    const wrapper = categoryRow(1410, "uslugi-predlozhenie", "category.offer", 141, "141", "1,2,3");
    expect(isTransparentWrapper([wrapper])).toBe(true);
  });

  it("is false for a single LEAF child — it is a real destination", () => {
    const leaf = categoryRow(2, "used-phones", "category.used_phones", 1, "1", "");
    expect(isTransparentWrapper([leaf])).toBe(false);
  });

  it("is false with two children — nothing to skip", () => {
    const a = categoryRow(2, "cars-new", "category.cars_new", 1, "1", "10,11");
    const b = categoryRow(3, "cars-used", "category.cars_used", 1, "1", "");
    expect(isTransparentWrapper([a, b])).toBe(false);
  });

  it("is false with zero children", () => {
    expect(isTransparentWrapper([])).toBe(false);
  });
});

describe("isTransparentWrapper — CategoryTreeNode rows", () => {
  it("reads children_as surviving a depth cut, same as a flat row's tn_children_pks", () => {
    // A `?depth=1` read cuts the nested `children` array to `[]`, but a row
    // that truly has some never gets `children_as: null` — see stage.ts.
    const wrapper = treeNode(1410, "offer", "category.offer", "141/1410", {
      children_as: "tiles",
      children: [],
    });
    expect(isTransparentWrapper([wrapper])).toBe(true);
  });

  it("is false for a single leaf tree node", () => {
    const leaf = treeNode(4, "used-phones", "category.used_phones", "1/2/4");
    expect(isTransparentWrapper([leaf])).toBe(false);
  });
});

describe("browseChildren", () => {
  it("returns the grandchildren when the sole child is a wrapper", () => {
    const group1 = categoryRow(1, "group-1", "category.group_1", 1410, "141,1410", "");
    const group2 = categoryRow(2, "group-2", "category.group_2", 1410, "141,1410", "");
    const wrapper = categoryRow(1410, "offer", "category.offer", 141, "141", "1,2");
    const drawn = browseChildren([wrapper], (child) =>
      child.id === wrapper.id ? [group1, group2] : undefined
    );
    expect(drawn).toEqual([group1, group2]);
  });

  it("falls back to the wrapper itself while its children are not loaded yet", () => {
    const wrapper = categoryRow(1410, "offer", "category.offer", 141, "141", "1,2");
    const drawn = browseChildren([wrapper], () => undefined);
    expect(drawn).toEqual([wrapper]);
  });

  it("leaves a single LEAF child unchanged — it is not skipped", () => {
    const leaf = categoryRow(4, "used-phones", "category.used_phones", 2, "1,2", "");
    const drawn = browseChildren([leaf], () => {
      throw new Error("must not be called for a non-wrapper");
    });
    expect(drawn).toEqual([leaf]);
  });

  it("leaves two children unchanged", () => {
    const a = categoryRow(2, "cars-new", "category.cars_new", 1, "1", "10,11");
    const b = categoryRow(3, "cars-used", "category.cars_used", 1, "1", "");
    const drawn = browseChildren([a, b], () => {
      throw new Error("must not be called with more than one child");
    });
    expect(drawn).toEqual([a, b]);
  });

  it("does not chase a wrapper-of-a-wrapper past one hop", () => {
    // The wrapper's own single "grandchild" answer is itself wrapper-shaped
    // (one child, with children). browseChildren stops after resolving the
    // FIRST hop — it never calls grandchildrenOf on what it returns.
    const innerWrapper = categoryRow(20, "inner", "category.inner", 10, "141,10", "30,31");
    const wrapper = categoryRow(10, "offer", "category.offer", 141, "141", "20");
    const drawn = browseChildren([wrapper], (child) =>
      child.id === wrapper.id ? [innerWrapper] : undefined
    );
    expect(drawn).toEqual([innerWrapper]);
  });

  it("works over a nested CategoryTreeNode via its own children field", () => {
    const group1 = treeNode(1, "group-1", "category.group_1", "141/1410/1");
    const group2 = treeNode(2, "group-2", "category.group_2", "141/1410/2");
    const wrapper = treeNode(1410, "offer", "category.offer", "141/1410", {
      children_as: "tiles",
      children: [group1, group2],
    });
    const drawn = browseChildren([wrapper], (child) => child.children);
    expect(drawn).toEqual([group1, group2]);
  });
});

describe("isTransparentNode", () => {
  it("is true for an authored transparent row with children", () => {
    const node = categoryRow(10, "offer", "category.offer", 1, "1", "20,21", {
      children_as: "transparent",
    });
    expect(isTransparentNode(node)).toBe(true);
  });

  it("is true even for a row this predicate cannot see is a leaf — a pure field read", () => {
    const flaggedLeaf = categoryRow(10, "offer", "category.offer", 1, "1", "", {
      children_as: "transparent",
    });
    expect(isTransparentNode(flaggedLeaf)).toBe(true);
  });

  it("is false for tiles/chips/null", () => {
    expect(isTransparentNode(categoryRow(1, "a", "a", null, "", "", { children_as: "tiles" }))).toBe(false);
    expect(isTransparentNode(categoryRow(1, "a", "a", null, "", "", { children_as: "chips" }))).toBe(false);
    expect(isTransparentNode(categoryRow(1, "a", "a", null, "", "", { children_as: null }))).toBe(false);
  });
});

describe("browseChildren — an authored transparent child AMONG several siblings", () => {
  it("splices a transparent sibling's children in place, order kept, when it is not the only child", () => {
    const before = categoryRow(1, "before", "category.before", 100, "100", "");
    const transparentChild = categoryRow(2, "offer", "category.offer", 100, "100", "30,31", {
      children_as: "transparent",
    });
    const after = categoryRow(3, "after", "category.after", 100, "100", "");
    const grand1 = categoryRow(30, "g1", "category.g1", 2, "100,2", "");
    const grand2 = categoryRow(31, "g2", "category.g2", 2, "100,2", "");
    const drawn = browseChildren(
      [before, transparentChild, after],
      (child) => (child.id === transparentChild.id ? [grand1, grand2] : undefined)
    );
    expect(drawn).toEqual([before, grand1, grand2, after]);
  });

  it("still splices a transparent LONE child, same as a structural wrapper", () => {
    const transparentChild = categoryRow(2, "offer", "category.offer", 100, "100", "30", {
      children_as: "transparent",
    });
    const grand = categoryRow(30, "g1", "category.g1", 2, "100,2", "");
    const drawn = browseChildren([transparentChild], (child) =>
      child.id === transparentChild.id ? [grand] : undefined
    );
    expect(drawn).toEqual([grand]);
  });

  it("still treats a NON-flagged lone wrapper as transparent (unchanged behaviour)", () => {
    const wrapper = categoryRow(1410, "offer", "category.offer", 141, "141", "1,2");
    const g1 = categoryRow(1, "g1", "category.g1", 1410, "141,1410", "");
    const g2 = categoryRow(2, "g2", "category.g2", 1410, "141,1410", "");
    const drawn = browseChildren([wrapper], (child) =>
      child.id === wrapper.id ? [g1, g2] : undefined
    );
    expect(drawn).toEqual([g1, g2]);
  });

  it("falls back to that ONE child's own tile while its children are not loaded, siblings unaffected", () => {
    const before = categoryRow(1, "before", "category.before", 100, "100", "");
    const transparentChild = categoryRow(2, "offer", "category.offer", 100, "100", "30", {
      children_as: "transparent",
    });
    const drawn = browseChildren([before, transparentChild], () => undefined);
    expect(drawn).toEqual([before, transparentChild]);
  });

  it("ignores a flagged LEAF — a leaf cannot be transparent — and warns in dev", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const before = categoryRow(1, "before", "category.before", 100, "100", "");
    const flaggedLeaf = categoryRow(2, "offer", "category.offer", 100, "100", "", {
      children_as: "transparent",
    });
    const drawn = browseChildren([before, flaggedLeaf], () => {
      throw new Error("must not be called for a flagged leaf");
    });
    expect(drawn).toEqual([before, flaggedLeaf]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does not chase a spliced-in grandchild that is itself transparent — one hop", () => {
    const innerTransparent = categoryRow(20, "inner", "category.inner", 2, "100,2", "30,31", {
      children_as: "transparent",
    });
    const transparentChild = categoryRow(2, "offer", "category.offer", 100, "100", "20", {
      children_as: "transparent",
    });
    const drawn = browseChildren([transparentChild], (child) =>
      child.id === transparentChild.id ? [innerTransparent] : undefined
    );
    expect(drawn).toEqual([innerTransparent]);
  });
});

describe("isWrapperAncestor — the breadcrumb-trail question", () => {
  it("is true for a parent/child step across a one-hop wrapper", () => {
    // "Services" (141) -> "Services offer" (1410, one child) -> groups (1).
    const root = categoryRow(141, "uslugi", "category.uslugi", null, "", "1410");
    const wrapper = categoryRow(1410, "offer", "category.offer", 141, "141", "1");
    expect(isWrapperAncestor(root, wrapper)).toBe(true);
  });

  it("is false when the parent has more than one child", () => {
    const root = categoryRow(1, "electronics", "category.electronics", null, "", "2,3");
    const phones = categoryRow(2, "phones", "category.phones", 1, "1", "4");
    expect(isWrapperAncestor(root, phones)).toBe(false);
  });

  it("is true for an authored transparent child even among several siblings", () => {
    const root = categoryRow(100, "root", "category.root", null, "", "1,2,3");
    const transparentChild = categoryRow(2, "offer", "category.offer", 100, "100", "30", {
      children_as: "transparent",
    });
    expect(isWrapperAncestor(root, transparentChild)).toBe(true);
  });

  it("is false when the only child is itself a leaf", () => {
    const parent = categoryRow(1, "root", "category.root", null, "", "2");
    const leaf = categoryRow(2, "leaf", "category.leaf", 1, "1", "");
    expect(isWrapperAncestor(parent, leaf)).toBe(false);
  });

  it("is false when the parent row carries no tn_children_pks at all", () => {
    const parent = { slug: "root" } as unknown as Parameters<
      typeof isWrapperAncestor
    >[0];
    const child = categoryRow(2, "leaf", "category.leaf", 1, "1", "3");
    expect(isWrapperAncestor(parent, child)).toBe(false);
  });
});
