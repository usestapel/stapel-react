/**
 * `resolveNav` — pure function, unit-testable in isolation (no React, no
 * I/O). Covers the numeric gates from the Phase 1 lib-side spec: top-vs-submenu
 * nesting, `menuVisibleDefault` respected, an override file flipping
 * `menuVisible`/`order`, and a submenu entry whose parent is absent
 * degrading gracefully (documented, not a crash).
 */
import { describe, expect, it } from "vitest";
import type { NavEntry, PackageNavManifest } from "@stapel/core";
import {
  ADMIN_ROOT_ID,
  adminNavIds,
  resolveMemberNav,
  resolveNav,
  resolvePublicNav,
} from "../src/headless/resolveNav.js";

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

/**
 * The surface axis. Before it, `requiresAuth` was a declared field nothing
 * read: a signed-in guest with no mandate anywhere got every installed
 * module's menu entry, walked into each screen, and collected a 403 per
 * click. `resolveNav` is where the fleet's nav truth is computed once, so
 * it is where the axis has to be consumed — not in each host's menu.
 */
describe("resolveNav — the surface axis", () => {
  const installed = [
    manifest("@stapel/auth", [
      entry({ id: "auth.login", requiresAuth: false, order: 10 }),
      entry({ id: "meet.room", requiresAuth: true, surface: "public", order: 20 }),
    ]),
    manifest("@stapel/profiles", [
      entry({ id: "profiles.settings", requiresAuth: true, order: 30 }),
    ]),
  ];

  it("resolves every entry's surface, declared or derived", () => {
    const resolved = resolveNav(installed);
    expect(resolved.map((e) => [e.id, e.surface])).toEqual([
      ["auth.login", "public"],
      ["meet.room", "public"],
      ["profiles.settings", "member"],
    ]);
  });

  it("returns the whole tree when no audience is given — the scaffold bakes every route", () => {
    expect(resolveNav(installed).map((e) => e.id)).toEqual([
      "auth.login",
      "meet.room",
      "profiles.settings",
    ]);
  });

  it("keeps member screens for a member", () => {
    const resolved = resolveNav(installed, undefined, { audience: "member" });
    expect(resolved.map((e) => e.id)).toEqual(["auth.login", "meet.room", "profiles.settings"]);
  });

  it("drops member screens for a mandate-less guest, keeping the public ones", () => {
    const resolved = resolveNav(installed, undefined, { audience: "guest" });
    expect(resolved.map((e) => e.id)).toEqual(["auth.login", "meet.room"]);
  });

  it("treats an anonymous caller exactly as a guest on this axis", () => {
    const guest = resolveNav(installed, undefined, { audience: "guest" });
    const anon = resolveNav(installed, undefined, { audience: "anonymous" });
    expect(anon.map((e) => e.id)).toEqual(guest.map((e) => e.id));
  });

  it("drops a member parent's whole subtree, public children included", () => {
    const tree = [
      manifest("@stapel/profiles", [entry({ id: "profiles.settings", requiresAuth: true })]),
      manifest("@stapel/auth", [
        entry({
          id: "auth.security",
          requiresAuth: true,
          surface: "public",
          placement: { level: "submenu", parentId: "profiles.settings" },
        }),
      ]),
    ];
    expect(resolveNav(tree, undefined, { audience: "guest" })).toEqual([]);
    expect(resolveNav(tree, undefined, { audience: "member" })[0]?.children?.map((c) => c.id)).toEqual([
      "auth.security",
    ]);
  });

  it("drops a member child from a public parent's submenu", () => {
    const tree = [
      manifest("@stapel/a", [entry({ id: "a.top", requiresAuth: false })]),
      manifest("@stapel/b", [
        entry({
          id: "b.public",
          requiresAuth: false,
          placement: { level: "submenu", parentId: "a.top" },
          order: 1,
        }),
        entry({
          id: "b.member",
          requiresAuth: true,
          placement: { level: "submenu", parentId: "a.top" },
          order: 2,
        }),
      ]),
    ];
    const resolved = resolveNav(tree, undefined, { audience: "guest" });
    expect(resolved[0]?.children?.map((c) => c.id)).toEqual(["b.public"]);
  });

  it("does not let an override file put a member screen back in front of a guest", () => {
    const resolved = resolveNav(
      installed,
      { overrides: { "profiles.settings": { menuVisible: true, order: 1 } } },
      { audience: "guest" }
    );
    expect(resolved.map((e) => e.id)).toEqual(["auth.login", "meet.room"]);
  });
});

