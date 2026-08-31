/**
 * `<NavDock/>` — the phone's primary navigation, and the four claims the
 * island makes that a screenshot cannot check:
 *
 *  1. it is a PHONE surface: a desktop viewport gets the browse bar and no
 *     floating island, a 390px one gets the island. A test that never sets a
 *     width proves neither;
 *  2. the fill degrades OPAQUE — the translucency lives inside `@supports`, so
 *     an engine that cannot blur never gets 78% of a background under its
 *     labels;
 *  3. every destination is a real, keyboard-reachable link with `aria-current`
 *     on the one the person is on;
 *  4. the page leaves room under its last row for an island that FLOATS.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { PublicShell } from "../src/default/PublicShell.js";
import { DOCK_CLASS, DOCK_MAX_DESTINATIONS, NavDock, dockEntries, dockGlassCss } from "../src/default/NavDock.js";
import type { ResolvedNavEntry } from "../src/headless/resolveNav.js";
import { registerShellI18n } from "../src/i18n/keys.js";

afterEach(() => cleanup());

/** The phone the mobile-first rule is written against. */
const PHONE_WIDTH = 390;
/** Past `breakpoints.desktop` (1200), where the dock must not appear. */
const DESKTOP_WIDTH = 1440;

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true });
  window.dispatchEvent(new Event("resize"));
}

function entry(
  id: string,
  labelKey: string,
  path: string,
  order: number
): ResolvedNavEntry {
  return {
    id,
    labelKey,
    icon: "SearchOutlined",
    route: { path },
    linkPath: path,
    index: false,
    component: { export: "Screen", subpath: "default" },
    requiresAuth: false,
    surface: "public",
    order,
    menuVisible: true,
  };
}

const NAV: readonly ResolvedNavEntry[] = [
  entry("search.results", "search.nav.results", "/s", 10),
  entry("listings.compose", "listings.nav.compose", "/new", 20),
  entry("chat.threads", "chat.nav.threads", "/chat", 30),
  entry("listings.favorites", "listings.nav.favorites", "/favorites", 40),
  entry("profiles.settings", "profiles.nav.settings", "/settings", 50),
  entry("docs.help", "docs.nav.help", "/help", 60),
];

const LABELS: Record<string, string> = {
  "search.nav.results": "Search",
  "listings.nav.compose": "Post an ad",
  "chat.nav.threads": "Chat",
  "listings.nav.favorites": "Favourites",
  "profiles.nav.settings": "Profile",
  "docs.nav.help": "Help",
  // The compact wording a phone dock prefers — see `NavEntry.shortLabelKey`.
  "listings.nav.compose.short": "Post",
};

function frame(
  initialPath: string,
  body: ReactElement,
  locale = "en"
): ReactElement {
  const i18n = createI18n({ locale });
  registerShellI18n(i18n, locale);
  i18n.registerBundle(locale, LABELS);
  return (
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialPath]}>{body}</MemoryRouter>
    </I18nProvider>
  );
}

function shell(
  initialPath: string,
  props: Partial<Parameters<typeof PublicShell>[0]> = {}
): ReactElement {
  return frame(
    initialPath,
    <Routes>
      <Route element={<PublicShell nav={NAV} {...props} />}>
        <Route path="s" element={<div>Search Page</div>} />
        <Route path="new" element={<div>Compose Page</div>} />
        <Route path="chat" element={<div>Chat Page</div>} />
      </Route>
    </Routes>
  );
}

