/**
 * `<AppShell/>` — proof that the default skin renders `resolveNav`'s output
 * as a responsive antd Layout: a `Sider` at desktop width, a hamburger
 * `Drawer` at phone/tablet width (`@stapel/core`'s `useBreakpoint`, the same
 * convention `AuthPanel`'s own responsive dialog follows), around a
 * react-router `<Outlet/>` the consumer's own nested routes fill in.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { useLayoutEffect } from "react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { AppShell } from "../src/default/AppShell.js";
import type { ResolvedNavEntry } from "../src/headless/resolveNav.js";
import { registerShellI18n } from "../src/i18n/keys.js";

afterEach(() => cleanup());

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true });
  window.dispatchEvent(new Event("resize"));
}

/** Make the OS say "dark" for the length of a test. Returns the undo. */
function matchDarkOs(): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes("dark"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

const NAV: readonly ResolvedNavEntry[] = [
  {
    id: "profiles.settings",
    labelKey: "profiles.nav.settings",
    icon: "UserOutlined",
    route: { path: "settings" },
    linkPath: "settings",
    index: false,
    component: { export: "ProfileSettings", subpath: "default" },
    requiresAuth: true,
    order: 90,
    menuVisible: true,
    children: [
      {
        id: "auth.security",
        labelKey: "auth.nav.security",
        icon: "SafetyCertificateOutlined",
        route: { path: "security" },
        linkPath: "security",
        index: false,
        component: { export: "SecuritySettings", subpath: "default" },
        requiresAuth: true,
        order: 10,
        menuVisible: true,
      },
    ],
  },
  {
    id: "notifications.feed",
    labelKey: "notifications.nav.feed",
    icon: "BellOutlined",
    route: { path: "notifications" },
    linkPath: "notifications",
    index: false,
    component: { export: "NotificationFeedList", subpath: "default" },
    requiresAuth: true,
    order: 20,
    menuVisible: true,
  },
];

function wrap(initialPath: string): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerShellI18n(i18n);
  i18n.registerBundle("en", {
    "profiles.nav.settings": "Settings",
    "auth.nav.security": "Security",
    "notifications.nav.feed": "Notifications",
  });
  return (
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<AppShell nav={NAV} />}>
            <Route path="settings" element={<div>Settings Page</div>} />
            <Route path="notifications" element={<div>Notifications Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("<AppShell/> — desktop: Sider + Menu", () => {
  it("renders a Sider with the resolved nav (top entries + nested submenu) and the matched route's Outlet content", async () => {
    setViewportWidth(1440);
    render(wrap("/settings"));

    await waitFor(() => expect(screen.getByTestId("app-shell-sider")).toBeDefined());
    expect(screen.queryByTestId("app-shell-drawer")).toBeNull();
    expect(screen.getByText("Settings")).toBeDefined();
    expect(screen.getByText("Notifications")).toBeDefined();
    // Outlet content for the matched /settings route.
    expect(screen.getByText("Settings Page")).toBeDefined();
  });

  it("clicking a menu item navigates and swaps the Outlet content", async () => {
    setViewportWidth(1440);
    render(wrap("/settings"));
    await waitFor(() => expect(screen.getByText("Notifications")).toBeDefined());

    fireEvent.click(screen.getByText("Notifications"));

    await waitFor(() => expect(screen.getByText("Notifications Page")).toBeDefined());
    expect(screen.queryByText("Settings Page")).toBeNull();
  });
});

/**
 * The chrome as ONE frame. The top bar used to be nested inside the content
 * column, so it began at the Sider's trailing edge and the page read as two
 * unrelated panels in the shape of an L — and on a phone, where there is no
 * Sider at all, that same bar held one hamburger and nothing else: no product
 * name, no account.
 */
describe("<AppShell/> — one bar across the window", () => {
  it("puts the header above BOTH columns, not beside the Sider", async () => {
    setViewportWidth(1440);
    render(wrap("/settings"));

    await waitFor(() => expect(screen.getByTestId("app-shell-sider")).toBeDefined());
    const header = screen.getByTestId("app-shell-header");
    const sider = screen.getByTestId("app-shell-sider");
    expect(header.contains(sider)).toBe(false);
    expect(header.parentElement).toBe(screen.getByTestId("app-shell"));
    // The Sider's own column starts where the bar ends.
    expect(sider.parentElement?.previousElementSibling).toBe(header);
  });

  it("carries the brand and the account control in that bar, at phone width too", async () => {
    setViewportWidth(375);
    const i18n = createI18n({ locale: "en" });
    registerShellI18n(i18n);
    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/settings"]}>
          <Routes>
            <Route
              element={
                <AppShell nav={NAV} logo={<span>Northgate</span>} headerExtra={<span>DW</span>} />
              }
            >
              <Route path="settings" element={<div>Settings Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => expect(screen.getByTestId("app-shell-header")).toBeDefined());
    const header = screen.getByTestId("app-shell-header");
    expect(header.contains(screen.getByTestId("app-shell-brand"))).toBe(true);
    expect(header.contains(screen.getByText("DW"))).toBe(true);
    expect(header.contains(screen.getByRole("button", { name: "Open menu" }))).toBe(true);
    setViewportWidth(1440);
  });
});

describe("<AppShell/> — phone/tablet: hamburger Drawer", () => {
  it("gives the nav sheet its own way out, named", async () => {
    setViewportWidth(375);
    render(wrap("/settings"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Open menu" })).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await waitFor(() => expect(document.querySelector(".ant-drawer-open")).not.toBeNull());

    // A sheet that covers the viewport leaves no scrim to press: the way back
    // has to be inside the sheet, and it has to have a name.
    const close = screen.getByRole("button", { name: "Close menu" });
    fireEvent.click(close);
    await waitFor(() => expect(document.querySelector(".ant-drawer-open")).toBeNull());
    setViewportWidth(1440);
  });

  it("hides the Sider and shows a hamburger trigger instead, at phone width", async () => {
    setViewportWidth(375);
    render(wrap("/settings"));

    await waitFor(() => expect(screen.queryByTestId("app-shell-sider")).toBeNull());
    expect(screen.getByRole("button", { name: "Open menu" })).toBeDefined();
    // Outlet content still renders even though the nav chrome is collapsed.
    expect(screen.getByText("Settings Page")).toBeDefined();
    setViewportWidth(1440); // restore for subsequent tests
  });

  it("opens the Drawer with the same nav on hamburger click, and closes it after navigating", async () => {
    setViewportWidth(375);
    render(wrap("/settings"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Open menu" })).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await waitFor(() => expect(document.querySelector(".ant-drawer-open")).not.toBeNull());
    expect(screen.getByText("Notifications")).toBeDefined();

    fireEvent.click(screen.getByText("Notifications"));
    await waitFor(() => expect(screen.getByText("Notifications Page")).toBeDefined());
    await waitFor(() => expect(document.querySelector(".ant-drawer-open")).toBeNull());
    setViewportWidth(1440); // restore for subsequent tests
  });
});

/**
 * The first frame.
 *
 * `useBreakpoint` used to answer `undefined` until an effect ran, so the very
 * first commit at 1440px painted the PHONE branch — hamburger, no sider — and
 * the desktop chrome swapped in a frame later (shared-layer audit Q1, the
 * flash `useDialogSurface` was written to avoid and `AppShell` had). It now
 * reads through `useSyncExternalStore`, so the first client render is already
 * right; this suite asserts THAT rather than the settled state, which was
 * correct even while the flash existed.
 *
 * The probe is a layout effect on a child of the shell: layout effects run
 * after the whole first commit is in the DOM and before the browser paints,
 * so what it reads IS the frame a person would have seen.
 */
function FirstCommit({ onCommit }: { onCommit: (html: string) => void }): null {
  useLayoutEffect(() => {
    onCommit(document.body.innerHTML);
  }, [onCommit]);
  return null;
}

function firstCommitAt(width: number): string {
  setViewportWidth(width);
  let html = "";
  const i18n = createI18n({ locale: "en" });
  registerShellI18n(i18n);
  render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route element={<AppShell nav={NAV} />}>
            <Route
              path="settings"
              element={<FirstCommit onCommit={(h) => (html = h)} />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
  return html;
}

describe("<AppShell/> — the chrome is right on the FIRST frame, not the second", () => {
  it("paints the Sider at desktop width with no phone trigger in between", () => {
    const html = firstCommitAt(1440);
    expect(html).toContain("app-shell-sider");
    expect(html).not.toContain("app-shell-menu-trigger");
  });

  it("paints the phone trigger at phone width with no Sider in between", () => {
    const html = firstCommitAt(375);
    expect(html).toContain("app-shell-menu-trigger");
    expect(html).not.toContain("app-shell-sider");
    setViewportWidth(1440);
  });

  it("the probe really is reading the first commit (fixture sanity)", () => {
    expect(firstCommitAt(1440)).not.toBe("");
    setViewportWidth(1440);
  });
});

/**
 * The admin section, and the staff capability.
 *
 * The section is LISTED for everyone and switched off with its reason beside
 * it — never hidden. A menu entry that vanishes teaches nobody that the screen
 * exists, and a person who cannot see it cannot ask for access to it; the
 * container's own `AdminGate` says the same thing on the screen itself, after
 * the click. This says it before.
 */
const ADMIN_NAV: readonly ResolvedNavEntry[] = [
  {
    id: "admin.root",
    labelKey: "shell.nav.admin",
    icon: "AuditOutlined",
    route: { path: "admin" },
    linkPath: "admin",
    index: false,
    component: { export: "AdminSection", subpath: "." },
    requiresAuth: true,
    surface: "member",
    order: 110,
    menuVisible: true,
    children: [
      {
        id: "admin.privacy",
        labelKey: "gdpr.nav.admin",
        icon: "SafetyCertificateOutlined",
        route: { path: "privacy" },
        linkPath: "privacy",
        index: false,
        component: { export: "PrivacyRequestsAdmin", subpath: "default/admin" },
        requiresAuth: true,
        surface: "member",
        order: 10,
        menuVisible: true,
      },
    ],
  },
];

function renderAdmin(staff: boolean | undefined): void {
  setViewportWidth(1440);
  const i18n = createI18n({ locale: "en" });
  registerShellI18n(i18n);
  i18n.registerBundle("en", { "gdpr.nav.admin": "Privacy requests" });
  render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            element={
              <AppShell nav={ADMIN_NAV} {...(staff === undefined ? {} : { staff })} />
            }
          >
            <Route path="admin" element={<div>Admin Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("<AppShell/> — the admin section is gated on staff, not hidden by it", () => {
  it("lists the section with its reason beside it when the staff capability is absent", async () => {
    renderAdmin(false);
    await waitFor(() => expect(screen.getByText("Admin")).toBeDefined());

    const reason = document.querySelector("[data-stapel-nav-blocked-reason]");
    expect(reason?.textContent).toBe("For the people who operate this product");
    // Listed, and not a live link: the screen it would open refuses anyway.
    expect(screen.getByText("Admin")).toBeDefined();
    expect(document.querySelector('a[href="/admin"]')).toBeNull();
  });

  it("defaults to absent — a capability is not held until something says so", async () => {
    renderAdmin(undefined);
    await waitFor(() => expect(screen.getByText("Admin")).toBeDefined());
    expect(document.querySelector("[data-stapel-nav-blocked-reason]")).not.toBeNull();
  });

  it("opens the section for a staff member, with no reason line left over", async () => {
    renderAdmin(true);
    await waitFor(() => expect(screen.getByText("Admin")).toBeDefined());

    expect(document.querySelector("[data-stapel-nav-blocked-reason]")).toBeNull();
    expect(document.querySelector('[data-testid="app-shell-menu"] li')).not.toBeNull();
  });

  it("keeps the closed section's screens on the page, not behind a fold that opens onto nothing", async () => {
    renderAdmin(false);
    await waitFor(() => expect(screen.getByText("Admin")).toBeDefined());

    // A closed section is a GROUP, not a collapsed submenu: there is nothing
    // to expand into, and a group title is the one menu row antd lets grow to
    // the two lines the reason needs — which is why the reason used to be in
    // the DOM and invisible on the screen, and why `admin-blocked` was
    // pixel-identical to the open state while these tests passed.
    expect(screen.getByText("Privacy requests")).toBeDefined();
    expect(document.querySelector(".ant-menu-submenu")).toBeNull();
    expect(
      document
        .querySelector("[data-stapel-nav-blocked-reason]")
        ?.closest(".ant-menu-item-group-title")
    ).not.toBeNull();
  });

  it("states the reason once, on the section — not again on every screen inside it", async () => {
    renderAdmin(false);
    await waitFor(() => expect(screen.getByText("Admin")).toBeDefined());
    expect(document.querySelectorAll("[data-stapel-nav-blocked-reason]")).toHaveLength(1);
  });

  it("leaves an ordinary section alone whatever the staff answer is", async () => {
    setViewportWidth(1440);
    render(wrap("/settings"));
    await waitFor(() => expect(screen.getByText("Settings")).toBeDefined());
    expect(document.querySelector("[data-stapel-nav-blocked-reason]")).toBeNull();
  });
});

/**
 * `SkinTheme`, not a local `ConfigProvider`: the chrome follows the
 * document's live `data-theme` instead of a `mode` prop a host had to guess,
 * and `mode` is still accepted to PIN a side.
 */
describe("<AppShell/> — self-theming", () => {
  it("renders on the side the document is stamped with", async () => {
    // The OS is asked to agree with the stamp, because since 0.10.0 the shell
    // also RENDERS the theme control (`themeControl`, on by default), and that
    // control applies the stored preference — `system` when nothing was ever
    // chosen, which resolves through `prefers-color-scheme`. A document
    // stamped `dark` while the OS says light is a contradiction the applier is
    // supposed to resolve toward the OS; it is not the state this test is
    // about. Everywhere the pair actually runs, the stamp CAME from that same
    // resolution (a pre-paint boot script), so the two agree by construction.
    const restoreMatchMedia = matchDarkOs();
    document.documentElement.setAttribute("data-theme", "dark");
    setViewportWidth(1440);
    render(wrap("/settings"));

    await waitFor(() =>
      expect(document.querySelector("[data-stapel-skin-mode]")).not.toBeNull()
    );
    expect(
      document.querySelector("[data-stapel-skin-mode]")?.getAttribute("data-stapel-skin-mode")
    ).toBe("dark");
    document.documentElement.removeAttribute("data-theme");
    restoreMatchMedia();
  });

  it("paints the page surface, not a bare container", async () => {
    setViewportWidth(1440);
    render(wrap("/settings"));
    await waitFor(() =>
      expect(document.querySelector("[data-stapel-skin-surface]")).not.toBeNull()
    );
    expect(
      document
        .querySelector("[data-stapel-skin-surface]")
        ?.getAttribute("data-stapel-skin-surface")
    ).toBe("base");
  });

  it("still pins a side when the host asks for one", async () => {
    document.documentElement.setAttribute("data-theme", "dark");
    setViewportWidth(1440);
    const i18n = createI18n({ locale: "en" });
    registerShellI18n(i18n);
    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/settings"]}>
          <Routes>
            <Route element={<AppShell nav={NAV} mode="light" />}>
              <Route path="settings" element={<div>Settings Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );
    await waitFor(() =>
      expect(document.querySelector("[data-stapel-skin-mode]")).not.toBeNull()
    );
    expect(
      document.querySelector("[data-stapel-skin-mode]")?.getAttribute("data-stapel-skin-mode")
    ).toBe("light");
    document.documentElement.removeAttribute("data-theme");
  });
});

/**
 * The theme switch is part of the DEFAULT chrome (§83): the mechanism has
 * shipped for two waves and every token file compiles a dark block, and no
 * deployment could reach it because nothing rendered a control. These assert
 * the place, on both surfaces, and the opt-out.
 */
describe("<AppShell/> — the theme control is chrome, not a host chore", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders it at the foot of the Sider on a desktop", async () => {
    setViewportWidth(1440);
    render(wrap("/settings"));

    await waitFor(() => expect(screen.getByTestId("app-shell-sider")).toBeDefined());
    const foot = within(screen.getByTestId("app-shell-sider")).getByTestId(
      "app-shell-theme"
    );
    expect(within(foot).getByTestId("shell-theme-control")).toBeDefined();
    // Named from the engine, not from the control's English floor.
    expect(
      within(foot).getByRole("radiogroup", { name: "Appearance" })
    ).toBeDefined();
  });

  it("renders it in the foot of the nav sheet on a phone", async () => {
    setViewportWidth(375);
    render(wrap("/settings"));
    await waitFor(() =>
      expect(screen.getByTestId("app-shell-menu-trigger")).toBeDefined()
    );

    fireEvent.click(screen.getByTestId("app-shell-menu-trigger"));
    await waitFor(() =>
      expect(screen.getByTestId("app-shell-drawer")).toBeDefined()
    );
    expect(
      within(screen.getByTestId("app-shell-drawer")).getByTestId("shell-theme-control")
    ).toBeDefined();
    setViewportWidth(1440);
  });

  it("stamps the document when a side is chosen — the control is self-managing", async () => {
    setViewportWidth(1440);
    render(wrap("/settings"));
    await waitFor(() => expect(screen.getByTestId("shell-theme-control")).toBeDefined());

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

    await waitFor(() =>
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    );
    // …and the chrome moved with it, rather than staying on the side it
    // mounted with.
    await waitFor(() =>
      expect(
        document
          .querySelector("[data-stapel-skin-mode]")
          ?.getAttribute("data-stapel-skin-mode")
      ).toBe("dark")
    );
  });

  it("steps aside for a host that owns the choice elsewhere", async () => {
    setViewportWidth(1440);
    const i18n = createI18n({ locale: "en" });
    registerShellI18n(i18n);
    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/settings"]}>
          <Routes>
            <Route element={<AppShell nav={NAV} themeControl={false} />}>
              <Route path="settings" element={<div>Settings Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => expect(screen.getByText("Settings Page")).toBeDefined());
    expect(screen.queryByTestId("shell-theme-control")).toBeNull();
    expect(screen.queryByTestId("app-shell-theme")).toBeNull();
  });
});
