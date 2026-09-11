/**
 * `<PublicShell/>` — the SECOND chrome of `@stapel/shell-react/default`, and
 * a SIBLING of `<AppShell/>` rather than a flag on it.
 *
 * ── Why a sibling and not `<AppShell mode="public">` ───────────────────────
 *
 * `AppShell` reads no session and no workspace — its four props are `nav`,
 * `mode`, `logo`, `headerExtra`, and nothing in it touches a mandate. So the
 * thing standing between the fleet and a public storefront was never
 * workspace-coupling; it is the SHAPE OF THE CHROME. `AppShell` IS a
 * `Layout.Sider` on desktop and a hamburger `Drawer` on phone, and a
 * marketplace needs a top bar with a brand, a search field, a category strip
 * and a sign-in CTA. A `public` flag would branch the entire render tree —
 * two components wearing one coat — so the axis is expressed as two
 * components sharing everything that is genuinely shared: `resolveNav` (the
 * headless entry, no React), `resolveNavIcon`, `NavMenu`, `SkinTheme`
 * and `useBreakpoint`.
 *
 * ── The three rules this component is TESTED against, not trusted on ───────
 *
 * 1. **No `Sider`, ever.** Top bar + optional browse bar + `<Outlet/>` +
 *    optional footer. On phone the browse bar collapses into a `Drawer` — or,
 *    with `phoneChrome="dock"`, disappears entirely into the bottom dock and
 *    leaves one sticky header row. Either way the header itself never
 *    collapses, because a storefront whose search box disappears on a phone is
 *    a storefront nobody searches.
 *
 * 2. **`accountSlot` is a CTA, never emptiness.** Omit it and this component
 *    renders a sign-in link anyway. A hidden control teaches nothing
 *    (private-space canon §6.3): the absence of a sign-in button on a public
 *    storefront is not "clean", it is a dead end for the one person the page
 *    exists to convert. A host with a live session passes its own account
 *    menu and the default steps aside.
 *
 * 3. **It reads no session itself** — exactly like `AppShell`. The mandate is
 *    supplied by the container (`@stapel/core`'s `MandateProvider` +
 *    `matchMandate`), which is also what decides WHICH nav it resolved:
 *    `resolvePublicNav` for an anonymous visitor, `resolveMemberNav` once the
 *    mandate settles. Were the shell to read the mandate too, the access rule
 *    would live in two places and the second one would be wrong first.
 *
 * ```tsx
 * import { resolvePublicNav } from "@stapel/shell-react";
 * import { PublicShell } from "@stapel/shell-react/default";
 *
 * <Route element={
 *   <PublicShell
 *     nav={resolvePublicNav(INSTALLED_NAV_MANIFESTS, overrides)}
 *     brand={<Link to="/"><Logo/></Link>}
 *     searchSlot={<SearchField/>}
 *     categorySlot={<TopCategories/>}
 *     footer={<RankingDisclosureLink/>}
 *   />
 * }>…public routes…</Route>
 * ```
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Drawer, Flex, Layout, theme } from "antd";
import { Link, Outlet } from "react-router";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useBreakpoint, useOptionalSite, useT } from "@stapel/core";
import { breakpoints, cssVar, spacing } from "@stapel/tokens-antd";
import type { ResolvedNavEntry } from "../headless/resolveNav.js";
import { NavMenu } from "./navMenu.js";
import { NavDock, DOCK_CLEARANCE, dockRenders } from "./NavDock.js";
import { useRouteScrollReset } from "./routeScroll.js";
import { CloseGlyph, HomeGlyph, MenuGlyph } from "./icons.js";
import { ShellThemeControl } from "./ShellThemeControl.js";
import { SiteBrand } from "./SiteBrand.js";
import { SiteLegalFooter } from "./SiteLegalFooter.js";
import { SHELL_I18N_KEYS } from "../i18n/keys.js";

/**
 * Where the default sign-in CTA points. This is `auth.login`'s own declared
 * route (`@stapel/auth-react`'s nav manifest: `{ id: "auth.login",
 * route: { path: "/login" }, requiresAuth: false }`) — the fleet's one
 * sign-in address, not a guess. A host that mounts sign-in elsewhere passes
 * `accountSlot` and this constant never runs.
 */
const SIGN_IN_PATH = "/login";

/**
 * The default measure for the routed content. 1280px is the fleet's widest
 * comfortable content column: a 12-column catalogue grid at ~280px cards plus
 * gutters, and prose that stays inside a readable line length on any monitor
 * bigger than the layout.
 */
const DEFAULT_CONTENT_MAX_WIDTH = 1280;

/** See `AppShell`'s constants of the same name — one frame, one geometry. */
/**
 * The page's own side padding — header, content and footer, one value.
 *
 * `--stapel-page-gutter` is a RESPONSIVE token role: 4px on a phone, 8px on a
 * tablet, 24px on a desktop, declared once by `@stapel/tokens` with its own
 * media arms. Read as a var rather than computed here for two reasons, and the
 * second is the one that matters:
 *
 *  - it changes with the VIEWPORT, and this shell already knows its
 *    breakpoint — but a value computed in JS is applied at render and a page
 *    resized between renders keeps the old gutter, where a var reflows;
 *  - it is the same edge for everything on the page. The three boxes used to
 *    say `spacing[4]` each, and the pages MOUNTED INSIDE them said their own
 *    thing — so a composed screen had a header at 16px, a category grid at 24
 *    and a footer at 16, three left edges down one window. One role, read by
 *    everyone, is the only shape that cannot drift.
 *
 * Written through `cssVar` (so a renamed role fails to compile rather than
 * silently resolving to nothing) with the value the three boxes used before
 * the role existed as the fallback, which keeps a host that loads no
 * stylesheet exactly where it was.
 */
const PAGE_GUTTER_CSS = `${cssVar("page-gutter").slice(0, -1)}, ${String(spacing[4])}px)`;

/**
 * How tall `<PublicShell/>`'s header is, in CSS pixels — the DESKTOP row and
 * the one-row phone row (`phoneChrome="dock"`).
 *
 * EXPORTED, because everything a host pins under a fixed header offsets itself
 * by exactly this number and there was no way to ask for it: the fleet's
 * storefront restated `56` and `64` in its own sheet and held them against the
 * installed `dist` with a unit test, which is a gate written because the
 * geometry was private rather than because it should be checked. A filter
 * rail, a sort bar, a "back to top" button and a category strip all pin
 * against it; four restatements of a number this component owns is four
 * chances to be wrong on the day it changes.
 *
 * The pair also publishes them as {@link HEADER_HEIGHT_VAR} on its own root —
 * see {@link publicShellCss} — so a stylesheet gets the same answer without
 * a build-time import.
 */
export const HEADER_HEIGHT_DESKTOP: number = spacing[8];

/** See {@link HEADER_HEIGHT_DESKTOP}. The one-row phone header's height —
 * `phoneChrome="dock"`. In `"drawer"` the phone header takes a second line for
 * the search field and is `height: auto`, which is why the property below is
 * not declared there at all. */
export const HEADER_HEIGHT_PHONE: number = spacing[7] + spacing[2];

/** The class the shell's own root sheet is hung on. */
export const PUBLIC_SHELL_CLASS = "stapel-public-shell";

/**
 * The class the shell's HEADER carries, and what the sheet's seam rules are
 * hung on.
 *
 * A class rather than the `data-testid` a host used to reach for: a test id is
 * a hook for a test, and a rule that has to exist in every build should not be
 * written against one. The id stays where it is — nothing that reads it breaks.
 */
export const PUBLIC_HEADER_CLASS = "stapel-public-shell-header";

