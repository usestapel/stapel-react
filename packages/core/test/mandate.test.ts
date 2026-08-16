/**
 * The mandate axis, at the level where the vocabulary lives.
 *
 * Two properties are pinned here because both are the difference between a
 * screen that teaches and a screen that lies:
 *
 *  1. `"unresolved"` carries no verdict. There is no member of the union that
 *     spells "we could not ask, so treat them as barred" — the only way to
 *     read a principal off a `MandateState` is to have one.
 *  2. `matchMandate` requires FIVE arms. A host cannot let "asking" fall into
 *     the same branch as "anonymous" by omission, which is exactly how a wait
 *     turns into a refusal.
 */
import { describe, expect, it } from "vitest";
import {
  isMandateResolved,
  mandateAsking,
  mandateResolved,
  mandateUnavailable,
  matchMandate,
  navEntrySurface,
  navSurfaceVisibleTo,
} from "../src/index.js";
import type { MandateState, NavEntry } from "../src/index.js";

describe("MandateState", () => {
  it("names the two ways a mandate can be unknown, and keeps them apart", () => {
    const asking = mandateAsking();
    const unavailable = mandateUnavailable(new Error("502"));

    expect(asking.mandate).toBe("unresolved");
    expect(asking.reason).toBe("asking");
    expect(unavailable.mandate).toBe("unresolved");
    expect(unavailable.reason).toBe("unavailable");
    expect((unavailable.error as Error).message).toBe("502");
  });

  it("does not let an unresolved state be read as a principal", () => {
    const state: MandateState = mandateUnavailable(new Error("502"));
    expect(isMandateResolved(state)).toBe(false);
    if (isMandateResolved(state)) {
      // Narrowed only here — the compiler forbids `state.mandate` being used
      // as a `MandatePrincipal` outside this branch, which is the point.
      expect(state.mandate).toBe("member");
    }
  });

  it("matchMandate renders each of the five states through its own arm", () => {
    const arms = {
      anonymous: () => "anonymous",
      guest: () => "guest",
      member: () => "member",
      asking: () => "wait",
      unavailable: (error: unknown) => `error:${String((error as Error).message)}`,
    };

    expect(matchMandate(mandateResolved("anonymous"), arms)).toBe("anonymous");
    expect(matchMandate(mandateResolved("guest"), arms)).toBe("guest");
    expect(matchMandate(mandateResolved("member"), arms)).toBe("member");
    expect(matchMandate(mandateAsking(), arms)).toBe("wait");
    expect(matchMandate(mandateUnavailable(new Error("boom")), arms)).toBe("error:boom");
  });
});

function entry(over: Partial<NavEntry>): NavEntry {
  return {
    id: "x.y",
    labelKey: "x.y",
    icon: "AppstoreOutlined",
    route: { path: "y" },
    component: { export: "Y", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: false,
    order: 10,
    ...over,
  };
}

describe("the nav surface axis", () => {
  it("derives a surface from requiresAuth when a manifest declares none", () => {
    expect(navEntrySurface(entry({ requiresAuth: true }))).toBe("member");
    expect(navEntrySurface(entry({ requiresAuth: false }))).toBe("public");
  });

  it("lets an explicit surface answer instead — a meeting joined by link is public to an authenticated caller", () => {
    expect(navEntrySurface(entry({ requiresAuth: true, surface: "public" }))).toBe("public");
    expect(navEntrySurface(entry({ requiresAuth: false, surface: "member" }))).toBe("member");
  });

  it("opens a member surface to a mandate and to nobody else", () => {
    expect(navSurfaceVisibleTo("member", "member")).toBe(true);
    expect(navSurfaceVisibleTo("member", "guest")).toBe(false);
    expect(navSurfaceVisibleTo("member", "anonymous")).toBe(false);

    expect(navSurfaceVisibleTo("public", "member")).toBe(true);
    expect(navSurfaceVisibleTo("public", "guest")).toBe(true);
    expect(navSurfaceVisibleTo("public", "anonymous")).toBe(true);
  });
});
