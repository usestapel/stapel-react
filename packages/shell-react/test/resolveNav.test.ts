/**
 * `resolveNav` — pure function, unit-testable in isolation (no React, no
 * I/O). Covers the numeric gates from the Ф1 lib-side spec: top-vs-submenu
 * nesting, `menuVisibleDefault` respected, an override file flipping
 * `menuVisible`/`order`, and a submenu entry whose parent is absent
 * degrading gracefully (documented, not a crash).
 */
import { describe, expect, it } from "vitest";
import type { NavEntry, PackageNavManifest } from "@stapel/core";
import { resolveNav } from "../src/headless/resolveNav.js";

function entry(overrides: Partial<NavEntry> & Pick<NavEntry, "id">): NavEntry {
  return {
    labelKey: `${overrides.id}.label`,
    icon: "AppstoreOutlined",
    route: { path: overrides.id },
    component: { export: "Component", subpath: "default" },
    placement: { level: "top" },
    menuVisibleDefault: true,
    requiresAuth: false,
    order: 0,
    ...overrides,
  };
}

function manifest(pkg: string, entries: readonly NavEntry[]): PackageNavManifest {
  return { package: pkg, version: "1.0.0", entries };
}

describe("resolveNav — merging + sorting", () => {
  it("merges multiple installed packages' entries into one flat top-level list, sorted by order", () => {
    const installed = [
      manifest("@stapel/a", [entry({ id: "a.one", order: 20 })]),
      manifest("@stapel/b", [entry({ id: "b.one", order: 10 })]),
    ];
    const resolved = resolveNav(installed);
    expect(resolved.map((e) => e.id)).toEqual(["b.one", "a.one"]);
  });

  it("breaks order ties by id for a deterministic result", () => {
    const installed = [
      manifest("@stapel/a", [entry({ id: "zeta", order: 5 }), entry({ id: "alpha", order: 5 })]),
    ];
    const resolved = resolveNav(installed);
    expect(resolved.map((e) => e.id)).toEqual(["alpha", "zeta"]);
  });
});

describe("resolveNav — top-vs-submenu nesting", () => {
  it("nests a submenu entry under its parentId's children, sorted independently from top-level order", () => {
    const installed = [
      manifest("@stapel/profiles", [entry({ id: "profiles.settings", order: 90 })]),
      manifest("@stapel/auth", [
        entry({
          id: "auth.security",
          order: 10,
          placement: { level: "submenu", parentId: "profiles.settings" },
        }),
        entry({
          id: "auth.login",
          order: 0,
          menuVisibleDefault: false, // redirect target — see next describe block
        }),
      ]),
    ];
    const resolved = resolveNav(installed);
    // auth.login is invisible by default, so only profiles.settings surfaces
    // at the top level — with auth.security nested under it.
    expect(resolved.map((e) => e.id)).toEqual(["profiles.settings"]);
    expect(resolved[0]?.children?.map((c) => c.id)).toEqual(["auth.security"]);
  });

  it("a top-level entry with no submenu children carries no children key at all", () => {
    const installed = [manifest("@stapel/a", [entry({ id: "a.one" })])];
    const resolved = resolveNav(installed);
    expect("children" in (resolved[0] ?? {})).toBe(false);
  });

  it("sorts children by their own (order, id), independent of the parent's order", () => {
    const installed = [
      manifest("@stapel/p", [entry({ id: "p.top", order: 0 })]),
      manifest("@stapel/c", [
        entry({ id: "c.two", order: 20, placement: { level: "submenu", parentId: "p.top" } }),
        entry({ id: "c.one", order: 10, placement: { level: "submenu", parentId: "p.top" } }),
      ]),
    ];
    const resolved = resolveNav(installed);
    expect(resolved[0]?.children?.map((c) => c.id)).toEqual(["c.one", "c.two"]);
  });
});