/**
 * The class the SCROLLED CHIP ROW carries — see
 * {@link PublicShellProps.scrolledChipRow}.
 *
 * Everything about that row that cannot be written inline is written against
 * this class: the collapse (a grid row that goes from `0fr` to `1fr`, which is
 * the one way to transition to a height nobody has measured), the transition
 * itself, the media query that keeps it to coarse pointers, and the pin under
 * the header wherever {@link HEADER_HEIGHT_VAR} is declared.
 */
export const PUBLIC_CHIPS_CLASS = "stapel-public-shell-chips";

/** The `href` the hoisted shell sheet is deduplicated by (React 19). */
export const PUBLIC_SHELL_STYLE_HREF = "stapel-public-shell";

/**
 * The custom property `<PublicShell/>` publishes its header height on.
 *
 * Not a `@stapel/tokens` role and deliberately not run through `cssVar`: it is
 * a fact about THIS component's chrome, not a design token, and it is declared
 * on the shell's own root rather than on `:root` so two shells on one page
 * cannot fight over it.
 */
export const HEADER_HEIGHT_VAR = "--stapel-header-height";

/**
 * The shell's root sheet: the header height as a custom property, switched by
 * a MEDIA QUERY rather than by a render.
 *
 * Why a sheet and not an inline `style`: an inline value is computed at render
 * from `useBreakpoint()`, and a host's sticky box then reads the height of the
 * chrome the shell drew for the LAST render it did. The media query is the
 * same edge (`breakpoints.desktop`) evaluated by the engine on every reflow,
 * so a window dragged across 1200px moves the rail and the header together.
 *
 * The phone rung is declared only for `phoneChrome="dock"`, and that is the
 * honest half: in `"drawer"` the phone header wraps to a second line for the
 * search field and has no fixed height at all, so the property stays
 * UNDECLARED there and a host's `var(--stapel-header-height, 56px)` falls back
 * to its own answer instead of being told a wrong one.
 *
 * ── Why the dock rung is wrapped in `:where()` (D449) ─────────────────────
 *
 * A media query adds NO specificity. `.stapel-public-shell[data-phone-chrome=
 * "dock"]` is (0,2,0) and `.stapel-public-shell` inside
 * `@media (min-width:1200px)` is (0,1,0), so on a 1440px desktop running the
 * dock chrome the phone rung won the cascade and the property resolved to
 * 56px under a 64px header. Both sticky things on the page read it, so the
 * filter rail and the results toolbar pinned 8px UNDER the header — measured
 * as `hiddenPx: 8` on `/s` and `/c` at 1440 and 1280.
 *
 * `:where()` contributes zero specificity, so the dock arm is (0,1,0) too and
 * the two rungs are decided by ORDER — the desktop arm is declared last and
 * wins above the breakpoint, on every phone-chrome value, with no `!important`
 * and no restated selector. The order is therefore load-bearing, which is why
 * `headerGeometry.test.tsx` asserts it structurally rather than by reading a
 * computed value jsdom cannot resolve.
 *
 * ── The pinned header's own SEAM (D458) ───────────────────────────────────
 *
 * At a FRACTIONAL scroll offset a one-pixel row of the page showed above the
 * pinned header — reproduced by the owner, and the stand's frame-synced scan
 * says the header itself does not move (`top` 0 and a constant height at every
 * integer step from 0 to 300, at 1570 and at 390). It is not a layout fault:
 * the sticky box and the content under it snap to device pixels
 * INDEPENDENTLY, so at 0.5px there is a device row belonging to neither.
 *
 * Two paints answer it, and both belong to whoever writes `position: sticky`:
 *
 *  1. THE HEADER PAINTS ONE PIXEL ABOVE ITS OWN BOX. A `::before` at
 *     `inset-block-start: -1px`, `background: inherit` — the header's own
 *     resolved background, so there is no second colour to go wrong on the day
 *     a skin changes, on either theme or brand. Absolutely positioned, out of
 *     flow, so it is not a flex item of the header's row and costs
 *     {@link HEADER_HEIGHT_VAR} nothing — which matters, because a filter
 *     rail, a results toolbar, a chip row and a condensed top bar all pin
 *     against that number.
 *  2. OPTIONALLY, THE HEADER GETS ITS OWN COMPOSITING LAYER —
 *     `will-change: transform`, which asks the engine to pin it at integer
 *     device pixels instead of re-rasterising it against a fractional offset
 *     every frame. `will-change` and not an actual `transform`: a transform
 *     would also make the header a containing block for every
 *     `position: fixed` descendant, and the promotion is the whole of what
 *     would be wanted.
 *
 *     IT IS OFF BY DEFAULT, and that is a measurement rather than a taste.
 *     On the owner's own Chrome — headed, dark theme, a listing page — a
 *     screenshot at ~30px of scroll shows the header VISUALLY ABSENT while the
 *     DOM says `top: 0`, height 56, opaque, `z-index: 1000`. Reproduced three
 *     times; no headless probe ever saw it. The suspect is exactly this
 *     promotion: a sticky element handed its own layer, composited wrong by
 *     some builds. Trading a one-pixel seam for a header that is not there is
 *     not a trade, and the seam is closed by the strip alone — the strip is
 *     what paints the missing row, and the layer only ever made the rounding
 *     less likely to happen in the first place. See
 *     {@link PublicShellProps.headerLayer} for the way back in.
 *
 * The strip is hung on `[data-sticky="true"]`, because an unpinned header has
 * no seam to paint; the promotion needs `[data-layer="true"]` as well, which
 * is the prop.
 *
 * The `box-shadow` TRANSITION is the third rule and belongs to the same
 * paragraph. {@link PublicShellProps.headerScrollFlag} is what a brand hangs a
 * hairline on, and a flag that flips is a shadow that appears; 120ms makes a
 * crossing read as a crossing rather than as a strobe. The shadow itself is
 * still the host's — this transitions whatever the host declared, and declares
 * none. Under `prefers-reduced-motion: reduce` there is no transition at all.
 *
 * Nothing here uses `!important` and nothing restates a value the header
 * writes inline: `top: 0` is an inline declaration, which no sheet rule of
 * ours could beat anyway, and paint needs no override.
 */