describe("the dock is a phone surface, and the width decides", () => {
  it("floats an island at 390px", async () => {
    setViewportWidth(PHONE_WIDTH);
    render(shell("/s"));
    await waitFor(() => expect(screen.getByTestId("nav-dock")).toBeDefined());
    const dock = screen.getByTestId("nav-dock");
    expect(dock.style.position).toBe("fixed");
    // Inset from BOTH edges: an island, not a bar welded to the viewport.
    expect(dock.style.insetInline).not.toBe("");
    // `safe-area-inset-bottom`, not a bare number: on a notched phone the
    // island would otherwise float on top of the home indicator. (jsdom's CSS
    // parser reorders the `env()` fallback, so the assertion is on the custom
    // property's NAME rather than the exact text a browser would see.)
    expect(dock.style.bottom).toContain("safe-area-inset-bottom");
  });

  it("draws no island on a desktop, where the browse bar already is the nav", async () => {
    setViewportWidth(DESKTOP_WIDTH);
    render(shell("/s"));
    await waitFor(() => expect(screen.getByTestId("public-shell-browse")).toBeDefined());
    expect(screen.queryByTestId("nav-dock")).toBeNull();
  });

  it("takes `dock={false}` from a host whose own chrome owns the bottom edge", async () => {
    setViewportWidth(PHONE_WIDTH);
    render(shell("/s", { dock: false }));
    await waitFor(() => expect(screen.getByTestId("public-shell-header")).toBeDefined());
    expect(screen.queryByTestId("nav-dock")).toBeNull();
  });

  it("leaves room under the page's last row for an island that floats", async () => {
    setViewportWidth(PHONE_WIDTH);
    render(shell("/s"));
    await waitFor(() => expect(screen.getByTestId("nav-dock")).toBeDefined());
    // On the page COLUMN, not on the content: the island is fixed over the
    // last thing on the page, and the last thing is the footer, not the
    // content. Reserving on the content cleared the final card and left the
    // footer's legal links permanently under the island.
    const shellRoot = screen.getByTestId("public-shell");
    // The clearance is the island plus its insets plus the home indicator —
    // a number alone would sit ON the gesture bar of a notched phone.
    expect(shellRoot.style.paddingBottom).toContain("safe-area-inset-bottom");
    const content = document.querySelector(".ant-layout-content");
    expect(content).not.toBeNull();
    // The content keeps only its own even padding — the clearance is not
    // duplicated here, or the footer sits one island-height too low.
    expect((content as HTMLElement).style.paddingBottom).not.toContain(
      "safe-area-inset-bottom"
    );
  });

  it("reserves nothing when the nav is too small for an island to be drawn", async () => {
    setViewportWidth(PHONE_WIDTH);
    render(shell("/s", { nav: NAV.slice(0, 1) }));
    await waitFor(() => expect(screen.getByTestId("public-shell-header")).toBeDefined());
    expect(screen.queryByTestId("nav-dock")).toBeNull();
    // A strip of empty page under a dock nobody drew is the defect
    // `dockRenders` exists to close: the reservation asks the same question
    // the dock does.
    expect(screen.getByTestId("public-shell").style.paddingBottom).toBe("");
  });
});

describe("the island is glass, and legible without it", () => {
  it("puts the translucency behind @supports and keeps an opaque base", () => {
    const css = dockGlassCss();
    const base = css.slice(0, css.indexOf("@supports"));
    // Base: the opaque fill, no blur. This is what an engine without
    // backdrop-filter renders, and it has to be a readable surface.
    expect(base).toContain("--shell-dock-fill)");
    expect(base).not.toContain("backdrop-filter");
    // Enhancement: the translucent fill and the blur, together, or neither.
    const supported = css.slice(css.indexOf("@supports"));
    expect(supported).toContain("--shell-dock-fill-glass)");
    expect(supported).toContain("backdrop-filter:blur(");
    expect(supported).toContain("-webkit-backdrop-filter:blur(");
  });

  it("carries both fills on the element, so one hoisted sheet serves either theme", async () => {
    setViewportWidth(PHONE_WIDTH);
    render(shell("/s"));
    await waitFor(() => expect(screen.getByTestId("nav-dock")).toBeDefined());
    const dock = screen.getByTestId("nav-dock");
    expect(dock.className).toContain(DOCK_CLASS);
    const opaque = dock.style.getPropertyValue("--shell-dock-fill");
    const glass = dock.style.getPropertyValue("--shell-dock-fill-glass");
    expect(opaque).not.toBe("");
    // The glass fill is DERIVED from the opaque one rather than picked, so the
    // two can never be two different colours.
    expect(glass).toContain("color-mix");
    expect(glass).toContain(opaque);
    // An edge that survives a fill matching what is behind it.
    expect(dock.style.border).not.toBe("");
    expect(dock.style.boxShadow).not.toBe("");
  });

  it("paints a dark island on a dark document, not a light one", async () => {
    setViewportWidth(PHONE_WIDTH);
    render(shell("/s", { mode: "dark" }));
    await waitFor(() => expect(screen.getByTestId("nav-dock")).toBeDefined());
    const dark = screen
      .getByTestId("nav-dock")
      .style.getPropertyValue("--shell-dock-fill");
    cleanup();
    render(shell("/s", { mode: "light" }));
    await waitFor(() => expect(screen.getByTestId("nav-dock")).toBeDefined());
    const light = screen
      .getByTestId("nav-dock")
      .style.getPropertyValue("--shell-dock-fill");
    expect(dark).not.toBe(light);
  });
});