describe("resolvePublicNav / resolveMemberNav — the audience is in the name", () => {
  const installed = [
    manifest("@stapel/auth", [
      entry({ id: "auth.login", requiresAuth: false, order: 10 }),
      entry({ id: "auth.qr_confirm", requiresAuth: true, surface: "public", order: 20 }),
    ]),
    manifest("@stapel/listings", [
      entry({ id: "listings.compose", requiresAuth: true, order: 30 }),
    ]),
  ];

  it("resolvePublicNav drops every member screen", () => {
    expect(resolvePublicNav(installed).map((e) => e.id)).toEqual(["auth.login"]);
  });

  it("resolvePublicNav also drops a PUBLIC screen that still needs a session", () => {
    // auth.qr_confirm is `surface: "public"` (no mandate: a signed-in phone
    // confirming a signed-out desktop) and `requiresAuth: true`. The surface
    // axis alone hands it to an anonymous visitor, whose click lands on the
    // sign-in redirect — a door that opens onto a bounce.
    const anonymous = resolvePublicNav(installed).map((e) => e.id);
    expect(anonymous).not.toContain("auth.qr_confirm");
    expect(resolveMemberNav(installed).map((e) => e.id)).toContain("auth.qr_confirm");
  });

  it("resolveMemberNav keeps them", () => {
    expect(resolveMemberNav(installed).map((e) => e.id)).toEqual([
      "auth.login",
      "auth.qr_confirm",
      "listings.compose",
    ]);
  });

  it("each equals the explicit-audience call it stands for — one implementation, two names", () => {
    expect(resolvePublicNav(installed)).toEqual(
      resolveNav(installed, undefined, { audience: "anonymous", authenticated: false })
    );
    expect(resolveMemberNav(installed)).toEqual(
      resolveNav(installed, undefined, { audience: "member", authenticated: true })
    );
  });

  it("still honours an override file", () => {
    const overrides = { overrides: { "auth.login": { menuVisible: false } } };
    expect(resolvePublicNav(installed, overrides).map((e) => e.id)).toEqual([]);
    expect(resolveMemberNav(installed, overrides).map((e) => e.id)).toEqual([
      "auth.qr_confirm",
      "listings.compose",
    ]);
  });

  it("differs from the audience-less default, which filters nothing — the trap these exist for", () => {
    expect(resolveNav(installed).map((e) => e.id)).toContain("listings.compose");
    expect(resolvePublicNav(installed).map((e) => e.id)).not.toContain("listings.compose");
  });
});

/**
 * `requiresAuth` — the axis the manifest emitted and nothing read.
 *
 * It is NOT a synonym for `surface`. `surface` answers "does this screen need
 * a MANDATE" and `requiresAuth` answers "does it need a SESSION", and the
 * pair that shows why is `auth.qr_confirm`: public surface, session required.
 * The audience filter alone leaves it in an anonymous visitor's menu, where
 * every click ends at the sign-in redirect.
 */
describe("resolveNav — the session axis (requiresAuth)", () => {
  const installed = [
    manifest("@stapel/auth", [
      entry({ id: "auth.login", requiresAuth: false, order: 10 }),
      entry({ id: "auth.qr_confirm", requiresAuth: true, surface: "public", order: 20 }),
    ]),
  ];

  it("filters nothing when the caller does not say — the scaffold bakes every route", () => {
    expect(resolveNav(installed).map((e) => e.id)).toEqual([
      "auth.login",
      "auth.qr_confirm",
    ]);
  });

  it("keeps a session-only screen for a caller that has a session", () => {
    const resolved = resolveNav(installed, undefined, { authenticated: true });
    expect(resolved.map((e) => e.id)).toEqual(["auth.login", "auth.qr_confirm"]);
  });

  it("drops a session-only screen for a caller with no session, whatever its surface says", () => {
    const resolved = resolveNav(installed, undefined, { authenticated: false });
    expect(resolved.map((e) => e.id)).toEqual(["auth.login"]);
  });

  it("is independent of the surface axis — both gates apply", () => {
    const tree = [
      manifest("@stapel/a", [
        entry({ id: "a.public_open", requiresAuth: false, surface: "public", order: 1 }),
        entry({ id: "a.public_session", requiresAuth: true, surface: "public", order: 2 }),
        entry({ id: "a.member", requiresAuth: true, surface: "member", order: 3 }),
      ]),
    ];
    expect(
      resolveNav(tree, undefined, { audience: "guest", authenticated: true }).map((e) => e.id)
    ).toEqual(["a.public_open", "a.public_session"]);
    expect(
      resolveNav(tree, undefined, { audience: "guest", authenticated: false }).map((e) => e.id)
    ).toEqual(["a.public_open"]);
    expect(
      resolveNav(tree, undefined, { audience: "member", authenticated: true }).map((e) => e.id)
    ).toEqual(["a.public_open", "a.public_session", "a.member"]);
  });

  it("drops a session-only PARENT's whole subtree", () => {
    const tree = [
      manifest("@stapel/a", [entry({ id: "a.top", requiresAuth: true, surface: "public" })]),
      manifest("@stapel/b", [
        entry({
          id: "b.child",
          requiresAuth: false,
          placement: { level: "submenu", parentId: "a.top" },
        }),
      ]),
    ];
    expect(resolveNav(tree, undefined, { authenticated: false })).toEqual([]);
  });
});

