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
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Drawer, Flex, Layout, theme } from "antd";
import { Link, Outlet } from "react-router";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useBreakpoint, useOptionalSite, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens-antd";
import type { ResolvedNavEntry } from "../headless/resolveNav.js";
import { NavMenu } from "./navMenu.js";
import { NavDock, DOCK_CLEARANCE } from "./NavDock.js";
import { CloseGlyph, MenuGlyph } from "./icons.js";
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
const HEADER_HEIGHT_DESKTOP = spacing[8];
const HEADER_HEIGHT_PHONE = spacing[7] + spacing[2];
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
   * phone.
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

  // The decluttered phone chrome, and ONLY below the desktop breakpoint: the
  // prop describes a phone, and a desktop that changed shape because of it
  // would be this component quietly growing a second layout axis.
  const dockChrome = !isDesktop && props.phoneChrome === "dock";

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
    <Layout style={{ minHeight: "100vh" }} data-testid="public-shell">
      <Layout.Header
        data-testid="public-shell-header"
        data-phone-chrome={isDesktop ? undefined : dockChrome ? "dock" : "drawer"}
        style={{
          display: "flex",
          alignItems: isDesktop || dockChrome ? "center" : "stretch",
          flexDirection: isDesktop || dockChrome ? "row" : "column",
          gap: isDesktop ? spacing[4] : dockChrome ? spacing[3] : spacing[2],
          padding: isDesktop
            ? `0 ${String(spacing[4])}px`
            : dockChrome
              ? `0 ${String(spacing[4])}px`
              : `${String(spacing[2])}px ${String(spacing[4])}px`,
          height: isDesktop
            ? HEADER_HEIGHT_DESKTOP
            : dockChrome
              ? HEADER_HEIGHT_PHONE
              : "auto",
          lineHeight: 1,
          // Sticky in dock mode, and only there. With the sheet gone the
          // header is the only way back to search from halfway down a feed,
          // and a header that scrolls away turns "search again" into "scroll
          // to the top first". The background is the theme's own container
          // token rather than a colour, so the content passing under it is
          // covered on both sides of the theme; `zIndexPopupBase` is the layer
          // the dock already floats on, and antd's own popups sit above it, so
          // a select inside the search slot still opens over the header.
          ...(dockChrome
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

      {/* The dock FLOATS, so the page has to leave room under its last row
          — otherwise the island covers the final card of every list and the
          only way to read it is to know it is there. */}
      <Layout.Content
        style={{
          padding: spacing[4],
          ...(showDock ? { paddingBottom: DOCK_CLEARANCE } : {}),
        }}
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
            padding: `${String(spacing[5])}px ${String(spacing[4])}px`,
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
