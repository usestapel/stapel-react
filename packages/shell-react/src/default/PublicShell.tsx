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
 * headless entry, no React), `resolveNavIcon`, `NavMenu`, `toAntdThemeConfig`
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
 *     mode="light"
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
import { Button, ConfigProvider, Drawer, Flex, Layout } from "antd";
import { Link, Outlet } from "react-router";
import { toAntdThemeConfig } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useBreakpoint, useT } from "@stapel/core";
import type { ResolvedNavEntry } from "../headless/resolveNav.js";
import { NavMenu } from "./navMenu.js";
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

export interface PublicShellProps {
  /** Already-resolved nav — the output of `resolvePublicNav` /
   * `resolveMemberNav` (or `resolveNav` with an explicit `audience`).
   * `PublicShell` renders it as-is; it never resolves nav itself, and it
   * never filters by surface a second time. */
  readonly nav: readonly ResolvedNavEntry[];
  readonly mode: ThemeMode;
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
   * `Layout.Content` had a hardcoded `padding: 16` and nothing else, so a
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
  const t = useT();
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
        {...(isDesktop ? {} : { onNavigate: () => setDrawerOpen(false) })}
      />
    ) : null;

  return (
    <ConfigProvider theme={toAntdThemeConfig(props.mode)}>
      <Layout style={{ minHeight: "100vh" }} data-testid="public-shell">
        <Layout.Header
          data-testid="public-shell-header"
          style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 16px" }}
        >
          {!isDesktop && hasBrowse && (
            <Button
              aria-label={t(SHELL_I18N_KEYS.navOpenMenu)}
              onClick={() => setDrawerOpen(true)}
              data-analytics="none"
              data-analytics-reason="local-ui-open-nav-drawer"
            >
              ☰
            </Button>
          )}
          {props.brand !== undefined && (
            <div data-testid="public-shell-brand">{props.brand}</div>
          )}
          {props.searchSlot !== undefined && (
            <div style={{ flex: 1, minWidth: 0 }} data-testid="public-shell-search">
              {props.searchSlot}
            </div>
          )}
          {/* Pushed to the trailing edge whether or not a search slot claimed
              the middle — the CTA's position must not depend on which other
              slots the host happened to fill. */}
          <div
            style={{ marginInlineStart: props.searchSlot === undefined ? "auto" : 0 }}
            data-testid="public-shell-account"
          >
            {props.accountSlot ?? <SignInCta />}
          </div>
        </Layout.Header>

        {isDesktop && hasBrowse && (
          <Flex
            align="center"
            gap={16}
            wrap
            style={{ padding: "0 16px" }}
            data-testid="public-shell-browse"
          >
            {/* The menu gets the row's leftover width — `flex: 1 1 auto`
                with `minWidth: 0`. As a bare flex child the horizontal
                `<Menu>` was measured at ~0 by rc-overflow, which is the
                measurement it collapses on: every tab hid behind a "…" on a
                1440px storefront while the row it sat in was empty. */}
            <div
              style={{ flex: "1 1 auto", minWidth: 0 }}
              data-testid="public-shell-nav"
            >
              {navMenu}
            </div>
            {props.categorySlot !== undefined && (
              <div style={{ flex: "0 0 auto" }} data-testid="public-shell-categories">
                {props.categorySlot}
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
            styles={{ body: { padding: 0 } }}
            data-testid="public-shell-drawer"
          >
            {navMenu}
            {props.categorySlot !== undefined && (
              <div style={{ padding: 16 }} data-testid="public-shell-categories">
                {props.categorySlot}
              </div>
            )}
          </Drawer>
        )}

        <Layout.Content style={{ padding: 16 }}>
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
          <Layout.Footer data-testid="public-shell-footer">{props.footer}</Layout.Footer>
        )}
      </Layout>
    </ConfigProvider>
  );
}