/**
 * `route.index` — the other field the contract emitted and nothing read.
 *
 * An index route mounts at its SECTION's address, so an index child that
 * linked to a segment of its own name pointed at a route that does not exist,
 * and the menu's matcher — which compared `route.path` to the last segment of
 * the location — never selected it either. Both halves are the resolved
 * `linkPath`.
 */
describe("resolveNav — route.index", () => {
  it("an entry with no index at all resolves to index:false and its own path", () => {
    const resolved = resolveNav([manifest("@stapel/a", [entry({ id: "a.one" })])]);
    expect(resolved[0]?.index).toBe(false);
    expect(resolved[0]?.linkPath).toBe("a.one");
  });

  it("an explicit index:false is the same answer as omitting it", () => {
    const omitted = resolveNav([manifest("@stapel/a", [entry({ id: "a.one" })])]);
    const explicit = resolveNav([
      manifest("@stapel/a", [entry({ id: "a.one", route: { path: "a.one", index: false } })]),
    ]);
    expect(explicit[0]?.index).toBe(false);
    expect(explicit[0]?.linkPath).toBe(omitted[0]?.linkPath);
  });

  it("an index CHILD takes its section's address, not a segment of its own", () => {
    const installed = [
      manifest("@stapel/profiles", [
        entry({ id: "profiles.settings", route: { path: "settings" } }),
      ]),
      manifest("@stapel/auth", [
        entry({
          id: "auth.overview",
          route: { path: "overview", index: true },
          placement: { level: "submenu", parentId: "profiles.settings" },
        }),
      ]),
    ];
    const child = resolveNav(installed)[0]?.children?.[0];
    expect(child?.index).toBe(true);
    // The declaration is preserved verbatim…
    expect(child?.route).toEqual({ path: "overview", index: true });
    // …and the ADDRESS is the section's, which is where the route mounts.
    expect(child?.linkPath).toBe("settings");
  });

  it("a NON-index child keeps its own segment", () => {
    const installed = [
      manifest("@stapel/profiles", [
        entry({ id: "profiles.settings", route: { path: "settings" } }),
      ]),
      manifest("@stapel/auth", [
        entry({
          id: "auth.security",
          route: { path: "security" },
          placement: { level: "submenu", parentId: "profiles.settings" },
        }),
      ]),
    ];
    expect(resolveNav(installed)[0]?.children?.[0]?.linkPath).toBe("security");
  });

  it("an index TOP entry keeps its own path — the shell knows no address above it", () => {
    const resolved = resolveNav([
      manifest("@stapel/a", [entry({ id: "a.home", route: { path: "/", index: true } })]),
    ]);
    expect(resolved[0]?.index).toBe(true);
    expect(resolved[0]?.linkPath).toBe("/");
  });
});

/**
 * `admin.root` — the parent nobody declared.
 *
 * gdpr's DSAR queue and video's usage table both hang from it; no pair owns
 * "the admin section", so `resolveNav`'s orphan-drop removed both screens in
 * every host, silently. The section is synthesised instead — and it is NOT
 * gated away from a non-staff person here: hiding it would leave them nothing
 * to ask about (the staff gate is `<AppShell staff={…}/>`, which lists it and
 * states the reason).
 */
