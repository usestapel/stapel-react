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
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    linkPath: "/new",
    index: false,
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
    linkPath: "/s",
    index: false,
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
          <Route element={<PublicShell nav={NAV} {...props} />}>
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
    render(wrap("/s", { brand: <span>Acme</span>, categorySlot: <span>Cars</span> }));

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

    // Scoped to the drawer: below the desktop breakpoint the same destination
    // is ALSO in the bottom dock, and a bare getByText would now be ambiguous
    // — which is exactly the point of the dock (two ways to the same place,
    // one of them under the thumb).
    fireEvent.click(
      within(screen.getByTestId("public-shell-drawer")).getByText("Post an ad")
    );
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

/**
 * P-5 from the live storefront walk. The horizontal `<Menu>` sat as a bare
 * child of the browse row's `<Flex>`, so rc-overflow measured it at ~0 and
 * collapsed EVERY tab behind a "…" on a 1440px window whose row was otherwise
 * empty. jsdom lays nothing out, so what is asserted here is the contract the
 * browser needs: the menu's box is the one that takes the leftover width, and
 * it is allowed to shrink below its content (`minWidth: 0`) instead of pushing
 * the row wider than the screen.
 */
describe("<PublicShell/> — the browse bar gives the menu real width", () => {
  it("wraps the menu in a `flex: 1 1 auto` / `minWidth: 0` box", async () => {
    setViewportWidth(1440);
    render(wrap("/s", { categorySlot: <span>Cars</span> }));

    await waitFor(() => expect(screen.getByTestId("public-shell-browse")).toBeDefined());
    const box = screen.getByTestId("public-shell-nav");
    expect(box.style.flex).toBe("1 1 auto");
    expect(box.style.minWidth).toBe("0");
    // The menu is inside that box, not a bare flex child beside it.
    expect(box.querySelector("[data-testid='public-shell-menu']")).not.toBeNull();
    // And the category strip does not take width from it.
    expect(screen.getByTestId("public-shell-categories").style.flex).toBe("0 0 auto");
  });

  it("reads categories THEN tabs, so the two halves of one bar are not a screen apart", async () => {
    setViewportWidth(1440);
    render(wrap("/s", { categorySlot: <span>Cars</span> }));

    await waitFor(() => expect(screen.getByTestId("public-shell-browse")).toBeDefined());
    // The menu is the greedy child; with the strip behind it, the strip was
    // pinned to the far right of the window while the tabs sat at the far
    // left — nothing broken, and the bar looked it.
    const order = [...screen.getByTestId("public-shell-browse").children].map((el) =>
      el.getAttribute("data-testid")
    );
    expect(order).toEqual(["public-shell-categories", "public-shell-nav"]);
  });

  it("renders every menu entry, not a single overflow trigger", async () => {
    setViewportWidth(1440);
    render(wrap("/s"));

    await waitFor(() => expect(screen.getByTestId("public-shell-menu")).toBeDefined());
    expect(screen.getByText("Search")).toBeDefined();
    expect(screen.getByText("Post an ad")).toBeDefined();
  });
});

/**
 * P-7: `Layout.Content` was `padding: 16` and nothing else, so a detail page's
 * prose ran the full width of whatever monitor it was opened on.
 */
describe("<PublicShell/> — the content has a measure", () => {
  it("centres the routed content at 1280 by default", async () => {
    setViewportWidth(1440);
    render(wrap("/s"));

    await waitFor(() => expect(screen.getByTestId("public-shell-content")).toBeDefined());
    const content = screen.getByTestId("public-shell-content");
    expect(content.style.maxWidth).toBe("1280px");
    expect(content.style.marginInline).toBe("auto");
    expect(screen.getByText("Search Page")).toBeDefined();
  });

  it("takes a host's own measure", async () => {
    setViewportWidth(1440);
    render(wrap("/s", { contentMaxWidth: 960 }));

    await waitFor(() => expect(screen.getByTestId("public-shell-content")).toBeDefined());
    expect(screen.getByTestId("public-shell-content").style.maxWidth).toBe("960px");
  });

  it("goes edge to edge for `false`, and still renders the outlet", async () => {
    setViewportWidth(1440);
    render(wrap("/s", { contentMaxWidth: false }));

    await waitFor(() => expect(screen.getByTestId("public-shell-content")).toBeDefined());
    const content = screen.getByTestId("public-shell-content");
    expect(content.style.maxWidth).toBe("");
    expect(content.style.marginInline).toBe("");
    expect(screen.getByText("Search Page")).toBeDefined();
  });
});

/**
 * The theme switch, in the storefront's chrome by default (§83). Desktop: the
 * end of the header's account area. Phone: the foot of the nav sheet — the
 * 390px header line already holds a hamburger, a brand and an account control.
 */
describe("<PublicShell/> — the theme control is chrome, not a host chore", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("puts it at the end of the account area on a desktop", async () => {
    setViewportWidth(1440);
    render(wrap("/s", { accountSlot: <span>My account</span> }));

    await waitFor(() => expect(screen.getByTestId("public-shell-account")).toBeDefined());
    const account = screen.getByTestId("public-shell-account");
    expect(within(account).getByTestId("shell-theme-control")).toBeDefined();
    // Last, not first: the account control the person came for stays at the
    // head of the row.
    expect(
      account.firstElementChild?.contains(within(account).getByText("My account"))
    ).toBe(true);
  });

  it("moves it into the nav sheet on a phone, and keeps it out of the header", async () => {
    setViewportWidth(375);
    render(wrap("/s", { categorySlot: <span>Cars</span> }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Open menu" })).toBeDefined());
    expect(
      within(screen.getByTestId("public-shell-header")).queryByTestId("shell-theme-control")
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await waitFor(() => expect(document.querySelector(".ant-drawer-open")).not.toBeNull());
    expect(
      within(screen.getByTestId("public-shell-drawer")).getByTestId("shell-theme-control")
    ).toBeDefined();
    setViewportWidth(1440);
  });

  it("stamps the document when a side is chosen", async () => {
    setViewportWidth(1440);
    render(wrap("/s"));
    await waitFor(() => expect(screen.getByTestId("shell-theme-control")).toBeDefined());

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

    await waitFor(() =>
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    );
  });

  it("steps aside for a host that owns the choice elsewhere", async () => {
    setViewportWidth(1440);
    render(wrap("/s", { themeControl: false }));

    await waitFor(() => expect(screen.getByTestId("public-shell-header")).toBeDefined());
    expect(screen.queryByTestId("shell-theme-control")).toBeNull();
    expect(screen.queryByTestId("public-shell-theme")).toBeNull();
  });
});
