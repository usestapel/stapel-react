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

    // The header's control is the COMPACT button (0.14.0), and the slot it
    // sits in is unchanged.
    expect(
      screen.getByTestId("shell-theme-control").getAttribute("data-variant")
    ).toBe("compact");
    // The compact button cycles, so reaching a named side is a press or two
    // — bounded by the three states, never a spin.
    const control = () => screen.getByTestId("shell-theme-control");
    for (let i = 0; i < 3 && control().getAttribute("data-state") !== "dark"; i += 1) {
      fireEvent.click(control());
    }

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

/**
 * `phoneChrome="dock"` — the decluttered phone frame (mobile-web wave).
 *
 * The reference storefronts all draw the same thing on a phone: one row of
 * search plus a sign-in control, and every destination under the thumb. The
 * shell's own default was a hamburger, a brand, an account control AND a
 * second header line for search — four decisions on a 390px screen, three of
 * which the dock already answers.
 *
 * The `"drawer"` default is unchanged and asserted so above; what is asserted
 * here is that the second mode removes exactly what it claims to and nothing
 * a storefront needs — the footer's legal links included.
 */
describe("<PublicShell/> — phoneChrome=\"dock\"", () => {
  it("drops the hamburger and the sheet: the dock is the whole navigation", async () => {
    setViewportWidth(375);
    render(
      wrap("/s", {
        phoneChrome: "dock",
        searchSlot: <input aria-label="q" />,
        categorySlot: <span>Cars</span>,
      })
    );

    await waitFor(() => expect(screen.getByTestId("public-shell-header")).toBeDefined());
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
    expect(screen.queryByTestId("public-shell-drawer")).toBeNull();
    expect(screen.queryByTestId("public-shell-browse")).toBeNull();
    expect(screen.getByTestId("nav-dock")).toBeDefined();
    setViewportWidth(1440);
  });

  it("is ONE row: search stretched, account at its end, no brand and no second line", async () => {
    setViewportWidth(375);
    render(
      wrap("/s", {
        phoneChrome: "dock",
        brand: <span>Acme</span>,
        searchSlot: <input aria-label="q" />,
      })
    );

    await waitFor(() => expect(screen.getByTestId("public-shell-header")).toBeDefined());
    const header = screen.getByTestId("public-shell-header");
    expect(header.style.flexDirection).toBe("row");
    // The brand is not drawn: identity lives in the dock, and a 390px row that
    // carries a wordmark cannot also carry a search field worth typing into.
    expect(screen.queryByTestId("public-shell-brand")).toBeNull();
    expect(screen.queryByText("Acme")).toBeNull();
    const search = screen.getByTestId("public-shell-search");
    expect(search.style.flex).toBe("1 1 auto");
    // Home, search, account — all three direct children of the one header row
    // rather than of a nested line. The wordmark is still absent; what stands
    // in the corner is a MARK, sized like a glyph.
    const order = [...header.children].map((el) => el.getAttribute("data-testid"));
    expect(order).toEqual([
      "public-shell-home",
      "public-shell-search",
      "public-shell-account",
    ]);
    setViewportWidth(1440);
  });

  it("puts a route HOME in the corner of every phone screen", async () => {
    setViewportWidth(375);
    render(
      wrap("/s", {
        phoneChrome: "dock",
        brand: <span>Acme</span>,
        searchSlot: <input aria-label="q" />,
      })
    );

    await waitFor(() => expect(screen.getByTestId("public-shell-home")).toBeDefined());
    // The defect this closes: the docked phone chrome drew no brand, the
    // header's leading control was a host's history back arrow, and the dock's
    // tabs are wherever a manifest points — so `/` was reachable from nowhere.
    const home = screen.getByTestId("public-shell-home");
    expect(home.getAttribute("href")).toBe("/");
    // A picture needs a name, or a screen reader reads a link with no text.
    expect(home.getAttribute("aria-label")).toBe("Home");
    setViewportWidth(1440);
  });

  it("draws no home mark where the host says its own chrome owns that corner", async () => {
    setViewportWidth(375);
    render(
      wrap("/s", {
        phoneChrome: "dock",
        home: false,
        searchSlot: <input aria-label="q" />,
      })
    );

    await waitFor(() => expect(screen.getByTestId("public-shell-header")).toBeDefined());
    expect(screen.queryByTestId("public-shell-home")).toBeNull();
    setViewportWidth(1440);
  });

  it("leaves the drawer chrome's own wordmark alone — it is already a link home", async () => {
    setViewportWidth(375);
    render(
      wrap("/s", { brand: <span>Acme</span>, searchSlot: <input aria-label="q" /> })
    );

    await waitFor(() => expect(screen.getByTestId("public-shell-brand")).toBeDefined());
    // No second home control beside a wordmark that already is one.
    expect(screen.queryByTestId("public-shell-home")).toBeNull();
    setViewportWidth(1440);
  });

  it("sticks to the top: the way back to search must survive a scrolled feed", async () => {
    setViewportWidth(375);
    render(wrap("/s", { phoneChrome: "dock", searchSlot: <input aria-label="q" /> }));

    await waitFor(() => expect(screen.getByTestId("public-shell-header")).toBeDefined());
    const header = screen.getByTestId("public-shell-header");
    expect(header.style.position).toBe("sticky");
    expect(header.style.top).toBe("0px");
    expect(header.style.zIndex).not.toBe("");
    // Painted from the theme's own container token, so whatever scrolls under
    // it is covered on both sides of the theme.
    expect(header.style.background).not.toBe("");
    setViewportWidth(1440);
  });

  it("keeps the footer — legal links are not clutter", async () => {
    setViewportWidth(375);
    render(
      wrap("/s", { phoneChrome: "dock", footer: <span>Privacy</span> })
    );

    await waitFor(() => expect(screen.getByTestId("public-shell-footer")).toBeDefined());
    expect(screen.getByText("Privacy")).toBeDefined();
    setViewportWidth(1440);
  });

  it("has no phone theme control, because the sheet that held it is gone", async () => {
    setViewportWidth(375);
    render(wrap("/s", { phoneChrome: "dock", searchSlot: <input aria-label="q" /> }));

    await waitFor(() => expect(screen.getByTestId("public-shell-header")).toBeDefined());
    // Documented on the prop, not discovered in production: the boot-time
    // system follow covers an anonymous visitor, and a host mounts
    // <ShellThemeControl/> on its own account surface.
    expect(screen.queryByTestId("shell-theme-control")).toBeNull();
    setViewportWidth(1440);
  });

  it("leaves the DESKTOP alone — the prop describes a phone", async () => {
    setViewportWidth(1440);
    render(
      wrap("/s", {
        phoneChrome: "dock",
        brand: <span>Acme</span>,
        searchSlot: <input aria-label="q" />,
        categorySlot: <span>Cars</span>,
      })
    );

    await waitFor(() => expect(screen.getByTestId("public-shell-browse")).toBeDefined());
    expect(screen.getByTestId("public-shell-brand")).toBeDefined();
    expect(screen.getByTestId("public-shell-header").style.position).toBe("");
    expect(screen.getByTestId("shell-theme-control")).toBeDefined();
    expect(screen.queryByTestId("nav-dock")).toBeNull();
  });

  it("still draws the drawer chrome when the prop is omitted", async () => {
    setViewportWidth(375);
    render(wrap("/s", { searchSlot: <input aria-label="q" />, categorySlot: <span>Cars</span> }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Open menu" })).toBeDefined());
    expect(screen.getByTestId("public-shell-header").style.flexDirection).toBe("column");
    expect(screen.getByTestId("public-shell-header").style.position).toBe("");
    setViewportWidth(1440);
  });
});

/**
 * `navBadges` — the canonical badge channel, and `dockBadges` the dock-only
 * one it replaces. A count the chrome knows has to appear on every surface
 * that renders the entry, or it is a fact one surface says and the others
 * swallow — which on a desktop, where there is no dock at all, meant it was
 * said nowhere.
 */
describe("<PublicShell/> — navBadges reach every surface the entry renders on", () => {
  it("marks the top bar's menu on a desktop", async () => {
    setViewportWidth(1440);
    render(wrap("/s", { navBadges: { "listings.compose": 2 } }));

    await waitFor(() => expect(screen.getByTestId("public-shell-menu")).toBeDefined());
    const menu = screen.getByTestId("public-shell-menu");
    expect(
      within(menu).getByRole("menuitem", { name: "Post an ad, 2 unread" })
    ).toBeDefined();
    expect(menu.querySelectorAll(".ant-badge").length).toBe(1);
  });

  it("marks the nav sheet AND the dock on a phone", async () => {
    setViewportWidth(375);
    render(wrap("/s", { navBadges: { "listings.compose": 2 }, categorySlot: <span>Cars</span> }));

    await waitFor(() => expect(screen.getByTestId("nav-dock")).toBeDefined());
    expect(
      screen.getByTestId("nav-dock-item-listings.compose").getAttribute("aria-label")
    ).toBe("Post an ad, 2 unread");

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await waitFor(() => expect(document.querySelector(".ant-drawer-open")).not.toBeNull());
    expect(
      within(screen.getByTestId("public-shell-drawer")).getByRole("menuitem", {
        name: "Post an ad, 2 unread",
      })
    ).toBeDefined();
    setViewportWidth(1440);
  });

  it("draws nothing for a zero", async () => {
    setViewportWidth(1440);
    render(wrap("/s", { navBadges: { "listings.compose": 0 } }));

    await waitFor(() => expect(screen.getByTestId("public-shell-menu")).toBeDefined());
    expect(screen.getByTestId("public-shell-menu").querySelector(".ant-badge")).toBeNull();
  });

  it("keeps the legacy dockBadges working, dock-only and unchanged", async () => {
    setViewportWidth(375);
    render(wrap("/s", { dockBadges: { "listings.compose": 5 }, categorySlot: <span>Cars</span> }));

    await waitFor(() => expect(screen.getByTestId("nav-dock")).toBeDefined());
    expect(
      screen.getByTestId("nav-dock-item-listings.compose").getAttribute("aria-label")
    ).toBe("Post an ad, 5 unread");

    // Dock-only: it says "dock" in its name, and the sheet is not the dock.
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await waitFor(() => expect(document.querySelector(".ant-drawer-open")).not.toBeNull());
    expect(
      screen.getByTestId("public-shell-drawer").querySelector(".ant-badge")
    ).toBeNull();
    setViewportWidth(1440);
  });

  it("merges the two for the dock, and the narrower input wins on a collision", async () => {
    setViewportWidth(375);
    render(
      wrap("/s", {
        navBadges: { "listings.compose": 2, "search.results": 7 },
        dockBadges: { "listings.compose": 5 },
      })
    );

    await waitFor(() => expect(screen.getByTestId("nav-dock")).toBeDefined());
    expect(
      screen.getByTestId("nav-dock-item-listings.compose").getAttribute("aria-label")
    ).toBe("Post an ad, 5 unread");
    expect(
      screen.getByTestId("nav-dock-item-search.results").getAttribute("aria-label")
    ).toBe("Search, 7 unread");
    setViewportWidth(1440);
  });
});

/**
 * ONE LEFT EDGE.
 *
 * The header, the content and the footer each said `spacing[4]` for their side
 * padding, and the PAGES mounted inside the content said their own thing on
 * top of it — so a composed screen had a header at 16px, a category grid at 40
 * (16 + its own 24) and a footer at 16: three left edges down one window, and
 * one of them the buyer's eye lands on first.
 *
 * `--stapel-page-gutter` is a responsive TOKEN role (4px phone / 8px tablet /
 * 24px desktop, declared once by `@stapel/tokens` with its own media arms), so
 * the three boxes read one value and it reflows on resize rather than being
 * recomputed at the shell's next render.
 */
describe("<PublicShell/> — the page gutter is a token, and the same one everywhere", () => {
  it("reads the role in the header, the content and the footer", async () => {
    setViewportWidth(1440);
    render(wrap("/s", { footer: <span>Ranking</span> }));
    await waitFor(() => expect(screen.getByTestId("public-shell-header")).toBeDefined());

    for (const testId of [
      "public-shell-header",
      "public-shell-main",
      "public-shell-footer",
    ]) {
      const style = screen.getByTestId(testId).getAttribute("style") ?? "";
      expect(style).toContain("--stapel-page-gutter");
    }
  });

  it("carries the old value as the var's fallback — a host with no stylesheet does not move", async () => {
    setViewportWidth(1440);
    render(wrap("/s"));
    await waitFor(() => expect(screen.getByTestId("public-shell-header")).toBeDefined());
    // 16px is what all three boxes hardcoded before the role existed.
    expect(
      screen.getByTestId("public-shell-main").getAttribute("style") ?? ""
    ).toContain("--stapel-page-gutter, 16px");
  });

  it("keeps the phone header's own BLOCK padding — only the side is shared", async () => {
    setViewportWidth(390);
    render(wrap("/s"));
    await waitFor(() => expect(screen.getByTestId("public-shell-header")).toBeDefined());
    const style = screen.getByTestId("public-shell-header").getAttribute("style") ?? "";
    // The gutter is the distance from the window's edge; how tall the chrome
    // is remains the chrome's business.
    expect(style).toContain("--stapel-page-gutter");
    expect(style).toMatch(/padding:\s*\d+px/);
  });
});
