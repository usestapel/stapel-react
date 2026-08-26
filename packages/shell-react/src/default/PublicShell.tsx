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
 *    optional footer. On phone the browse bar collapses into a `Drawer`; the
 *    header itself never collapses, because a storefront whose search box
 *    disappears on a phone is a storefront nobody searches.
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
import { useBreakpoint, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens-antd";
import type { ResolvedNavEntry } from "../headless/resolveNav.js";
import { NavMenu } from "./navMenu.js";
import { CloseGlyph, MenuGlyph } from "./icons.js";
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
   * which would nest one anchor inside another). */
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

  // The browse bar exists only when there is something to browse. An empty
  // strip — and, on phone, a hamburger that opens an empty sheet — is a
  // control that promises a destination it does not have.
  const hasBrowse = props.nav.length > 0 || props.categorySlot !== undefined;

  const navMenu =
    props.nav.length > 0 ? (
      <NavMenu
        nav={props.nav}
        mode={isDesktop ? "horizontal" : "inline"}
        testId="public-shell-menu"
        style={{ borderInlineEnd: "none", background: "transparent" }}
        {...(isDesktop ? {} : { onNavigate: () => setDrawerOpen(false) })}
      />
    ) : null;

  // The three header slots, built once and ARRANGED differently per width. On
  // a phone the brand, the account control and a search field cannot share one
  // 390px line without each of them being unreadable, so the search takes a
  // second line of the same header rather than being dropped: a storefront
  // whose search box disappears on a phone is a storefront nobody searches.
  const brandNode =
    props.brand !== undefined ? (
      <div
        style={{ display: "flex", alignItems: "center", minWidth: 0 }}
        data-testid="public-shell-brand"
      >
        {props.brand}
      </div>
    ) : null;

  const searchNode =
    props.searchSlot !== undefined ? (
      <div
        style={
          isDesktop
            ? { flex: "1 1 auto", minWidth: 0 }
            : { flex: "0 0 auto", width: "100%", minWidth: 0 }
        }
        data-testid="public-shell-search"
      >
        {props.searchSlot}
      </div>
    ) : null;

  const accountNode = (
    <div
      style={{
        marginInlineStart:
          isDesktop && props.searchSlot !== undefined ? 0 : "auto",
        flex: "0 0 auto",
      }}
      data-testid="public-shell-account"
    >
      {props.accountSlot ?? <SignInCta />}
    </div>
  );

  const menuTrigger =
    !isDesktop && hasBrowse ? (
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
        style={{
          display: "flex",
          alignItems: isDesktop ? "center" : "stretch",
          flexDirection: isDesktop ? "row" : "column",
          gap: isDesktop ? spacing[4] : spacing[2],
          padding: isDesktop
            ? `0 ${String(spacing[4])}px`
            : `${String(spacing[2])}px ${String(spacing[4])}px`,
          height: isDesktop ? HEADER_HEIGHT_DESKTOP : "auto",
          lineHeight: 1,
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorSplit}`,
        }}
      >
        {isDesktop ? (
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

      {!isDesktop && (
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
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>{props.brand}</div>
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
        </Drawer>
      )}

      <Layout.Content style={{ padding: spacing[4] }}>
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

      {props.footer !== undefined && (
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
            {props.footer}
          </div>
        </Layout.Footer>
      )}
    </Layout>
  );
}
