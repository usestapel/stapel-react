// @vitest-environment jsdom
/**
 * `lockPageScroll` — the one page-scroll lock every panel in the fleet holds.
 *
 * Before it was exported, `SkinDialog` and `CategoryMegaMenu` each carried a
 * private copy (a third was on its way). The contract under test is the one
 * both copies claimed: the ROOT element's inline overflow is what changes,
 * the gutter is kept while the bar is gone, overlapping locks are counted,
 * and the host's own inline values come back exactly.
 */
import { afterEach, describe, expect, it } from "vitest";
import { lockPageScroll, pageScrollLockCount } from "../src/skin.js";

const root = (): HTMLElement => document.documentElement;

afterEach(() => {
  root().removeAttribute("style");
});

describe("lockPageScroll", () => {
  it("hides the root's overflow and keeps the gutter while locked; restores a clean root", () => {
    expect(pageScrollLockCount()).toBe(0);
    const unlock = lockPageScroll();
    expect(root().style.overflow).toBe("hidden");
    expect(root().style.scrollbarGutter).toBe("stable");
    expect(pageScrollLockCount()).toBe(1);
    unlock();
    expect(root().style.overflow).toBe("");
    expect(root().style.scrollbarGutter).toBe("");
    expect(root().getAttribute("style")).toBeFalsy();
    expect(pageScrollLockCount()).toBe(0);
  });

  it("is reference-counted: the inner panel closing does not hand the page back under the outer one", () => {
    const outer = lockPageScroll();
    const inner = lockPageScroll();
    expect(pageScrollLockCount()).toBe(2);
    inner();
    expect(root().style.overflow).toBe("hidden");
    expect(pageScrollLockCount()).toBe(1);
    outer();
    expect(root().style.overflow).toBe("");
    expect(pageScrollLockCount()).toBe(0);
  });

  it("gives back exactly the inline values the host had written", () => {
    root().style.overflow = "clip";
    root().style.scrollbarGutter = "auto";
    const unlock = lockPageScroll();
    expect(root().style.overflow).toBe("hidden");
    expect(root().style.scrollbarGutter).toBe("stable");
    unlock();
    expect(root().style.overflow).toBe("clip");
    expect(root().style.scrollbarGutter).toBe("auto");
  });

  it("an unlock called twice releases once — a strict-mode double cleanup cannot go negative", () => {
    const a = lockPageScroll();
    const b = lockPageScroll();
    a();
    a();
    expect(pageScrollLockCount()).toBe(1);
    expect(root().style.overflow).toBe("hidden");
    b();
    expect(pageScrollLockCount()).toBe(0);
    expect(root().style.overflow).toBe("");
  });
});
