/**
 * `<AppShell/>` — proof that the default skin renders `resolveNav`'s output
 * as a responsive antd Layout: a `Sider` at desktop width, a hamburger
 * `Drawer` at phone/tablet width (`@stapel/core`'s `useBreakpoint`, the same
 * convention `AuthPanel`'s own responsive dialog follows), around a
 * react-router `<Outlet/>` the consumer's own nested routes fill in.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
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

const NAV: readonly ResolvedNavEntry[] = [
  {
    id: "profiles.settings",
    labelKey: "profiles.nav.settings",
    icon: "UserOutlined",
    route: { path: "settings" },
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
          <Route element={<AppShell nav={NAV} mode="light" />}>
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

describe("<AppShell/> — phone/tablet: hamburger Drawer", () => {
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
