/**
 * `isTransparentWrapper` / `browseChildren` — the census addendum's one-hop
 * rule: a node with exactly one child, itself with children of its own, is a
 * wrapper a tile page skips over to its grandchildren.
 */
import { describe, expect, it } from "vitest";
import { browseChildren, isTransparentWrapper, isWrapperAncestor } from "../src/index.js";
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