export function publicShellCss(): string {
  const shell = `.${PUBLIC_SHELL_CLASS}`;
  const header = `.${PUBLIC_HEADER_CLASS}[data-sticky="true"]`;
  const chips = `.${PUBLIC_CHIPS_CLASS}`;
  return [
    `${shell}:where([data-phone-chrome="dock"]){${HEADER_HEIGHT_VAR}:${String(HEADER_HEIGHT_PHONE)}px}`,
    `@media (min-width:${String(breakpoints.desktop)}px){` +
      `${shell}{${HEADER_HEIGHT_VAR}:${String(HEADER_HEIGHT_DESKTOP)}px}}`,
    // ── The scrolled chip row ────────────────────────────────────────────────
    //
    // A GRID ROW, not a height. The row holds a host's chips and nobody knows
    // how tall they are — `max-height: 999px` is the trick that makes a
    // collapse take 400ms of nothing first — so the collapse is
    // `grid-template-rows: 0fr -> 1fr`, which animates to the content's OWN
    // height with no number in it. The child needs `min-block-size: 0` or the
    // grid refuses to shrink it below its content.
    //
    // Hidden means HIDDEN. `visibility` (transitioned as a discrete property,
    // so it flips at the end of the collapse and at the start of the reveal)
    // is what keeps a collapsed row out of the tab order and off a screen
    // reader — a `0fr` row with `overflow: hidden` is still focusable content
    // at zero height, which is how a keyboard walk ends up inside a strip
    // nobody can see.
    `${chips}{display:grid;grid-template-rows:0fr;opacity:0;visibility:hidden;` +
      `transition:grid-template-rows 160ms ease-out,opacity 160ms ease-out,` +
      `visibility 160ms}`,
    `${chips}>*{min-block-size:0;overflow:hidden}`,
    `${chips}[data-scrolled="true"]{grid-template-rows:1fr;opacity:1;` +
      `visibility:visible}`,
    // COARSE POINTERS ONLY, and the rule is a media query rather than a
    // render: the row exists because a thumb has no browse bar to go back to,
    // and a desktop already carries the categories in one. A width test would
    // be the wrong question — a 1280px tablet is the device this is for.
    `@media (pointer:fine){${chips}{display:none}}`,
    // Pinned under the header exactly where the header's height is a number —
    // the same two rungs that declare it above, in the same order, so a desk
    // width wins over the dock rung the way the height itself does. Where the
    // property is undeclared (a phone in `"drawer"`, whose header wraps to a
    // second line and is `height: auto`) the row scrolls with the page rather
    // than pinning at an offset nobody computed.
    `${shell}:where([data-phone-chrome="dock"]) ${chips}[data-sticky="true"]` +
      `{position:sticky;inset-block-start:var(${HEADER_HEIGHT_VAR})}`,
    `@media (min-width:${String(breakpoints.desktop)}px){` +
      `${shell} ${chips}[data-sticky="true"]` +
      `{position:sticky;inset-block-start:var(${HEADER_HEIGHT_VAR})}}`,
    `@media (prefers-reduced-motion:reduce){${chips}{transition:none}}`,
    `${header}{transition:box-shadow 120ms ease-out}`,
    `${header}::before{content:"";position:absolute;inset-inline:0;` +
      `inset-block-start:-1px;block-size:1px;background:inherit;` +
      `pointer-events:none}`,
    // OPT-IN, and only ever under the pin — see this function's header and
    // `headerLayer`. A header that vanished on the owner's own Chrome is what
    // took this off the default path.
    `${header}[data-layer="true"]{will-change:transform}`,
    `@media (prefers-reduced-motion:reduce){${header}{transition:none}}`,
  ].join("\n");
}

/**
 * The scroll sentinel: the head of the document, given straight back.
 *
 * A pinned header wants an edge only when there is something behind it, and
 * CSS cannot yet ask "is this box currently stuck". The alternative every host
 * writes is a `scroll` listener, which runs on every frame of a feed of
 * photographs; `IntersectionObserver` on one box answers the same question and
 * costs nothing while nobody scrolls.
 *
 * The height is TAKEN AND GIVEN STRAIGHT BACK (`margin-block-end` is its
 * negation): the box has to have a height for the observer to have something
 * to observe, and it may not have one for the page, or the sentinel is itself
 * the shift the mechanism exists to avoid.
 *
 * This is the smallest it is ever drawn — the floor under
 * {@link HeaderScrollThresholds.on}, and the whole of it when a host asks for
 * the old single-edge behaviour with `{ on: 0, off: 0 }`.
 */
export const SCROLL_SENTINEL_HEIGHT = 1;

/**
 * The two edges of {@link PublicShellProps.headerScrollFlag}: how far the page
 * must move for the flag to come ON, and how far back it must come for the
 * flag to go OFF again.
 *
 * They are DIFFERENT numbers on purpose — see
 * {@link DEFAULT_HEADER_SCROLL_THRESHOLDS}.
 */
export interface HeaderScrollThresholds {
  /** Scrolled at least this many px: `data-scrolled="true"`. */
  readonly on: number;
  /** Back to this many px or fewer: `data-scrolled="false"`. */
  readonly off: number;
}

/**
 * What `headerScrollFlag` means, and why one number was not enough (D459).
 *
 * The flag used to flip at a single 1px edge, which is a THRESHOLD and not a
 * hysteresis: a trackpad's rubber-band around the top of a page crosses 0–3px
 * over and over in one gesture, and the header's hairline strobed with it —
 * the fleet's storefront was fading its shadow over 120ms so that a crossing
 * would at least read as a crossing.
 *
 * Two edges instead. The flag comes on once the page has genuinely moved
 * (8px — past the rubber band, under a line of text) and goes off only at the
 * very top, where the header has nothing behind it and demonstrably needs no
 * edge. Nothing in between changes anything, which is what a rubber band is.
 *
 * `{ on: 0, off: 0 }` is the pre-0.16 behaviour exactly: one edge at the
 * document's first pixel.
 */
export const DEFAULT_HEADER_SCROLL_THRESHOLDS: HeaderScrollThresholds = {
  on: 8,
  off: 0,
};

/**
 * The thresholds a `headerScrollFlag` value asks for, normalised.
 *
 * `off` cannot be negative (there is no scroll position below the top of a
 * document to come back to) and `on` cannot be under `off`, or the two edges
 * cross and the pair stops being a hysteresis at all. Both are floored to
 * whole pixels: the sentinel's height is one of them, and a fractional box is
 * the very rounding this mechanism is being made robust against.
 */
export function headerScrollThresholds(
  flag: boolean | HeaderScrollThresholds | undefined
): HeaderScrollThresholds | null {
  if (flag === undefined || flag === false) return null;
  if (flag === true) return DEFAULT_HEADER_SCROLL_THRESHOLDS;
  const off = Math.max(0, Math.floor(flag.off));
  return { off, on: Math.max(off, Math.floor(flag.on)) };
}

/**
 * The sentinel's box for a given pair of edges.
 *
 * Its height is the ON edge (never under {@link SCROLL_SENTINEL_HEIGHT}: a
 * zero-area box is not reliably reported as intersecting anything), and its
 * negative bottom margin gives every pixel of that back to the page.
 */
function scrollSentinelStyle(on: number): CSSProperties {
  const height = Math.max(on, SCROLL_SENTINEL_HEIGHT);
  return {
    blockSize: height,
    marginBlockEnd: -height,
    pointerEvents: "none",
  };
}

/**
 * The OFF observer's `rootMargin`, so that ONE sentinel answers both edges.
 *
 * The sentinel spans `0…H` in the document, so in viewport coordinates its
 * bottom sits at `H - scrollY`. An observer whose root's top edge has been
 * moved to `H - off - 1` therefore reports it as intersecting exactly while
 * `H - scrollY > H - off - 1`, i.e. while `scrollY <= off`. The ON edge is the
 * same box with no margin at all: it stops intersecting at `scrollY >= H`.
 *
 * Two observers on one element rather than two elements: the sentinel is a
 * position in the page, and a page should not grow a second one because the
 * flag grew a second edge.
 */
function offRootMargin(on: number, off: number): string {
  const height = Math.max(on, SCROLL_SENTINEL_HEIGHT);
  return `${String(-(height - off - 1))}px 0px 0px 0px`;
}

const DRAWER_WIDTH = "min(20rem, 86vw)";