describe("five destinations, chosen by the order the project already declares", () => {
  it("takes the first five and stops", () => {
    expect(dockEntries(NAV).map((e) => e.id)).toEqual([
      "search.results",
      "listings.compose",
      "chat.threads",
      "listings.favorites",
      "profiles.settings",
    ]);
    expect(dockEntries(NAV)).toHaveLength(DOCK_MAX_DESTINATIONS);
  });

  it("never draws more than five even when asked for more", () => {
    expect(dockEntries(NAV, 99)).toHaveLength(DOCK_MAX_DESTINATIONS);
  });

  it("renders nothing for one destination — an island with one link is a button", async () => {
    setViewportWidth(PHONE_WIDTH);
    render(
      frame(
        "/s",
        <Routes>
          <Route element={<PublicShell nav={[NAV[0] as ResolvedNavEntry]} />}>
            <Route path="s" element={<div>Search Page</div>} />
          </Route>
        </Routes>
      )
    );
    await waitFor(() => expect(screen.getByText("Search Page")).toBeDefined());
    expect(screen.queryByTestId("nav-dock")).toBeNull();
  });
});

describe("every destination is reachable, and the current one says so", () => {
  it("is a real link with an href, and marks the page it is on", async () => {
    setViewportWidth(PHONE_WIDTH);
    render(shell("/s"));
    await waitFor(() => expect(screen.getByTestId("nav-dock")).toBeDefined());
    const dock = within(screen.getByTestId("nav-dock"));
    const search = dock.getByTestId("nav-dock-item-search.results");
    expect(search.getAttribute("href")).toBe("/s");
    expect(search.getAttribute("aria-current")).toBe("page");
    // …and only that one.
    expect(
      dock.getByTestId("nav-dock-item-chat.threads").getAttribute("aria-current")
    ).toBeNull();
  });

  it("prints the pair's COMPACT label and keeps the long one as the name", async () => {
    setViewportWidth(PHONE_WIDTH);
    const withShort = NAV.map((e) =>
      e.id === "listings.compose" ? { ...e, shortLabelKey: "listings.nav.compose.short" } : e
    );
    render(
      frame(
        "/s",
        <Routes>
          <Route element={<PublicShell nav={withShort} />}>
            <Route path="s" element={<div>Search Page</div>} />
          </Route>
        </Routes>
      )
    );
    await waitFor(() => expect(screen.getByTestId("nav-dock")).toBeDefined());
    const compose = screen.getByTestId("nav-dock-item-listings.compose");
    // What a 68px cell prints…
    expect(compose.textContent).toContain("Post");
    expect(compose.textContent).not.toContain("Post an ad");
    // …and what a screen reader still hears: a dock cell's width is not a
    // reason to give assistive technology the poorer answer.
    expect(compose.getAttribute("aria-label")).toBe("Post an ad");
    // A destination with no compact wording is untouched — every manifest
    // written before the field existed renders exactly as it did.
    const search = screen.getByTestId("nav-dock-item-search.results");
    expect(search.textContent).toContain("Search");
    expect(search.getAttribute("aria-label")).toBeNull();
  });

  it("names the landmark, so a screen reader can tell the dock from the drawer", async () => {
    setViewportWidth(PHONE_WIDTH);
    render(shell("/s"));
    await waitFor(() => expect(screen.getByTestId("nav-dock")).toBeDefined());
    expect(
      screen.getByRole("navigation", { name: "Main sections" })
    ).toBeDefined();
  });

  it("folds a badge count into the link's accessible name", async () => {
    setViewportWidth(PHONE_WIDTH);
    render(shell("/s", { dockBadges: { "chat.threads": 3 } }));
    await waitFor(() => expect(screen.getByTestId("nav-dock")).toBeDefined());
    expect(screen.getByRole("link", { name: "Chat, 3 unread" })).toBeDefined();
    // A destination with nothing waiting keeps its own plain name.
    expect(screen.getByRole("link", { name: "Favourites" })).toBeDefined();
  });

  it("draws no badge for a zero — a mark that says nothing is happening", async () => {
    setViewportWidth(PHONE_WIDTH);
    render(shell("/s", { dockBadges: { "chat.threads": 0 } }));
    await waitFor(() => expect(screen.getByTestId("nav-dock")).toBeDefined());
    expect(screen.getByRole("link", { name: "Chat" })).toBeDefined();
  });

  it("translates the chrome it owns", async () => {
    setViewportWidth(PHONE_WIDTH);
    const i18n = createI18n({ locale: "ru" });
    registerShellI18n(i18n, "ru");
    const { registerShellI18nRu } = await import("../src/i18n/ru.js");
    registerShellI18nRu(i18n);
    i18n.registerBundle("ru", { "search.nav.results": "Поиск" });
    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/s"]}>
          <NavDock nav={NAV} />
        </MemoryRouter>
      </I18nProvider>
    );
    await waitFor(() => expect(screen.getByTestId("nav-dock")).toBeDefined());
    expect(
      screen.getByRole("navigation", { name: "Основные разделы" })
    ).toBeDefined();
  });
});
