/**
 * `<PublicShell/>` — the three rules of the public chrome, each asserted
 * rather than promised (spec §3.1):
 *
 *  1. no `Sider`, ever — top bar + browse bar, and on phone the browse bar
 *     collapses into a `Drawer` while the header stays;
 *  2. `accountSlot` is a CTA and never emptiness — omit it and a sign-in link
 *     still renders;
 *  3. the shell reads no session — it renders with no `StapelProvider`, no
 *     query client and no mandate anywhere in the tree.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { PublicShell } from "../src/default/PublicShell.js";
import type { ResolvedNavEntry } from "../src/headless/resolveNav.js";
import { registerShellI18n } from "../src/i18n/keys.js";

afterEach(() => cleanup());

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true });
  window.dispatchEvent(new Event("resize"));
}

const NAV: readonly ResolvedNavEntry[] = [
  {
    id: "listings.compose",
    labelKey: "listings.nav.compose",
    icon: "PlusOutlined",
    route: { path: "/new" },
    component: { export: "ListingComposer", subpath: "default" },
    requiresAuth: true,
    surface: "member",
    order: 20,
    menuVisible: true,
  },
  {
    id: "search.results",
    labelKey: "search.nav.results",
    icon: "SearchOutlined",
    route: { path: "/s" },
    component: { export: "SearchResults", subpath: "default" },
    requiresAuth: false,
    surface: "public",
    order: 10,
    menuVisible: true,
  },
];

function wrap(
  initialPath: string,
  props: Partial<Parameters<typeof PublicShell>[0]> = {}
): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerShellI18n(i18n);
  i18n.registerBundle("en", {
    "listings.nav.compose": "Post an ad",
    "search.nav.results": "Search",
  });
  return (
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<PublicShell nav={NAV} mode="light" {...props} />}>
            <Route path="s" element={<div>Search Page</div>} />
            <Route path="new" element={<div>Compose Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("<PublicShell/> — geometry: a top bar, and no Sider", () => {
  it("renders header + browse bar + Outlet content, and NEVER an AppShell Sider", async () => {
    setViewportWidth(1440);
    render(wrap("/s", { brand: <span>Darom</span>, categorySlot: <span>Cars</span> }));

    await waitFor(() => expect(screen.getByTestId("public-shell-header")).toBeDefined());
    expect(screen.getByTestId("public-shell-browse")).toBeDefined();
    expect(screen.getByTestId("public-shell-brand")).toBeDefined();
    expect(screen.getByTestId("public-shell-categories")).toBeDefined();
    expect(screen.getByText("Search Page")).toBeDefined();

    // Rule 1: the whole reason this is a sibling and not a flag.
    expect(screen.queryByTestId("app-shell-sider")).toBeNull();
    expect(document.querySelector(".ant-layout-sider")).toBeNull();
  });

  it("renders the search slot and a footer only when the host supplies them", async () => {
    setViewportWidth(1440);
    render(wrap("/s"));
    await waitFor(() => expect(screen.getByTestId("public-shell-header")).toBeDefined());
    expect(screen.queryByTestId("public-shell-search")).toBeNull();
    expect(screen.queryByTestId("public-shell-footer")).toBeNull();

    cleanup();
    render(wrap("/s", { searchSlot: <input aria-label="q" />, footer: <span>Ranking</span> }));
    await waitFor(() => expect(screen.getByTestId("public-shell-search")).toBeDefined());
    expect(screen.getByTestId("public-shell-footer")).toBeDefined();
  });

  it("navigating from the horizontal menu swaps the Outlet content", async () => {
    setViewportWidth(1440);
    render(wrap("/s"));
    await waitFor(() => expect(screen.getByText("Post an ad")).toBeDefined());

    fireEvent.click(screen.getByText("Post an ad"));

    await waitFor(() => expect(screen.getByText("Compose Page")).toBeDefined());
    expect(screen.queryByText("Search Page")).toBeNull();
  });

  it("renders whatever nav it is handed — surface filtering is the container's call, not a second gate here", async () => {
    setViewportWidth(1440);
    render(wrap("/s"));
    // NAV carries one `member` entry and one `public` entry; the shell shows
    // both, because the container already resolved for its audience. A shell
    // that re-filtered would be a second place the access rule lives.
    await waitFor(() => expect(screen.getByText("Search")).toBeDefined());
    expect(screen.getByText("Post an ad")).toBeDefined();
  });
});

describe("<PublicShell/> — phone: the browse bar collapses, the header does not", () => {
  it("hides the browse bar behind a hamburger and keeps the header + search visible", async () => {
    setViewportWidth(375);
    render(wrap("/s", { searchSlot: <input aria-label="q" />, categorySlot: <span>Cars</span> }));

    await waitFor(() => expect(screen.queryByTestId("public-shell-browse")).toBeNull());
    expect(screen.getByTestId("public-shell-header")).toBeDefined();
    expect(screen.getByTestId("public-shell-search")).toBeDefined();
    expect(screen.getByRole("button", { name: "Open menu" })).toBeDefined();
    expect(screen.getByText("Search Page")).toBeDefined();
    setViewportWidth(1440);
  });

  it("opens the Drawer with the nav and the category strip, and closes it after navigating", async () => {
    setViewportWidth(375);
    render(wrap("/s", { categorySlot: <span>Cars</span> }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Open menu" })).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await waitFor(() => expect(document.querySelector(".ant-drawer-open")).not.toBeNull());
    expect(screen.getByTestId("public-shell-categories")).toBeDefined();

    fireEvent.click(screen.getByText("Post an ad"));
    await waitFor(() => expect(screen.getByText("Compose Page")).toBeDefined());
    await waitFor(() => expect(document.querySelector(".ant-drawer-open")).toBeNull());
    setViewportWidth(1440);
  });

  it("shows no hamburger when there is nothing to browse — an empty sheet is a promise with no destination", async () => {
    setViewportWidth(375);
    const i18n = createI18n({ locale: "en" });
    registerShellI18n(i18n);
    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route element={<PublicShell nav={[]} mode="light" />}>
              <Route index element={<div>Home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => expect(screen.getByText("Home")).toBeDefined());
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
    setViewportWidth(1440);
  });
});

describe("<PublicShell/> — the sign-in CTA is never absent", () => {
  it("renders a sign-in link when the host supplies no accountSlot", async () => {
    setViewportWidth(1440);
    render(wrap("/s"));

    await waitFor(() => expect(screen.getByTestId("public-shell-sign-in")).toBeDefined());
    const cta = screen.getByTestId("public-shell-sign-in");
    expect(cta.getAttribute("href")).toBe("/login");
    expect(screen.getByText("Sign in")).toBeDefined();
  });

  it("steps aside for a host-supplied account menu", async () => {
    setViewportWidth(1440);
    render(wrap("/s", { accountSlot: <span>My account</span> }));

    await waitFor(() => expect(screen.getByText("My account")).toBeDefined());
    expect(screen.queryByTestId("public-shell-sign-in")).toBeNull();
  });
});

describe("<PublicShell/> — reads no session", () => {
  it("renders with no StapelProvider, no query client and no mandate in the tree", async () => {
    setViewportWidth(1440);
    // The only providers here are the router and i18n. If the shell reached
    // for a session, a client or a mandate, this render would throw — which
    // is the assertion: the mandate belongs to the container, not the chrome.
    render(wrap("/s"));
    await waitFor(() => expect(screen.getByTestId("public-shell")).toBeDefined());
    expect(screen.getByText("Search Page")).toBeDefined();
  });
});