export interface PublicShellProps {
  /** Already-resolved nav — the output of `resolvePublicNav` /
   * `resolveMemberNav` (or `resolveNav` with an explicit `audience`).
   * `PublicShell` renders it as-is; it never resolves nav itself, and it
   * never filters by surface a second time. */
  readonly nav: readonly ResolvedNavEntry[];
  /**
   * Pin the theme to one side. Omitted — the normal case — the storefront
   * follows the document's live `data-theme` through `SkinTheme`, so a
   * runtime theme flip moves the chrome with everything else. Never
   * defaulted to `"light"`: a hardcoded side is a wrong answer on every dark
   * deployment.
   */
  readonly mode?: ThemeMode;
  /** Brand slot at the head of the top bar — conventionally the logo, already
   * wrapped by the host in its own link to `/` (the shell does not wrap it,
   * which would nest one anchor inside another).
   *
   * Omitted BELOW a `<SiteProvider>` (`@stapel/core`), `<SiteBrand/>` draws
   * the host-resolved wordmark — which is the whole point of the multibrand
   * seam: one container, two domains, and neither of them carrying the
   * other's name. With no provider above, omitting it renders no brand at
   * all, exactly as before. */
  readonly brand?: ReactNode;
  /** The search field in the top bar. Host-provided: what a storefront
   * searches, and where the query goes, is product knowledge. */
  readonly searchSlot?: ReactNode;
  /** The category strip under the top bar. Collapses into the phone `Drawer`
   * together with the nav menu. */
  readonly categorySlot?: ReactNode;
  /** The sign-in CTA, or a signed-in person's account menu. Omitted, a
   * sign-in link renders anyway — see rule 2 in this module's header. */
  readonly accountSlot?: ReactNode;
  /** The footer's content. Omitted below a `<SiteProvider>` whose brand
   * carries `legal`, `<SiteLegalFooter/>` states the operating company, the
   * support mailbox and the privacy/terms links of THIS host. */
  readonly footer?: ReactNode;
  /**
   * How wide the routed content is allowed to get, in px, centred in the
   * viewport. Default 1280; `false` is edge-to-edge for a page that draws its
   * own full-bleed sections (a landing page, a map).
   *
   * `Layout.Content` carried one spacing step and nothing else, so a
   * detail page's prose ran the full width of a 2560px monitor — a line
   * length nobody reads. The chrome above it stays full-bleed on purpose: a
   * top bar that stops short of the window edges reads as a broken page, not
   * as a measure.
   */
  readonly contentMaxWidth?: number | false;
  /**
   * The floating bottom dock (`<NavDock/>`), ON below the desktop breakpoint.
   *
   * Default skins ARE the product (§83): a storefront's phone chrome is a
   * dock, and a pair that made it opt-in would ship every deployment the
   * hamburger-only frame the dock exists to replace. `false` switches it off
   * for a host whose own chrome already owns the bottom edge — a map screen, a
   * checkout, a native shell hosting the page in a webview.
   *
   * WHICH destinations it holds is not a second decision: the dock takes the
   * first five entries of the same resolved nav the menu renders, in the order
   * `stapel.nav.json` already declares. See `<NavDock/>`.
   */
  readonly dock?: boolean;
  /**
   * Which chrome this storefront wears BELOW the desktop breakpoint. Desktop
   * is untouched either way — this prop has no effect there at all.
   *
   *  - `"drawer"` (default, and byte-identical to every release before this
   *    prop existed): a hamburger opens the nav sheet, and the header takes a
   *    second line for the search field.
   *  - `"dock"`: no hamburger, no sheet, no second header line. The header is
   *    ONE sticky row — the search field, stretched, and the account control
   *    at its end — and the `<NavDock/>` under the thumb is the whole
   *    navigation. The brand is not drawn on a phone in this mode: identity
   *    and navigation both live in the dock, and a 390px row that carries a
   *    wordmark cannot also carry a search field worth typing into.
   *
   * The footer still renders in both. A storefront's legal links are the one
   * thing that must stay reachable from every screen, and "clean" is not a
   * reason to make privacy and terms unreachable on the device most people
   * read them on.
   *
   * `dock={false}` alongside `"dock"` leaves a phone with no navigation at
   * all. That combination is not defended against, because it is a legible
   * statement: a host that switched the island off has said its own chrome
   * owns the bottom edge, and it owns what is in it.
   *
   * ── What `"dock"` gives up, stated rather than discovered ─────────────────
   *
   * The phone's theme switch lives in the foot of the nav sheet, so removing
   * the sheet removes it: in `"dock"` mode there is NO theme control on a
   * phone. That is accepted, not overlooked. A boot-time `system` follow
   * already puts an anonymous visitor on the right side of the theme without
   * anyone choosing anything, and the choice itself belongs on the account or
   * profile surface a host owns — where `<ShellThemeControl/>` is a single
   * import away. What is not acceptable is putting a three-target appearance
   * control on the one row a storefront's search field lives on.
   */
  readonly phoneChrome?: "drawer" | "dock";
  /**
   * Does the header STAY at the top of the window while the page scrolls?
   *
   * DEFAULT `true` — both sides — and the default is the fix.
   *
   * It used to be "sticky in `phoneChrome="dock"` and nowhere else", which was
   * an inconsistency inside one app before it was a gap against anything else:
   * the same storefront pinned on a phone and `static` on a desktop. Measured
   * against the reference classified (§24, Surface 3, ranked first), whose
   * header is pinned on both, and the consequence is not cosmetic — the header
   * IS the search field, so a desktop header that scrolls away turns "search
   * again" into "scroll back to the top first" from anywhere down a feed. The
   * only way a host could settle it was a sheet rule over
   * `[data-testid="public-shell-header"]`, i.e. a geometry decision taken
   * outside the component that owns the geometry. Default skins are the
   * product (§83): a storefront should not have to opt into the behaviour
   * every storefront has.
   *
   * NOTHING MOVES WHEN IT PINS. `position: sticky` leaves the box in flow, so
   * the header still occupies the row it occupied and no content shifts under
   * it — which is why this is a default change and not a layout change. The
   * height that row is worth is published as {@link HEADER_HEIGHT_VAR} for the
   * two pairs that pin against it.
   *
   *  - `"desktop"` — sticky at and above `breakpoints.desktop`, and NOT below.
   *  - `"phone"` — sticky below it (what `"dock"` already did), and not on a
   *    desktop.
   *  - `true` — both (the default). `false` — neither, including the dock
   *    chrome's, for a host whose own chrome owns the top edge.
   *
   * Sticky brings its own two declarations with it: the header's `background`
   * is the theme's container token (content passing under it is covered on
   * both sides of the theme) and its layer is `zIndexPopupBase`, the one
   * `<NavDock/>` floats on and antd's own popups sit above — so a select
   * inside `searchSlot` still opens over the header.
   *
   * A pinned header is a height everything else on the page has to know:
   * {@link HEADER_HEIGHT_VAR} is published on the shell's root for exactly
   * that, and `<SearchPage railTop>` / `<SearchResultsPane stickyToolbar>` in
   * `@stapel/search-react` are the two pairs that read it.
   */
  readonly headerSticky?: boolean | "desktop" | "phone";
  /**
   * Give the PINNED header its own compositing layer
   * (`will-change: transform`). Default `false`, and the default is a
   * measurement.
   *
   * The promotion asks the engine to pin the header at integer device pixels
   * instead of re-rasterising it against a fractional scroll offset, which is
   * the second half of the answer to the one-pixel seam (D458) — the first
   * half, the `::before` strip, is unconditional and is what actually paints
   * the missing row.
   *
   * ── Why it is off ─────────────────────────────────────────────────────────
   *
   * On the owner's own Chrome — headed, dark theme, a listing page — a
   * screenshot at ~30px of scroll shows the header VISUALLY ABSENT while the
   * DOM says `top: 0`, height 56, opaque, `z-index: 1000`. Reproduced three
   * times, and no headless probe ever saw it: the suspect is a sticky element
   * handed its own layer and composited wrong by that build. A header that is
   * not there is a worse defect than a hairline, so the promotion is a thing a
   * deployment turns on after looking at it on the browsers it actually
   * serves — never something a version bump does to somebody's storefront.
   *
   * `true` writes `data-layer="true"` on the header, which is what the sheet's
   * rule is gated on. It has no effect on an unpinned header: there is no seam
   * to smooth and no reason to hold a layer.
   */
  readonly headerLayer?: boolean;
  /**
   * Mark the header once the page has moved: `data-scrolled="true" | "false"`.
   *
   * Opt-in and purely a HOOK — the shell draws nothing differently for it. A
   * pinned header wants a hairline or a shadow only when there is content
   * behind it, and that is a brand decision (`box-shadow`, a border, a blur),
   * so what the pair owns is the fact and not the paint:
   *
   * ```css
   * [data-testid="public-shell-header"][data-scrolled="true"] {
   *   box-shadow: var(--stapel-elevation-low);
   * }
   * ```
   *
   * The fact comes from `IntersectionObserver` on ONE sentinel the shell
   * renders above its own header — never a `scroll` listener, which runs on
   * every frame of a feed of photographs. The sentinel takes its height and
   * gives it straight back (`margin-block-end` is its negation), so it is a
   * position in the page and never a change to it.
   *
   * ── TWO edges, not one (D459) ─────────────────────────────────────────────
   *
   * `true` is a PAIR of thresholds — {@link DEFAULT_HEADER_SCROLL_THRESHOLDS},
   * `{ on: 8, off: 0 }` — and not the single 1px edge it used to be. One edge
   * is a threshold, and a trackpad's rubber-band around the top of a page
   * crosses one of those repeatedly inside a single gesture: the flag strobed,
   * and with it whatever a brand hung on it. Pass your own
   * {@link HeaderScrollThresholds} to move the edges; `{ on: 0, off: 0 }` is
   * the old behaviour exactly.
   *
   * Off, the attribute is absent entirely rather than `"false"`: a host that
   * did not ask for the observer should not be able to write a rule that
   * silently never fires.
   */
  readonly headerScrollFlag?: boolean | HeaderScrollThresholds;
  /**
   * A strip that appears UNDER THE HEADER once the page has moved — the
   * host's category chips, on a phone.
   *
   * ── The gap ───────────────────────────────────────────────────────────────
   *
   * The reference classified's phone home keeps a horizontal category row
   * pinned under its search bar from the moment a reader scrolls (§24, Surface
   * 3); ours had none at all. That is not decoration on a storefront whose
   * phone chrome is one row: the browse bar lives in a drawer or in the dock,
   * so a thumb halfway down a feed has no way to change category without
   * scrolling back to the top first — exactly the move a pinned header exists
   * to spare it.
   *
   * ── What the shell owns, and what it does not ─────────────────────────────
   *
   * WHICH chips, in what order, and where they lead is product knowledge, so
   * this is a slot and not a built-in strip — the same rule `categorySlot`
   * follows one bar up. What the shell owns is WHEN it is on screen and WHERE
   * it sits:
   *
   *  - WHEN: the same scroll fact `headerScrollFlag` publishes, from the same
   *    single `IntersectionObserver` sentinel — never a `scroll` listener,
   *    which runs on every frame of a feed of photographs. Passing this slot
   *    turns the observer on by itself, with
   *    {@link DEFAULT_HEADER_SCROLL_THRESHOLDS}'s two edges, so a rubber-band
   *    at the top of the page cannot make the strip flicker; a host that also
   *    passes `headerScrollFlag` keeps its own edges for both.
   *  - WHERE: below the header, pinned under it wherever the shell publishes
   *    {@link HEADER_HEIGHT_VAR} (a desktop width, or a phone in
   *    `phoneChrome="dock"`). It is never inside the header, which would make
   *    the published height a lie the two pairs pinning against it would
   *    inherit.
   *
   * ── Coarse pointers only ──────────────────────────────────────────────────
   *
   * A desktop carries the same destinations in the browse bar under the
   * header, permanently; a second row of them appearing on scroll would be
   * chrome competing with chrome. The rule is `@media (pointer: fine)` in the
   * shell's own sheet rather than a width test, because the device this is for
   * is "a thumb", and a 1280px tablet is one.
   *
   * It collapses rather than unmounting — a grid row from `0fr` to the
   * content's own height, 160ms, none at all under
   * `prefers-reduced-motion: reduce` — and a collapsed strip is
   * `visibility: hidden`, so it is out of the tab order and off a screen
   * reader instead of being focusable content at zero height.
   */
  readonly scrolledChipRow?: ReactNode;
  /**
   * Draw the header's HOME affordance in `phoneChrome="dock"`. Default `true`.
   *
   * The brand mark at glyph size, linking to `/`, at the head of the phone
   * header row — the corner every storefront puts it in, and the only route
   * home a docked phone chrome had. It replaces nothing: the wordmark is still
   * absent (the row cannot hold one), the search field still dominates, and a
   * host's own leading control (a history back arrow, say) sits beside it
   * rather than instead of it.
   *
   * `false` for a host whose own chrome already owns that corner. Desktop and
   * `"drawer"` are untouched either way — both draw the full wordmark, which
   * is already a link home.
   */
  readonly home?: boolean;
  /**
   * Counts to mark nav destinations with, keyed by `ResolvedNavEntry.id` —
   * unread messages, pending offers. THE canonical badge channel: the count
   * is rendered wherever the entry is rendered — the dock, the nav sheet, the
   * top bar's menu — so a fact the chrome knows is not said by one surface
   * and swallowed by the others.
   *
   * A SLOT: how many of anything is waiting belongs to the module that owns
   * the thing, and the shell depends on no module. Absent or `0` draws no
   * badge.
   */
  readonly navBadges?: Readonly<Record<string, number>>;
  /**
   * The dock-only badge input, kept working unchanged.
   *
   * It predates {@link PublicShellProps.navBadges} and says less: a count
   * passed here marks the dock and nothing else, which on a desktop — where
   * there is no dock — is a count nobody sees. Prefer `navBadges`. Where both
   * name the same entry the narrower input wins for the dock, because a host
   * that spelled out a dock-specific number meant the dock.
   */
  readonly dockBadges?: Readonly<Record<string, number>>;
  /**
   * The theme switch (`<ShellThemeControl/>`), ON by default — at the end of
   * the header's account area on a desktop, in the foot of the nav sheet on a
   * phone. Since 0.14.0 it is the COMPACT icon button: the three-label
   * segmented control it used to be is a SETTING, and it stood in the first
   * row of every desktop page (hosts answered by switching this off and
   * rebuilding a home for it). The placement here has not moved — only the
   * shape of the thing in it. `variant="settings"` is a host's to mount on
   * its own appearance screen.
   *
   * Default skins ARE the product (§83). Both brands' token files have carried
   * a `[data-theme="dark"]` block for two waves and no storefront had a
   * control that could reach it, because the mechanism shipped without a
   * place. `false` is for a host whose own settings screen owns the choice.
   *
   * The phone placement IS the nav sheet, so `phoneChrome="dock"` — which has
   * no sheet — has no phone theme control. See that prop for why that is an
   * accepted trade and what covers it.
   */
  readonly themeControl?: boolean;
  /**
   * Where a route LANDS. Default `true`, and the default is the fix.
   *
   * A single-page app changes the address without loading a document, so
   * nothing moves the viewport: a card tapped two thousand pixels down a feed
   * opened a listing already scrolled past its own photographs. On a PUSH to
   * another page the shell now lands at the top; on a POP it restores the
   * offset that entry was left at, so Back returns a feed to the reader's
   * place in it; a hash target and a query-only change (a chip, a tab,
   * `?step=`) are both left alone. `useRouteScrollReset` states the whole
   * rule and argues each of the four cases.
   *
   * ON by default because the alternative is a storefront that is broken
   * until somebody notices — a chrome that owns the `<Outlet/>` and does not
   * place what it renders has left the one job only it can do.
   *
   * `false` for a host that mounts react-router's own `<ScrollRestoration/>`,
   * or one whose pages place themselves. The two must not both run: this hook
   * takes `history.scrollRestoration` for as long as it is mounted, and so
   * does react-router's component.
   */
  readonly scrollRestoration?: boolean;
}

