/**
 * The nav `<Menu/>` both chromes render — specifically the two decisions it
 * makes that a resolved tree cannot make for it:
 *
 *  1. WHERE an entry points. An `route.index` child mounts at its section's
 *     address, so linking to a segment of its own name pointed at a route
 *     that does not exist. The address is `linkPath`, resolved once by
 *     `resolveNav`, and this menu is where the field is finally read.
 *  2. WHICH entry the location is on. When a section and its index child
 *     share an address, both match — and the one the person is looking at is
 *     the child.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { I18nProvider, createI18n, actionAvailable, actionBlocked } from "@stapel/core";
import { NavMenu, findActive, matchesLocation } from "../src/default/navMenu.js";
import { resolveNav } from "../src/headless/resolveNav.js";
import type { ResolvedNavEntry } from "../src/headless/resolveNav.js";
import type { NavEntry, PackageNavManifest } from "@stapel/core";

afterEach(() => cleanup());

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

/** A section with an index child and an ordinary child beside it. */
const SECTION: readonly ResolvedNavEntry[] = resolveNav([
  manifest("@stapel/profiles", [
    entry({ id: "profiles.settings", route: { path: "settings" }, order: 10 }),
  ]),
  manifest("@stapel/auth", [
    entry({
      id: "auth.overview",
      route: { path: "overview", index: true },
      placement: { level: "submenu", parentId: "profiles.settings" },
      order: 1,
    }),
    entry({
      id: "auth.security",
      route: { path: "security" },
      placement: { level: "submenu", parentId: "profiles.settings" },
      order: 2,
    }),
  ]),
]);

function renderMenu(
  nav: readonly ResolvedNavEntry[],
  pathname: string,
  props: Partial<Parameters<typeof NavMenu>[0]> = {}
): void {
  const i18n = createI18n({ locale: "en" });
  i18n.registerBundle("en", {
    "profiles.settings.label": "Settings",
    "auth.overview.label": "Overview",
    "auth.security.label": "Security",
    "admin.root.label": "Admin",
    "shell.nav.admin_staff_only": "For the people who operate this product",
  });
  render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={[pathname]}>
        <NavMenu nav={nav} {...props} />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("matchesLocation — the address is linkPath, not route.path", () => {
  it("matches an absolute address exactly", () => {
    const [login] = resolveNav([
      manifest("@stapel/auth", [entry({ id: "auth.login", route: { path: "/login" } })]),
    ]);
    expect(login && matchesLocation(login, "/login")).toBe(true);
    expect(login && matchesLocation(login, "/login/extra")).toBe(false);
  });

  it("matches a relative address on the last segment, whatever the mount prefix is", () => {
    const section = SECTION[0];
    expect(section && matchesLocation(section, "/app/settings")).toBe(true);
    expect(section && matchesLocation(section, "/some/deep/mount/settings")).toBe(true);
    expect(section && matchesLocation(section, "/app/other")).toBe(false);
  });

  it("matches a multi-segment relative address as a whole, segment-aligned", () => {
    const [row] = resolveNav([
      manifest("@stapel/workspaces", [
        entry({ id: "workspaces.settings", route: { path: "workspaces/settings" } }),
      ]),
    ]);
    expect(row && matchesLocation(row, "/app/account/workspaces/settings")).toBe(true);
    expect(row && matchesLocation(row, "/app/settings")).toBe(false);
    expect(row && matchesLocation(row, "/app/xworkspaces/settings")).toBe(false);
    expect(row && matchesLocation(row, "/workspaces")).toBe(false);
  });

  it("matches an INDEX child at its section's address — the address it mounts at", () => {
    const index = SECTION[0]?.children?.[0];
    expect(index?.id).toBe("auth.overview");
    expect(index && matchesLocation(index, "/app/settings")).toBe(true);
    // Its own name is not an address at all.
    expect(index && matchesLocation(index, "/app/settings/overview")).toBe(false);
  });
});

describe("findActive — the deepest match wins", () => {
  it("selects the index CHILD over its section when both share the address", () => {
    expect(findActive(SECTION, "/app/settings")?.id).toBe("auth.overview");
  });

  it("selects an ordinary child at its own address", () => {
    expect(findActive(SECTION, "/app/settings/security")?.id).toBe("auth.security");
  });

  it("selects the section itself when it has no index child", () => {
    const plain = resolveNav([
      manifest("@stapel/p", [entry({ id: "p.top", route: { path: "settings" } })]),
      manifest("@stapel/c", [
        entry({
          id: "c.child",
          route: { path: "security" },
          placement: { level: "submenu", parentId: "p.top" },
        }),
      ]),
    ]);
    expect(findActive(plain, "/app/settings")?.id).toBe("p.top");
  });

  it("selects nothing for a location no entry claims", () => {
    expect(findActive(SECTION, "/app/nowhere")).toBeUndefined();
  });
});

describe("<NavMenu/> — what it renders for an index child", () => {
  it("links the index child at the section's address, not at its own name", () => {
    renderMenu(SECTION, "/app/settings");
    // `to` is relative — react-router resolves it against wherever the host
    // mounted the section — so the property under test is that the index
    // child and its section resolve to the SAME address, and that neither is
    // the child's own name.
    const overview = screen.getByText("Overview").closest("a")?.getAttribute("href");
    const security = screen.getByText("Security").closest("a")?.getAttribute("href");
    expect(overview).toBe("/settings");
    expect(security).toBe("/security");
    expect(overview).not.toContain("overview");
  });

  it("marks the index child as the selected entry", () => {
    renderMenu(SECTION, "/app/settings");
    expect(
      document.querySelector('[data-testid="app-shell-menu"] .ant-menu-item-selected')
    ).not.toBeNull();
  });
});

describe("<NavMenu/> — a gated entry is listed with its reason, never hidden", () => {
  const gateOff = (e: ResolvedNavEntry) =>
    e.id === "auth.security"
      ? actionBlocked("shell.nav.admin_staff_only")
      : actionAvailable();

  it("renders the entry, switched off, with the reason as text beside it", () => {
    renderMenu(SECTION, "/app/settings", { gate: gateOff });
    expect(screen.getByText("Security")).toBeDefined();
    expect(
      document.querySelector("[data-stapel-nav-blocked-reason]")?.textContent
    ).toBe("For the people who operate this product");
  });

  it("gives a blocked entry no link to follow", () => {
    renderMenu(SECTION, "/app/settings", { gate: gateOff });
    expect(screen.getByText("Security").closest("a")).toBeNull();
    // …while the open sibling keeps its own.
    expect(screen.getByText("Overview").closest("a")).not.toBeNull();
  });

  it("leaves every entry linked when no gate is supplied", () => {
    renderMenu(SECTION, "/app/settings");
    expect(document.querySelector("[data-stapel-nav-blocked-reason]")).toBeNull();
    expect(screen.getByText("Security").closest("a")).not.toBeNull();
  });
});
