/**
 * WHERE THE CHROME CHANGES ARMS — the boundary widths, and only those.
 *
 * `@stapel/tokens` ships three breakpoints (`phone: 0`, `tablet: 768`,
 * `desktop: 1200`) and both chromes collapsed them to two with
 * `breakpoint === "desktop"`, so every width from 768 to 1199 drew the PHONE
 * page: the bottom dock over a laptop-width window, the one-row phone header,
 * no browse bar, the nav behind a hamburger. A tablet rendered a phone.
 *
 * The rule now: below `chromeFrom` (default `breakpoints.tablet`) the phone
 * shell, from it up the wide shell. The layout stays FLUID above the edge —
 * `contentMaxWidth` is a max and binds only where the window exceeds it — so
 * nothing jumps to the desktop measure at 768.
 *
 * This file is written at the EDGES. 767/768 and 1199/1200 are the assertions
 * that mean anything; 375 and 1024 are there to say the arms either side are
 * whole. Each case prints its markers, so a run is evidence and not only a
 * verdict.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { breakpoints } from "@stapel/tokens";
import { AppShell } from "../src/default/AppShell.js";
import {
  PublicShell,
  HEADER_HEIGHT_DESKTOP,
  HEADER_HEIGHT_PHONE,
  publicShellCss,
} from "../src/default/PublicShell.js";
import type { PublicShellProps } from "../src/default/PublicShell.js";
import type { ResolvedNavEntry } from "../src/headless/resolveNav.js";
import { registerShellI18n } from "../src/i18n/keys.js";

afterEach(() => cleanup());

/** The six widths the ruling is about: both sides of both edges, and one
 * middle per arm so a broken arm cannot pass as a moved edge. */
const WIDTHS = [375, 767, 768, 1024, 1199, 1200] as const;

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true });
  window.dispatchEvent(new Event("resize"));
}

const NAV: readonly ResolvedNavEntry[] = [
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
];

function i18n(): ReturnType<typeof createI18n> {
  const instance = createI18n({ locale: "en" });
  registerShellI18n(instance);
  instance.registerBundle("en", {
    "listings.nav.compose": "Post an ad",
    "search.nav.results": "Search",
  });
  return instance;
}