describe("resolveNav — the admin section", () => {
  const adminChild = (id: string, order = 10) =>
    entry({
      id,
      order,
      requiresAuth: true,
      surface: "member",
      placement: { level: "submenu", parentId: ADMIN_ROOT_ID },
    });

  it("synthesises the parent when a pair hangs a screen from it", () => {
    const resolved = resolveNav([manifest("@stapel/gdpr", [adminChild("admin.privacy")])]);
    expect(resolved.map((e) => e.id)).toEqual([ADMIN_ROOT_ID]);
    expect(resolved[0]?.children?.map((c) => c.id)).toEqual(["admin.privacy"]);
    expect(resolved[0]?.labelKey).toBe("shell.nav.admin");
  });

  it("collects every pair's staff screens under the one section, in order", () => {
    const resolved = resolveNav([
      manifest("@stapel/video", [adminChild("admin.usage", 20)]),
      manifest("@stapel/gdpr", [adminChild("admin.privacy", 10)]),
    ]);
    expect(resolved[0]?.children?.map((c) => c.id)).toEqual([
      "admin.privacy",
      "admin.usage",
    ]);
  });

  it("does NOT invent the section when nothing hangs from it", () => {
    const resolved = resolveNav([manifest("@stapel/a", [entry({ id: "a.one" })])]);
    expect(resolved.map((e) => e.id)).toEqual(["a.one"]);
  });

  it("steps aside for a host that declares its own admin root", () => {
    const own = entry({
      id: ADMIN_ROOT_ID,
      labelKey: "app.nav.operations",
      icon: "AppstoreOutlined",
      order: 5,
    });
    const resolved = resolveNav([
      manifest("app", [own]),
      manifest("@stapel/gdpr", [adminChild("admin.privacy")]),
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.labelKey).toBe("app.nav.operations");
    expect(resolved[0]?.children?.map((c) => c.id)).toEqual(["admin.privacy"]);
  });

  it("is a MEMBER surface: an anonymous storefront never grows an admin tab", () => {
    const installed = [manifest("@stapel/gdpr", [adminChild("admin.privacy")])];
    expect(resolvePublicNav(installed)).toEqual([]);
    expect(resolveMemberNav(installed).map((e) => e.id)).toEqual([ADMIN_ROOT_ID]);
  });

  it("adminNavIds names the section and everything inside it, and nothing else", () => {
    const resolved = resolveNav([
      manifest("@stapel/a", [entry({ id: "a.one" })]),
      manifest("@stapel/gdpr", [adminChild("admin.privacy")]),
      manifest("@stapel/video", [adminChild("admin.usage", 20)]),
    ]);
    expect([...adminNavIds(resolved)].sort()).toEqual(
      ["admin.privacy", "admin.usage", ADMIN_ROOT_ID].sort()
    );
  });

  it("adminNavIds is empty for a tree with no admin section", () => {
    const resolved = resolveNav([manifest("@stapel/a", [entry({ id: "a.one" })])]);
    expect(adminNavIds(resolved).size).toBe(0);
  });
});

/**
 * The override file's SURFACE and SESSION axes.
 *
 * A module declares who its screen is for in the abstract — `chat` is a member
 * surface, `listings.favorites` needs an account. A container knows what it
 * actually mounted around those routes, and the two answers are not the same
 * product: a classified storefront puts Favourites and Messages in its phone
 * dock for an anonymous visitor because it mounted a guest wall in front of
 * them. That is a container decision, so the container's own file is where it
 * is stated — not a fork of the module's manifest.
 *
 * Both axes are overridable, and that is not two features. Overriding one
 * alone is, for this case, a setting that does nothing: a `member` +
 * `requiresAuth` entry moved to `"public"` is still dropped by the session
 * gate, and a project reads a setting that changes nothing as a broken
 * mechanism.
 */
describe("resolveNav — overriding the surface and session axes", () => {
  const installed = [
    manifest("@stapel/chat", [
      entry({
        id: "chat.conversations",
        requiresAuth: true,
        surface: "member",
        order: 40,
      }),
    ]),
    manifest("@stapel/listings", [
      entry({ id: "listings.favorites", requiresAuth: true, surface: "member", order: 20 }),
    ]),
    manifest("@stapel/search", [
      entry({ id: "search.results", requiresAuth: false, surface: "public", order: 10 }),
    ]),
  ];

  it("without the override, an anonymous storefront sees only the public entry", () => {
    expect(resolvePublicNav(installed).map((e) => e.id)).toEqual(["search.results"]);
  });

  it("carries the overridden surface onto the resolved entry, so the menu and the route agree", () => {
    const resolved = resolveNav(installed, {
      overrides: { "listings.favorites": { surface: "public", requiresAuth: false } },
    });
    const favorites = resolved.find((e) => e.id === "listings.favorites");
    expect(favorites?.surface).toBe("public");
    expect(favorites?.requiresAuth).toBe(false);
  });

  it("puts the overridden destinations in an anonymous visitor's tree, in declared order", () => {
    const overrides = {
      overrides: {
        "listings.favorites": { surface: "public" as const, requiresAuth: false },
        "chat.conversations": { surface: "public" as const, requiresAuth: false },
      },
    };
    expect(resolvePublicNav(installed, overrides).map((e) => e.id)).toEqual([
      "search.results",
      "listings.favorites",
      "chat.conversations",
    ]);
  });

  it("leaves an entry the file does not name exactly where it was", () => {
    const overrides = {
      overrides: { "listings.favorites": { surface: "public" as const, requiresAuth: false } },
    };
    expect(resolvePublicNav(installed, overrides).map((e) => e.id)).not.toContain(
      "chat.conversations"
    );
  });

  it("keeps the two axes independent — surface alone still meets the session gate", () => {
    // The trap this test exists for: `surface: "public"` on a `requiresAuth`
    // entry is a door onto the sign-in redirect, and `resolveNav` has dropped
    // that combination since the session axis was read. An override does not
    // exempt an entry from the gates; it only restates what the entry IS.
    const overrides = { overrides: { "chat.conversations": { surface: "public" as const } } };
    const anonymous = resolvePublicNav(installed, overrides).map((e) => e.id);
    expect(anonymous).not.toContain("chat.conversations");
    // …and the surface itself did move, which is why the entry reaches a
    // signed-in guest who has no mandate.
    expect(
      resolveNav(installed, overrides, { audience: "guest", authenticated: true }).map(
        (e) => e.id
      )
    ).toContain("chat.conversations");
  });

  it("closes a public destination just as well as it opens a member one", () => {
    const overrides = { overrides: { "search.results": { surface: "member" as const } } };
    expect(resolvePublicNav(installed, overrides).map((e) => e.id)).toEqual([]);
    expect(resolveMemberNav(installed, overrides).map((e) => e.id)).toContain("search.results");
  });

  it("re-derives an undeclared surface from the overridden session axis, not the manifest's", () => {
    // The entry declares no surface at all, so its surface is DERIVED. Reading
    // the derivation off the manifest's `requiresAuth` while the project has
    // overridden that same field would make one entry contradict itself.
    const derived = [
      manifest("@stapel/a", [entry({ id: "a.member_by_derivation", requiresAuth: true })]),
    ];
    expect(resolveNav(derived)[0]?.surface).toBe("member");
    const opened = resolveNav(derived, {
      overrides: { "a.member_by_derivation": { requiresAuth: false } },
    });
    expect(opened[0]?.surface).toBe("public");
    expect(resolvePublicNav(derived, {
      overrides: { "a.member_by_derivation": { requiresAuth: false } },
    }).map((e) => e.id)).toEqual(["a.member_by_derivation"]);
  });

  it("an explicit declared surface still wins over the derivation when only the session axis is overridden", () => {
    const opened = resolveNav(installed, {
      overrides: { "chat.conversations": { requiresAuth: false } },
    });
    expect(opened.find((e) => e.id === "chat.conversations")?.surface).toBe("member");
  });

  it("applies to a SUBMENU child as well as a top entry", () => {
    const tree = [
      manifest("@stapel/a", [entry({ id: "a.top", requiresAuth: false, surface: "public" })]),
      manifest("@stapel/b", [
        entry({
          id: "b.member",
          requiresAuth: true,
          surface: "member",
          placement: { level: "submenu", parentId: "a.top" },
        }),
      ]),
    ];
    expect(resolvePublicNav(tree)[0]?.children).toEqual([]);
    const opened = resolvePublicNav(tree, {
      overrides: { "b.member": { surface: "public", requiresAuth: false } },
    });
    expect(opened[0]?.children?.map((c) => c.id)).toEqual(["b.member"]);
  });
});