/** The default `accountSlot`: the entry point that must never be absent. */
function SignInCta(): ReactElement {
  const t = useT();
  return (
    <Link to={SIGN_IN_PATH} data-testid="public-shell-sign-in">
      <Button type="primary">{t(SHELL_I18N_KEYS.publicSignIn)}</Button>
    </Link>
  );
}

/** Public storefront chrome: top bar + optional browse bar + `<Outlet/>`. */
export function PublicShell(props: PublicShellProps): ReactElement {
  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface="base"
      style={{ minHeight: "100vh" }}
    >
      <PublicChrome {...props} />
    </SkinTheme>
  );
}

/**
 * The chrome itself, drawn INSIDE the theme — see `AppShell`'s `AppChrome`
 * for why the token bag has to be read on this side of the provider.
 */
function PublicChrome(props: PublicShellProps): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const contentMaxWidth = props.contentMaxWidth ?? DEFAULT_CONTENT_MAX_WIDTH;
  const breakpoint = useBreakpoint();
  const isDesktop = breakpoint === "desktop";
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Where a route lands: the top on a PUSH, where it was left on a POP, and
  // untouched for a hash or a query-only change. See `scrollRestoration`.
  useRouteScrollReset(props.scrollRestoration ?? true);

  // The decluttered phone chrome, and ONLY below the desktop breakpoint: the
  // prop describes a phone, and a desktop that changed shape because of it
  // would be this component quietly growing a second layout axis.
  const dockChrome = !isDesktop && props.phoneChrome === "dock";

  /*
   * ── Is the header pinned? ─────────────────────────────────────────────────
   *
   * BOTH SIDES unless a host says otherwise — see `headerSticky`, where the
   * measurement behind the default is. Everything below the first arm is the
   * host naming a side of the desktop edge.
   */
  const stickyHeader =
    props.headerSticky === undefined
      ? true
      : props.headerSticky === "desktop"
        ? isDesktop
        : props.headerSticky === "phone"
          ? !isDesktop
          : props.headerSticky;

  // The scroll flag: two observers on ONE box, and only when asked for. The
  // thresholds are read out of the prop here so the effect below depends on
  // two numbers rather than on an object literal a host re-creates every
  // render — which would tear the observers down and build them up again on
  // every parent render, and re-fire the flag with them.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  /*
   * TWO READERS OF ONE FACT, and only one of them is a prop.
   *
   * `headerScrollFlag` asks for the ATTRIBUTE — `data-scrolled` on the header,
   * a hook a brand hangs a hairline on — and `flagAsked` is that request. The
   * chip row reads the same fact to know whether it is on screen, so asking
   * for a chip row asks for the OBSERVER: a slot that silently needed a second
   * prop switched on would be a strip that never appears with nothing on
   * screen saying why.
   *
   * A host that named its own edges keeps them for both — there is one fact
   * here, and two sets of thresholds for it would be two answers to "has the
   * page moved". A host that said `headerScrollFlag={false}` and passed a chip
   * row gets the row and no attribute, which is exactly what it asked for.
   */
  const flagAsked = headerScrollThresholds(props.headerScrollFlag);
  const chipRow = props.scrolledChipRow;
  const thresholds =
    flagAsked ??
    (chipRow !== undefined ? DEFAULT_HEADER_SCROLL_THRESHOLDS : null);
  const scrollFlag = thresholds !== null;
  const flagOn = thresholds?.on ?? 0;
  const flagOff = thresholds?.off ?? 0;
  useEffect(() => {
    const node = sentinelRef.current;
    // `IntersectionObserver` is absent on a server render and in a couple of
    // test environments; a chrome must not throw out of an effect for it.
    if (!scrollFlag || node === null || typeof IntersectionObserver === "undefined") {
      return undefined;
    }
    /*
     * THE HYSTERESIS, and why each observer only ever writes one way.
     *
     * The ON observer sees the sentinel leave the viewport at `scrollY >= on`
     * and says so; the OFF observer sees it fully back at `scrollY <= off`
     * (its root is shifted — see `offRootMargin`) and says so. NEITHER writes
     * the other's answer, so between the two edges nothing at all happens,
     * and a rubber-band that crosses one of them repeatedly cannot flip the
     * flag: it is the state MEMORY, held in `scrolled`, that answers there.
     *
     * `setScrolled` with the value it already holds is a no-op to React, so
     * the observers' own first callbacks (IO fires once on `observe`) cost
     * nothing, and a page restored mid-scroll comes up flagged.
     */
    const past = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry !== undefined && !entry.isIntersecting) setScrolled(true);
    });
    const back = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry !== undefined && entry.isIntersecting) setScrolled(false);
      },
      { rootMargin: offRootMargin(flagOn, flagOff) }
    );
    past.observe(node);
    back.observe(node);
    return () => {
      past.disconnect();
      back.disconnect();
    };
  }, [scrollFlag, flagOn, flagOff]);

  // The browse bar exists only when there is something to browse. An empty
  // strip — and, on phone, a hamburger that opens an empty sheet — is a
  // control that promises a destination it does not have.
  const hasBrowse = props.nav.length > 0 || props.categorySlot !== undefined;

  // The host→brand seam is OPTIONAL, and `useOptionalSite()` is what makes it
  // so: a host that mounts no `<SiteProvider>` gets `null` here and every
  // default below behaves exactly as it did before the seam existed. Reading
  // it with `useSite()` would make this shell THROW in those hosts — a brand
  // slot is the last thing that should be able to take a storefront down.
  const site = useOptionalSite();
  const siteLegal = site?.brand?.legal;
  const brandContent: ReactNode =
    props.brand !== undefined
      ? props.brand
      : site?.brand != null
        ? <SiteBrand />
        : undefined;
  const footerContent: ReactNode =
    props.footer !== undefined
      ? props.footer
      : siteLegal !== undefined && Object.keys(siteLegal).length > 0
        ? <SiteLegalFooter />
        : undefined;

  // The dock is a PHONE/tablet surface: on a desktop the browse bar is already
  // one click from every destination and an island floating over the content
  // would be chrome competing with chrome.
  const showDock = !isDesktop && props.dock !== false;

  /*
   * Does an island actually float over this page?
   *
   * `showDock` is the shell's INTENT; `dockRenders` is what `<NavDock>` will
   * do with the nav it is handed. They differ for a nav with fewer than two
   * top entries, and the difference used to show up as a strip of empty page
   * under a dock nobody drew. The clearance below asks the second question.
   */
  const dockFloats = showDock && dockRenders(props.nav);

  // `navBadges` is the canonical channel and `dockBadges` the dock-only one it
  // replaced, so the dock reads both and the narrower input wins on a
  // collision. Everywhere else — the sheet, the top bar's menu — only the
  // canonical one applies: `dockBadges` says "dock" in its name.
  const dockBadges: Readonly<Record<string, number>> | undefined =
    props.navBadges === undefined && props.dockBadges === undefined
      ? undefined
      : { ...props.navBadges, ...props.dockBadges };

  const navMenu =
    props.nav.length > 0 ? (
      <NavMenu
        nav={props.nav}
        mode={isDesktop ? "horizontal" : "inline"}
        testId="public-shell-menu"
        {...(props.navBadges !== undefined ? { badges: props.navBadges } : {})}
        style={{ borderInlineEnd: "none", background: "transparent" }}
        {...(isDesktop ? {} : { onNavigate: () => setDrawerOpen(false) })}
      />
    ) : null;

  // The three header slots, built once and ARRANGED differently per width. On
  // a phone the brand, the account control and a search field cannot share one
  // 390px line without each of them being unreadable, so the search takes a
  // second line of the same header rather than being dropped: a storefront
  // whose search box disappears on a phone is a storefront nobody searches.
  // In `"dock"` mode the phone header draws no brand: the row is one line and
  // the search field is what a storefront's phone header is FOR. The brand is
  // still built — the nav sheet's own header uses `brandContent` directly, and
  // the desktop row is untouched.
  const brandNode =
    brandContent !== undefined && !dockChrome ? (
      <div
        style={{ display: "flex", alignItems: "center", minWidth: 0 }}
        data-testid="public-shell-brand"
      >
        {brandContent}
      </div>
    ) : null;

  /*
   * ── The way home, on a phone ──────────────────────────────────────────────
   *
   * `"dock"` mode drops the wordmark for a good reason — a 390px row cannot
   * carry one AND a search field worth typing into — and that left the phone
   * with NO route to `/` at all: the header's leading control is a host's
   * history back arrow (which does not reach home from a deep chain or a
   * fresh entry), and the dock's tabs are wherever the nav manifest points.
   * Reported by the owner as "there is no way to navigate to the front page
   * at all", and it was exactly true.
   *
   * So the brand becomes a MARK: the logo alone at glyph size, or the house
   * where a brand has no logo, always a link to `/`. It is the affordance
   * every reference storefront puts in that corner, it costs one square of a
   * row the search field still dominates, and it is the same target in both
   * themes because it is drawn from the brand's own asset and the theme's own
   * text colour.
   *
   * `home={false}` for a host whose own chrome owns that corner. The dock is
   * not the answer to this even when it holds a home tab: a tab is a
   * destination among five, and the brand corner is where a person looks.
   */
  const brandLogo = site?.brand?.logo;
  const homeNode =
    dockChrome && props.home !== false ? (
      <Link
        to="/"
        aria-label={t(SHELL_I18N_KEYS.publicHome)}
        data-testid="public-shell-home"
        style={{
          flex: "0 0 auto",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          // Square, and inside the 44px touch floor `SkinTheme` holds every
          // other phone control to.
          inlineSize: spacing[6],
          blockSize: spacing[6],
          color: token.colorText,
        }}
      >
        {brandLogo !== undefined && brandLogo !== "" ? (
          <img
            src={brandLogo}
            alt=""
            data-testid="public-shell-home-logo"
            style={{ maxBlockSize: spacing[5], inlineSize: "auto", display: "block" }}
          />
        ) : (
          <HomeGlyph />
        )}
      </Link>
    ) : null;

  const searchNode =
    props.searchSlot !== undefined ? (
      <div
        style={
          isDesktop || dockChrome
            ? // Dominant: on a phone in dock mode the search field IS the
              // header, and every other row it used to share space with has
              // moved into the dock.
              { flex: "1 1 auto", minWidth: 0 }
            : { flex: "0 0 auto", width: "100%", minWidth: 0 }
        }
        data-testid="public-shell-search"
      >
        {props.searchSlot}
      </div>
    ) : null;

  const themeControl = props.themeControl !== false;

  // Desktop: the switch is the LAST thing in the account area — after the
  // sign-in CTA or the host's account menu, which is the row a person already
  // scans for "things about me". On a phone it is not here at all: the 390px
  // header line holds a hamburger, a brand and an account control, and a
  // fourth control three targets wide would push one of those off the row.
  const accountNode = (
    <div
      style={{
        marginInlineStart:
          (isDesktop || dockChrome) && props.searchSlot !== undefined ? 0 : "auto",
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        gap: spacing[3],
      }}
      data-testid="public-shell-account"
    >
      {props.accountSlot ?? <SignInCta />}
      {isDesktop && themeControl && (
        <div data-testid="public-shell-theme">
          <ShellThemeControl />
        </div>
      )}
    </div>
  );

  const menuTrigger =
    !isDesktop && !dockChrome && hasBrowse ? (
      <Button
        type="text"
        aria-label={t(SHELL_I18N_KEYS.navOpenMenu)}
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
        icon={<MenuGlyph />}
        data-testid="public-shell-menu-trigger"
        data-analytics="none"
        data-analytics-reason="local-ui-open-nav-drawer"
      />
    ) : null;

  return (
    <Layout
      /*
       * ── Why the dock's clearance is on the PAGE COLUMN, not on the content ──
       *
       * The island is `position: fixed` over the LAST thing on the page, and
       * the last thing on the page is not always the content: this shell draws
       * a footer under it, and a host can draw more. Reserving the room on
       * `<Layout.Content>` cleared the final card and left the footer's last
       * rows — the legal links, the ranking-disclosure sentence — permanently
       * under the island, readable only by knowing they were there. The
       * reservation belongs to whatever the island can reach, which is the
       * whole column.
       *
       * `box-sizing: border-box` keeps `100vh` meaning the viewport: the
       * padding is spent INSIDE the minimum height, so a short page still does
       * not scroll.
       */
      className={PUBLIC_SHELL_CLASS}
      /* The chrome as DECLARED, so the sheet's media query can decide where it
         applies. (The header below carries the same attribute resolved for the
         width actually being drawn — the two answers agree wherever both are
         defined.) */
      data-phone-chrome={props.phoneChrome ?? "drawer"}
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        ...(dockFloats ? { paddingBottom: DOCK_CLEARANCE } : {}),
      }}
      data-testid="public-shell"
    >
      {/* The header height as a custom property, hoisted and deduped by
          `href` — see `publicShellCss`. */}
      <style href={PUBLIC_SHELL_STYLE_HREF} precedence="default">
        {publicShellCss()}
      </style>
      {scrollFlag && (
        <div
          ref={sentinelRef}
          style={scrollSentinelStyle(flagOn)}
          aria-hidden="true"
          data-testid="public-shell-scroll-sentinel"
          /* The edges the box is drawn for, so a stand can read the
             hysteresis off the page rather than off this source. */
          data-scroll-on={String(flagOn)}
          data-scroll-off={String(flagOff)}
        />
      )}
      <Layout.Header
        className={PUBLIC_HEADER_CLASS}
        data-testid="public-shell-header"
        data-phone-chrome={isDesktop ? undefined : dockChrome ? "dock" : "drawer"}
        /* What the sheet's seam rules are gated on — see `publicShellCss`.
           Resolved for the width being drawn, like `data-phone-chrome` above:
           an unpinned header has no seam to paint. */
        data-sticky={stickyHeader ? "true" : "false"}
        /* The compositing layer is OPT-IN — see `headerLayer`. Absent rather
           than `"false"`: nothing may match on it by accident. */
        data-layer={props.headerLayer === true ? "true" : undefined}
        data-scrolled={flagAsked !== null ? (scrolled ? "true" : "false") : undefined}
        style={{
          display: "flex",
          alignItems: isDesktop || dockChrome ? "center" : "stretch",
          flexDirection: isDesktop || dockChrome ? "row" : "column",
          gap: isDesktop ? spacing[4] : dockChrome ? spacing[3] : spacing[2],
          // The side padding is the PAGE's, not the header's — see
          // `PAGE_GUTTER_CSS`. Only the block padding differs by chrome.
          padding: isDesktop
            ? `0 ${PAGE_GUTTER_CSS}`
            : dockChrome
              ? `0 ${PAGE_GUTTER_CSS}`
              : `${String(spacing[2])}px ${PAGE_GUTTER_CSS}`,
          height: isDesktop
            ? HEADER_HEIGHT_DESKTOP
            : dockChrome
              ? HEADER_HEIGHT_PHONE
              : "auto",
          lineHeight: 1,
          // Pinned on both sides by default, and wherever `headerSticky` says.
          // With the sheet gone the header is the only way back to search from
          // halfway down a feed, and a header that scrolls away turns "search
          // again" into "scroll to the top first". The background is the
          // theme's own container token rather than a colour, so the content
          // passing under it is covered on both sides of the theme;
          // `zIndexPopupBase` is the layer the dock already floats on, and
          // antd's own popups sit above it, so a select inside the search slot
          // still opens over the header.
          ...(stickyHeader
            ? {
                position: "sticky" as const,
                top: 0,
                zIndex: token.zIndexPopupBase,
              }
            : {}),
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorSplit}`,
        }}
      >
        {isDesktop || dockChrome ? (
          <>
            {brandNode}
            {homeNode}
            {searchNode}
            {/* Pushed to the trailing edge whether or not a search slot
                claimed the middle — the CTA's position must not depend on
                which other slots the host happened to fill. */}
            {accountNode}
          </>
        ) : (
          <>
            <Flex align="center" gap={spacing[3]}>
              {menuTrigger}
              {brandNode}
              {accountNode}
            </Flex>
            {searchNode}
          </>
        )}
      </Layout.Header>

      {/* THE SCROLLED CHIP ROW — below the header and never inside it, so the
          published header height stays the height of the header (two pairs pin
          against that number). Everything about how it appears is in the sheet
          — see `publicShellCss` and `scrolledChipRow`: the collapse, the
          coarse-pointer rule, and the pin under the header wherever the height
          is a number. Here there are only the two facts: whether the page has
          moved, and whether the header above it is pinned at all — an unpinned
          header has nothing for this row to pin under. */}
      {chipRow !== undefined && (
        <div
          className={PUBLIC_CHIPS_CLASS}
          data-testid="public-shell-chip-row"
          data-scrolled={scrolled ? "true" : "false"}
          data-sticky={stickyHeader ? "true" : "false"}
          style={{
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorSplit}`,
            // Under the header, over the page that slides beneath it. The
            // header keeps `zIndexPopupBase` and is earlier in the DOM, so one
            // step down is what keeps the two in the order they are drawn in
            // while still clearing the content that comes after.
            zIndex: token.zIndexPopupBase - 1,
          }}
        >
          <div style={{ padding: `${String(spacing[2])}px ${PAGE_GUTTER_CSS}` }}>
            {chipRow}
          </div>
        </div>
      )}

      {isDesktop && hasBrowse && (
        <Flex
          align="center"
          gap={spacing[5]}
          wrap
          style={{
            padding: `0 ${String(spacing[4])}px`,
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorSplit}`,
          }}
          data-testid="public-shell-browse"
        >
          {/* Categories FIRST, tabs after them. The menu is the greedy child
              (see below), so with the strip behind it the strip was pinned to
              the far right of a 2560px window while the tabs sat at the far
              left — two halves of one browse bar, a screen apart, and nothing
              broken enough for anyone to file. Reading order now matches
              reading order. */}
          {props.categorySlot !== undefined && (
            <div style={{ flex: "0 0 auto" }} data-testid="public-shell-categories">
              {props.categorySlot}
            </div>
          )}
          {/* The menu gets the row's leftover width — `flex: 1 1 auto`
              with `minWidth: 0`. As a bare flex child the horizontal
              `<Menu>` was measured at ~0 by rc-overflow, which is the
              measurement it collapses on: every tab hid behind a "…" on a
              1440px storefront while the row it sat in was empty.

              And the spacer exists only when there is a menu to space. A
              host can legitimately have a category slot and NO nav tabs — a
              storefront whose every menu entry duplicated a link in the
              strip beside it, say — and the greedy `flex: 1 1 auto` on an
              empty div then ate the whole row and shoved the categories
              against the right edge, under a header whose brand sits at the
              left. Nothing was broken and the page looked it. */}
          {navMenu !== null && (
            <div
              style={{ flex: "1 1 auto", minWidth: 0 }}
              data-testid="public-shell-nav"
            >
              {navMenu}
            </div>
          )}
        </Flex>
      )}

      {/* No sheet in dock mode: the dock IS the navigation, and a drawer that
          nothing opens is a surface a screen reader still walks into. */}
      {!isDesktop && !dockChrome && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          closable={false}
          /* Width through `styles.wrapper`, not the `width` prop: antd 6
             deprecates `width` in favour of a `size` that antd 5 spells
             differently, and a shell must not warn on either. */
          styles={{ wrapper: { width: DRAWER_WIDTH }, body: { padding: 0 } }}
          data-testid="public-shell-drawer"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing[3],
              minHeight: HEADER_HEIGHT_DESKTOP,
              padding: `0 ${String(spacing[3])}px 0 ${String(spacing[4])}px`,
              borderBottom: `1px solid ${token.colorSplit}`,
            }}
            data-testid="public-shell-drawer-header"
          >
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>{brandContent}</div>
            <Button
              type="text"
              aria-label={t(SHELL_I18N_KEYS.navCloseMenu)}
              onClick={() => setDrawerOpen(false)}
              icon={<CloseGlyph />}
              data-testid="public-shell-drawer-close"
              data-analytics="none"
              data-analytics-reason="local-ui-close-nav-drawer"
            />
          </div>
          {navMenu}
          {props.categorySlot !== undefined && (
            <div style={{ padding: spacing[4] }} data-testid="public-shell-categories">
              {props.categorySlot}
            </div>
          )}
          {/* The sheet's footer: below the menu and the categories, which is
              where a setting belongs — it is not a destination, and inline
              with the destinations it would read as one. */}
          {themeControl && (
            <div
              style={{
                padding: spacing[3],
                borderBlockStart: `1px solid ${token.colorSplit}`,
              }}
              data-testid="public-shell-theme"
            >
              <ShellThemeControl />
            </div>
          )}
        </Drawer>
      )}

      <Layout.Content
        // The same gutter the header and the footer use, so the three boxes
        // have ONE left edge — and a page mounted in here reads the same role
        // instead of adding a second one on top of it.
        style={{
          padding: `${String(spacing[4])}px ${PAGE_GUTTER_CSS}`,
        }}
        data-testid="public-shell-main"
      >
        <div
          style={{
            width: "100%",
            ...(contentMaxWidth === false
              ? {}
              : { maxWidth: contentMaxWidth, marginInline: "auto" }),
          }}
          data-testid="public-shell-content"
        >
          <Outlet />
        </div>
      </Layout.Content>

      {footerContent !== undefined && (
        <Layout.Footer
          style={{
            background: token.colorBgContainer,
            borderTop: `1px solid ${token.colorSplit}`,
            padding: `${String(spacing[5])}px ${PAGE_GUTTER_CSS}`,
          }}
          data-testid="public-shell-footer"
        >
          <div
            style={{
              width: "100%",
              ...(contentMaxWidth === false
                ? {}
                : { maxWidth: contentMaxWidth, marginInline: "auto" }),
            }}
          >
            {footerContent}
          </div>
        </Layout.Footer>
      )}

      {/* Last in the DOM on purpose: a fixed bar that comes first in tab order
          puts five links between the header and the page on every screen. */}
      {showDock && (
        <NavDock
          nav={props.nav}
          {...(dockBadges !== undefined ? { badges: dockBadges } : {})}
        />
      )}
    </Layout>
  );
}