describe("resolveNav — menuVisibleDefault respected", () => {
  it("drops a top-level entry whose menuVisibleDefault is false (e.g. a login redirect target)", () => {
    const installed = [
      manifest("@stapel/auth", [entry({ id: "auth.login", menuVisibleDefault: false })]),
    ];
    expect(resolveNav(installed)).toEqual([]);
  });

  it("keeps a top-level entry whose menuVisibleDefault is true", () => {
    const installed = [
      manifest("@stapel/auth", [entry({ id: "auth.login", menuVisibleDefault: true })]),
    ];
    expect(resolveNav(installed).map((e) => e.id)).toEqual(["auth.login"]);
  });

  it("a top entry that resolves invisible drops its entire subtree, including visible children", () => {
    const installed = [
      manifest("@stapel/p", [entry({ id: "p.top", menuVisibleDefault: false })]),
      manifest("@stapel/c", [
        entry({ id: "c.child", placement: { level: "submenu", parentId: "p.top" } }),
      ]),
    ];
    expect(resolveNav(installed)).toEqual([]);
  });
});

describe("resolveNav — override file flips menuVisible and order", () => {
  it("an override's menuVisible:true surfaces an entry whose menuVisibleDefault is false", () => {
    const installed = [
      manifest("@stapel/auth", [entry({ id: "auth.login", menuVisibleDefault: false })]),
    ];
    const resolved = resolveNav(installed, { overrides: { "auth.login": { menuVisible: true } } });
    expect(resolved.map((e) => e.id)).toEqual(["auth.login"]);
    expect(resolved[0]?.menuVisible).toBe(true);
  });

  it("an override's menuVisible:false hides an entry whose menuVisibleDefault is true", () => {
    const installed = [manifest("@stapel/a", [entry({ id: "a.one", menuVisibleDefault: true })])];
    const resolved = resolveNav(installed, { overrides: { "a.one": { menuVisible: false } } });
    expect(resolved).toEqual([]);
  });

  it("an override's order re-sorts entries relative to their siblings", () => {
    const installed = [
      manifest("@stapel/a", [entry({ id: "a.one", order: 0 }), entry({ id: "a.two", order: 10 })]),
    ];
    const resolved = resolveNav(installed, { overrides: { "a.one": { order: 20 } } });
    expect(resolved.map((e) => e.id)).toEqual(["a.two", "a.one"]);
    expect(resolved[1]?.order).toBe(20);
  });

  it("an entry with no matching override entry keeps its defaults untouched", () => {
    const installed = [manifest("@stapel/a", [entry({ id: "a.one", order: 5 })])];
    const resolved = resolveNav(installed, { overrides: { "a.other": { order: 999 } } });
    expect(resolved[0]?.order).toBe(5);
  });

  it("no override file at all behaves identically to an empty one", () => {
    const installed = [manifest("@stapel/a", [entry({ id: "a.one" })])];
    expect(resolveNav(installed)).toEqual(resolveNav(installed, {}));
    expect(resolveNav(installed)).toEqual(resolveNav(installed, { overrides: {} }));
  });
});

describe("resolveNav — an orphaned submenu entry degrades gracefully", () => {
  it("drops (does not throw, does not promote) a submenu entry whose parentId matches no installed top entry", () => {
    const installed = [
      manifest("@stapel/auth", [
        entry({ id: "auth.security", placement: { level: "submenu", parentId: "profiles.settings" } }),
      ]),
    ];
    expect(() => resolveNav(installed)).not.toThrow();
    expect(resolveNav(installed)).toEqual([]);
  });

  it("still resolves the OTHER sibling packages' entries normally when one submenu entry is orphaned", () => {
    const installed = [
      manifest("@stapel/auth", [
        entry({ id: "auth.security", placement: { level: "submenu", parentId: "profiles.settings" } }),
      ]),
      manifest("@stapel/notifications", [entry({ id: "notifications.feed" })]),
    ];
    expect(resolveNav(installed).map((e) => e.id)).toEqual(["notifications.feed"]);
  });
});