function publicTree(props: Partial<PublicShellProps>): ReactElement {
  return (
    <I18nProvider i18n={i18n()}>
      <MemoryRouter initialEntries={["/s"]}>
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

/** What the chrome actually drew, as facts a reader can check on the page. */
interface ChromeMarkers {
  readonly width: number;
  /** The floating bottom dock — the phone marker the fleet saw on tablets. */
  readonly dock: boolean;
  /** The desktop browse bar under the header. */
  readonly browseBar: boolean;
  /** The hamburger that opens the phone nav sheet. */
  readonly hamburger: boolean;
  /**
   * WHICH ARM THE SHELL SAYS IT TOOK — the header's own `data-phone-chrome`,
   * which is the chrome resolved for the width being drawn (`"drawer"` /
   * `"dock"` below the edge, absent above it). Read rather than inferred: it
   * is the attribute a host's stylesheet hangs rules on.
   */
  readonly chromeArm: "drawer" | "dock" | "wide";
  /** How the header row is laid out: `"stacked"` is the two-line phone
   * header, `"single"` is one row (the wide arm, and the dock chrome). */
  readonly headerRow: "stacked" | "single";
  /** The header's own height, inline. `"auto"` is the two-line phone header. */
  readonly headerHeight: string;
  /** The theme switch in the header (the wide arm's placement). */
  readonly headerThemeControl: boolean;
  /** The content measure. A max, so it binds only above itself. */
  readonly contentMaxWidth: string;
  /** Is the routed content actually capped at this width, or fluid? */
  readonly contentFluid: boolean;
  /** The nav `Menu`'s antd layout mode. `"absent"` is the phone arm's own
   * answer: the menu is inside a closed sheet, so it is not on the page. */
  readonly menuMode: "horizontal" | "inline" | "absent";
  /**
   * What `--stapel-header-height` RESOLVES to at this width — the number two
   * other pairs pin against (`<SearchPage railTop>`,
   * `<SearchResultsPane stickyToolbar>`).
   *
   * It is published by media query, and jsdom resolves none, so it is read
   * out of the sheet the shell actually rendered by applying the same cascade
   * the engine would: equal specificity (`:where()`), so the LAST matching
   * rung wins. A value here that disagrees with `headerHeight` is the D449
   * defect — a rail pinned 8px under the header for a whole band.
   */
  readonly headerHeightVar: string;
}

/**
 * The rungs of `--stapel-header-height` in the sheet, in source order, with
 * the width each one needs. `undeclared` is an honest answer: the two-line
 * phone header has no fixed height, so the property is deliberately absent
 * and a host's own `var(…, 56px)` fallback answers instead.
 */
function resolveHeaderHeightVar(css: string, width: number, dock: boolean): string {
  let resolved = "undeclared";
  // One rule per line (`publicShellCss` joins them so), so the cascade is the
  // file's own order — which is the whole point of the `:where()` on the dock
  // rung: zero added specificity, decided by position.
  for (const rule of css.split("\n")) {
    const declared = /--stapel-header-height:(\d+)px/.exec(rule);
    if (declared === null) continue;
    const media = /@media \(min-width:(\d+)px\)/.exec(rule);
    if (media !== null && width < Number(media[1])) continue;
    if (rule.includes('[data-phone-chrome="dock"]') && !dock) continue;
    resolved = `${String(declared[1])}px`;
  }
  return resolved;
}

function readPublicMarkers(width: number, chromeFrom: number): ChromeMarkers {
  const header = screen.getByTestId("public-shell-header");
  const content = screen.getByTestId("public-shell-content");
  const menu = document.querySelector("[data-testid='public-shell-menu']");
  const maxWidth = content.style.maxWidth;
  const cap = Number.parseInt(maxWidth, 10);
  // The sheet THIS shell rendered, not a second call to the function that
  // writes it: the property and the header have to agree on the page.
  //
  // Picked by its own edge, because React 19 hoists a `<style href>` into the
  // document HEAD and `cleanup()` does not take it out again — a file that
  // renders at two edges has both sheets in the head at once, which is exactly
  // why the href varies with the edge (see `publicShellStyleHref`). Without
  // that, one page would be reading the other page's header height.
  const sheet =
    [...document.querySelectorAll("style")]
      .map((style) => style.textContent ?? "")
      .find(
        (text) =>
          text.includes("--stapel-header-height") &&
          text.includes(`@media (min-width:${String(chromeFrom)}px)`)
      ) ?? "";
  const declaredDock =
    screen.getByTestId("public-shell").getAttribute("data-phone-chrome") === "dock";
  return {
    headerHeightVar: resolveHeaderHeightVar(sheet, width, declaredDock),
    width,
    dock: screen.queryByTestId("nav-dock") !== null,
    browseBar: screen.queryByTestId("public-shell-browse") !== null,
    hamburger: screen.queryByTestId("public-shell-menu-trigger") !== null,
    chromeArm: (header.getAttribute("data-phone-chrome") ?? "wide") as
      | "drawer"
      | "dock"
      | "wide",
    headerRow: header.style.flexDirection === "column" ? "stacked" : "single",
    headerHeight: header.style.height,
    headerThemeControl:
      header.querySelector("[data-testid='shell-theme-control']") !== null,
    contentMaxWidth: maxWidth === "" ? "none" : maxWidth,
    contentFluid: Number.isNaN(cap) || width <= cap,
    menuMode:
      menu === null
        ? "absent"
        : menu.className.includes("ant-menu-horizontal")
          ? "horizontal"
          : "inline",
  };
}

/** Render at each width, collect the markers, and PRINT them: the table is
 * the evidence the ruling asked for, before and after. */
function walkPublic(
  label: string,
  props: Partial<PublicShellProps> = {}
): readonly ChromeMarkers[] {
  const rows = WIDTHS.map((width) => {
    setViewportWidth(width);
    render(publicTree(props));
    const markers = readPublicMarkers(width, props.chromeFrom ?? breakpoints.tablet);
    cleanup();
    return markers;
  });
  console.log(`\n<PublicShell/> ${label}\n${table(rows)}`);
  return rows;
}

function table(rows: readonly Record<string, unknown>[]): string {
  const first = rows[0];
  if (first === undefined) return "(no rows)";
  const columns = Object.keys(first);
  const widthOf = (column: string): number =>
    Math.max(column.length, ...rows.map((row) => String(row[column]).length));
  const line = (cells: readonly string[]): string =>
    cells.map((cell, i) => cell.padEnd(widthOf(columns[i] ?? ""))).join("  ");
  return [
    line(columns),
    ...rows.map((row) => line(columns.map((column) => String(row[column])))),
  ].join("\n");
}

const at = (rows: readonly ChromeMarkers[], width: number): ChromeMarkers => {
  const row = rows.find((candidate) => candidate.width === width);
  if (row === undefined) throw new Error(`no row at ${String(width)}`);
  return row;
};

describe("<PublicShell/> — the chrome changes arms at the tablet edge", () => {
  it("draws the phone shell below 768 and the wide shell from 768 up", () => {
    const rows = walkPublic("default chrome");

    // ── the phone arm, both sides of nothing ────────────────────────────────
    for (const width of [375, 767]) {
      const row = at(rows, width);
      expect(row.dock, `dock at ${String(width)}`).toBe(true);
      expect(row.browseBar, `browse bar at ${String(width)}`).toBe(false);
      expect(row.hamburger, `hamburger at ${String(width)}`).toBe(true);
      expect(row.chromeArm, `chrome arm at ${String(width)}`).toBe("drawer");
      expect(row.headerRow, `header row at ${String(width)}`).toBe("stacked");
      expect(row.headerThemeControl).toBe(false);
      // The menu is not on the page at all below the edge: it lives in the
      // sheet the hamburger opens.
      expect(row.menuMode, `menu mode at ${String(width)}`).toBe("absent");
      // The two-line phone header has no fixed height, so the property stays
      // UNDECLARED rather than being told a wrong one.
      expect(row.headerHeight, `header height at ${String(width)}`).toBe("auto");
      expect(row.headerHeightVar, `header var at ${String(width)}`).toBe("undeclared");
    }

    // ── THE EDGE. 768 is the first width that is not a phone ────────────────
    for (const width of [768, 1024, 1199, 1200]) {
      const row = at(rows, width);
      expect(row.dock, `dock at ${String(width)}`).toBe(false);
      expect(row.browseBar, `browse bar at ${String(width)}`).toBe(true);
      expect(row.hamburger, `hamburger at ${String(width)}`).toBe(false);
      expect(row.chromeArm, `chrome arm at ${String(width)}`).toBe("wide");
      expect(row.headerRow, `header row at ${String(width)}`).toBe("single");
      expect(row.headerHeight, `header height at ${String(width)}`).toBe(
        `${String(HEADER_HEIGHT_DESKTOP)}px`
      );
      expect(row.headerThemeControl, `theme control at ${String(width)}`).toBe(true);
      expect(row.menuMode, `menu mode at ${String(width)}`).toBe("horizontal");
      // THE PUBLISHED NUMBER IS THE DRAWN NUMBER. Two pairs pin against it;
      // 56 under a 64px header is a rail 8px below the chrome, all band long.
      expect(row.headerHeightVar, `header var at ${String(width)}`).toBe(
        row.headerHeight
      );
    }

    // ── FLUID, not "jumped to the desktop measure" ──────────────────────────
    // The measure is a MAX: it is the same number at every width and binds
    // only where the window is wider than it, so 768..1199 spends the whole
    // window on content instead of centring in a 1280 column it cannot fill.
    for (const width of WIDTHS) {
      const row = at(rows, width);
      expect(row.contentMaxWidth, `measure at ${String(width)}`).toBe("1280px");
      expect(row.contentFluid, `fluid at ${String(width)}`).toBe(true);
    }
  });

  it("ends the docked phone chrome at the same edge", () => {
    const rows = walkPublic('phoneChrome="dock"', {
      phoneChrome: "dock",
      searchSlot: <input aria-label="q" />,
    });

    for (const width of [375, 767]) {
      const row = at(rows, width);
      expect(row.dock, `dock at ${String(width)}`).toBe(true);
      // The one-row phone header the dock chrome is: its own height, not the
      // wide row's.
      expect(row.headerHeight, `header height at ${String(width)}`).toBe(
        `${String(HEADER_HEIGHT_PHONE)}px`
      );
      expect(row.headerHeightVar, `header var at ${String(width)}`).toBe(
        row.headerHeight
      );
    }
    for (const width of [768, 1024, 1199, 1200]) {
      const row = at(rows, width);
      expect(row.dock, `dock at ${String(width)}`).toBe(false);
      expect(row.headerHeight, `header height at ${String(width)}`).toBe(
        `${String(HEADER_HEIGHT_DESKTOP)}px`
      );
      expect(row.headerHeightVar, `header var at ${String(width)}`).toBe(
        row.headerHeight
      );
    }
  });

  /**
   * The sheet and the render must agree, or the published header height is a
   * lie for the whole band — which is the D449 defect exactly: the rail and
   * the toolbar pinned 8px under the header because the property said 56 while
   * the header drew 64. jsdom resolves no media query, so this is asserted
   * structurally, on the text of the rule.
   */
  it("publishes the header height at the SAME edge the render changes arms at", () => {
    const css = publicShellCss();
    expect(css).toContain(`@media (min-width:${String(breakpoints.tablet)}px)`);
    expect(css).not.toContain(`@media (min-width:${String(breakpoints.desktop)}px)`);
    // The wide rung is declared last, so it beats the dock rung by ORDER at
    // zero added specificity (`:where()`), on every phone-chrome value.
    const dockRung = css.indexOf('[data-phone-chrome="dock"]');
    const wideRung = css.indexOf(`@media (min-width:${String(breakpoints.tablet)}px)`);
    expect(dockRung).toBeGreaterThanOrEqual(0);
    expect(wideRung).toBeGreaterThan(dockRung);
  });

  /**
   * A deployment whose own composition puts the edge elsewhere names it once
   * — the shape `<SearchPage railFrom>` already has — instead of starving the
   * shell of nav to fake a desktop.
   */
  it("takes a host's own edge, and keeps the token edge as the default", () => {
    const rows = WIDTHS.map((width) => {
      setViewportWidth(width);
      render(publicTree({ chromeFrom: 1024 }));
      const markers = readPublicMarkers(width, 1024);
      cleanup();
      return markers;
    });
    console.log(`\n<PublicShell/> chromeFrom={1024}\n${table(rows)}`);

    for (const width of [375, 767, 768]) {
      const row = at(rows, width);
      expect(row.dock, `dock at ${String(width)}`).toBe(true);
      expect(row.browseBar, `browse bar at ${String(width)}`).toBe(false);
      // 768 is a PHONE here, so the sheet must not publish a wide header for
      // it either — the two answers move together or the band lies again.
      expect(row.headerHeightVar, `header var at ${String(width)}`).toBe(
        "undeclared"
      );
    }
    for (const width of [1024, 1199, 1200]) {
      const row = at(rows, width);
      expect(row.dock, `dock at ${String(width)}`).toBe(false);
      expect(row.browseBar, `browse bar at ${String(width)}`).toBe(true);
      expect(row.headerHeightVar, `header var at ${String(width)}`).toBe(
        row.headerHeight
      );
    }
  });
});

describe("<AppShell/> — the rail changes arms at the same edge", () => {
  function appTree(): ReactElement {
    return (
      <I18nProvider i18n={i18n()}>
        <MemoryRouter initialEntries={["/s"]}>
          <Routes>
            <Route element={<AppShell nav={NAV} logo={<span>Acme</span>} />}>
              <Route path="s" element={<div>Search Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );
  }

  it("withholds the Sider below 768 only, and collapses it to a rail on a tablet", () => {
    const rows = WIDTHS.map((width) => {
      setViewportWidth(width);
      render(appTree());
      const header = screen.getByTestId("app-shell-header");
      const sider = screen.queryByTestId("app-shell-sider");
      const markers = {
        width,
        sider: sider !== null,
        siderArm:
          sider === null
            ? "none"
            : sider.className.includes("ant-layout-sider-collapsed")
              ? "rail"
              : "full",
        hamburger: screen.queryByTestId("app-shell-menu-trigger") !== null,
        headerHeight: header.style.height,
      };
      cleanup();
      return markers;
    });
    console.log(`\n<AppShell/>\n${table(rows)}`);

    for (const width of [375, 767]) {
      const row = rows.find((candidate) => candidate.width === width);
      expect(row?.sider, `sider at ${String(width)}`).toBe(false);
      expect(row?.hamburger, `hamburger at ${String(width)}`).toBe(true);
      expect(row?.headerHeight).toBe(`${String(HEADER_HEIGHT_PHONE)}px`);
    }
    // THE TABLET ARM IS ITS OWN, not either neighbour's: the destinations stay
    // on screen as an icon rail rather than hiding behind a hamburger, and
    // they do not spend 200px of a 768px window on labels.
    for (const width of [768, 1024, 1199]) {
      const row = rows.find((candidate) => candidate.width === width);
      expect(row?.sider, `sider at ${String(width)}`).toBe(true);
      expect(row?.siderArm, `sider arm at ${String(width)}`).toBe("rail");
      expect(row?.hamburger, `hamburger at ${String(width)}`).toBe(false);
      expect(row?.headerHeight).toBe(`${String(HEADER_HEIGHT_DESKTOP)}px`);
    }
    const desktop = rows.find((candidate) => candidate.width === 1200);
    expect(desktop?.sider).toBe(true);
    expect(desktop?.siderArm).toBe("full");
    expect(desktop?.hamburger).toBe(false);
  });
});
