/**
 * `<AppShell/>` — the default skin for `@stapel/shell-react` (Phase 1 lib-side
 * core, owner directive: scripted-fullstack navigation with no LLM in the
 * loop). Renders the tree `resolveNav` (`../headless/resolveNav.js`)
 * already resolved — this component owns NO nav logic of its own, only
 * chrome: an antd `Layout` with a `Sider` + `Menu` on desktop, a hamburger
 * `Drawer` "sheet" on phone/tablet (`@stapel/core`'s `useBreakpoint`, which
 * now answers correctly on the FIRST client render, so the drawer branch is
 * never painted on a desktop for a frame and swapped out).
 *
 * Theme comes from `SkinTheme` (`@stapel/tokens-antd/skin`) — the fleet's ONE
 * self-theming wrapper, not a local `ConfigProvider` built from a `mode` prop
 * the host had to guess. It follows the document's live `data-theme`, paints
 * the page surface, and raises every control to a 44px touch target on a
 * phone. `mode` is still accepted, to PIN a side (a demo showing both); it is
 * never defaulted to `"light"`, which is a wrong answer on every dark
 * deployment.
 *
 * Shell does NOT own the router: `nav` is already-resolved data, route
 * navigation goes through `react-router`'s own `<Link>`/`useNavigate`, and
 * the page content is whatever the consumer's route tree renders into the
 * `<Outlet/>` this component places — a host wires
 * `<Route element={<AppShell nav={nav} staff={user?.is_staff === true} />}>`
 * with its real child `<Route>`s nested inside, same as any other
 * react-router layout route.
 */
import { useCallback, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Drawer, Layout, theme } from "antd";
import { Outlet } from "react-router";
import { SkinTheme, useThemeMode } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { actionAvailable, actionBlocked, useBreakpoint, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { spacing } from "@stapel/tokens-antd";
import { adminNavIds } from "../headless/resolveNav.js";
import type { ResolvedNavEntry } from "../headless/resolveNav.js";
import { NavMenu } from "./navMenu.js";
import { CloseGlyph, MenuGlyph } from "./icons.js";
import { ShellThemeControl } from "./ShellThemeControl.js";
import { SHELL_I18N_KEYS } from "../i18n/keys.js";

/**
 * The two header heights, off the spacing scale rather than picked by eye: a
 * desktop app bar is one 64-step tall, a phone one is 48 + 8, which clears the
 * 44px touch target inside it with a hair of room above and below. Chrome is
 * one of the two places (with dialogs) where reading the VIEWPORT is correct:
 * a header's height is a property of the window, not of the element.
 */
const HEADER_HEIGHT_DESKTOP = spacing[8];
const HEADER_HEIGHT_PHONE = spacing[7] + spacing[2];

/**
 * The nav sheet's width. A sheet that covers a 390px phone edge to edge leaves
 * a sliver of scrim and reads as a page — no visible way back, nothing to
 * press to dismiss it. 20rem with a viewport ceiling keeps the page it came
 * from visible behind it.
 */
const DRAWER_WIDTH = "min(20rem, 86vw)";

export interface AppShellProps {
  /** Already-resolved nav — the output of `resolveNav(installed,
   * overridesFile)`. `AppShell` renders it as-is; it never calls
   * `resolveNav` itself (the consumer owns fetching/importing the
   * manifests and the project's override file). */
  readonly nav: readonly ResolvedNavEntry[];
  /**
   * Pin the theme to one side. Omitted — the normal case — the shell follows
   * the document's live `data-theme` through `SkinTheme`/`useThemeMode`, so a
   * runtime theme flip moves the chrome with everything else.
   */
  readonly mode?: ThemeMode;
  /**
   * Does the person at the keyboard hold the STAFF capability — the one fact
   * `@stapel/auth-react`'s session carries for this (`useAuthSessionState()`'s
   * `user.is_staff`, the same field the generated container's `AdminGate`
   * reads)? The shell reads no session itself, by the same rule that keeps
   * `resolveNav` pure: the container owns the session and hands the answer
   * down, so the fact lives in one place.
   *
   * Default `false` — a capability is absent until something asserts it.
   *
   * `false` does NOT hide the admin section (`resolveNav`'s `ADMIN_ROOT_ID`).
   * The section stays listed, switched off, with the
   * reason as text beside it: an entry that vanishes teaches nobody the
   * screen exists, and a person who cannot see it cannot ask for access to
   * it. The refusal on the screen itself is the container's `AdminGate`;
   * this is the same answer, said before the click instead of after it.
   */
  readonly staff?: boolean;
  /**
   * Optional brand slot — the product's name and mark, at the head of the top
   * bar (and repeated at the head of the phone nav sheet, which is a surface
   * the header is not visible behind).
   *
   * A brand belongs in the frame every screen shares, not inside the `Sider`:
   * a phone has no `Sider`, and a header carrying one hamburger and no product
   * name names nothing.
   */
  readonly logo?: ReactNode;
  /** Optional right-aligned header slot (e.g. a user/account menu the host
   * composes from its own auth state). */
  readonly headerExtra?: ReactNode;
  /**
   * Counts to mark nav destinations with, keyed by `ResolvedNavEntry.id` —
   * unread messages, ads awaiting moderation, a cart. Rendered on every
   * surface this shell draws the entry on (the `Sider` on a desktop, the nav
   * sheet on a phone), with the count folded into the row's accessible name.
   * Absent or `0` draws no badge: a zero badge is a mark that says nothing is
   * happening.
   *
   * A SLOT, and it has to be one. How many of anything is waiting is a fact
   * each module's own pair owns (`chat-react`'s unread query,
   * `notifications-react`'s feed), and a shell that fetched it would be
   * reading state for modules it must not depend on. The static nav manifest
   * says which destinations exist; this is the runtime channel over it,
   * addressed by the id the manifest already gave each entry.
   */
  readonly navBadges?: Readonly<Record<string, number>>;
  /**
   * The theme switch (`<ShellThemeControl/>`), ON by default — at the foot of
   * the `Sider` on a desktop, at the foot of the nav sheet on a phone. Since
   * 0.14.0 it is the COMPACT icon button; a host that wants the three-label
   * segmented control mounts `<ShellThemeControl variant="settings"/>` on its
   * own appearance screen.
   *
   * Default skins ARE the product (§83). The mechanism under this control has
   * shipped for two waves and every token file compiles a dark block; what was
   * missing was a PLACE, and a place that each host had to remember to make is
   * a place most of them never made. `false` is for a host whose own settings
   * screen owns the choice — it switches off the chrome's copy, not the
   * mechanism (`useThemePreference` stays available).
   */
  readonly themeControl?: boolean;
}

/** Full app chrome: responsive `Sider`/`Drawer` nav + `<Outlet/>` content. */
export function AppShell(props: AppShellProps): ReactElement {
  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface="base"
      style={{ minHeight: "100vh" }}
    >
      <AppChrome {...props} />
    </SkinTheme>
  );
}

/**
 * The chrome itself, drawn INSIDE the theme.
 *
 * `theme.useToken()` answers with the theme of the nearest enclosing
 * `ConfigProvider`, and `SkinTheme` IS that provider — so a component that
 * reads the token bag from OUTSIDE its own `SkinTheme` gets antd's
 * compiled-in defaults instead of the side the document is on, and paints a
 * white bar across every dark deployment. One component boundary is what
 * makes the read happen on the right side of the provider.
 */
function AppChrome(props: AppShellProps): ReactElement {
  const t = useT();
  const liveMode = useThemeMode();
  const mode = props.mode ?? liveMode;
  const { token } = theme.useToken();
  const breakpoint = useBreakpoint();
  const isDesktop = breakpoint === "desktop";
  const [drawerOpen, setDrawerOpen] = useState(false);

  const staff = props.staff ?? false;
  const themeControl = props.themeControl !== false;
  const adminIds = useMemo(() => adminNavIds(props.nav), [props.nav]);
  const gate = useCallback(
    (entry: ResolvedNavEntry): ActionAvailability =>
      staff || !adminIds.has(entry.id)
        ? actionAvailable()
        : actionBlocked(SHELL_I18N_KEYS.navAdminStaffOnly),
    [staff, adminIds]
  );

  return (
    <Layout style={{ minHeight: "100vh" }} data-testid="app-shell">
      {/* One bar across the whole window, above BOTH columns. Nested inside
          the content column it started at the Sider's trailing edge and drew
          a broken L: a frame the eye reads as two unrelated panels rather
          than as one product. */}
      <Layout.Header
        data-testid="app-shell-header"
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[3],
          padding: `0 ${String(spacing[4])}px`,
          height: isDesktop ? HEADER_HEIGHT_DESKTOP : HEADER_HEIGHT_PHONE,
          lineHeight: 1,
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorSplit}`,
        }}
      >
        {!isDesktop && (
          <Button
            type="text"
            aria-label={t(SHELL_I18N_KEYS.navOpenMenu)}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            icon={<MenuGlyph />}
            data-testid="app-shell-menu-trigger"
            data-analytics="none"
            data-analytics-reason="local-ui-open-nav-drawer"
          />
        )}
        {props.logo !== undefined && (
          <div
            style={{ display: "flex", alignItems: "center", minWidth: 0 }}
            data-testid="app-shell-brand"
          >
            {props.logo}
          </div>
        )}
        <div
          style={{
            marginInlineStart: "auto",
            display: "flex",
            alignItems: "center",
            gap: spacing[2],
          }}
          data-testid="app-shell-header-extra"
        >
          {props.headerExtra}
        </div>
      </Layout.Header>
      <Layout>
        {isDesktop ? (
          <Layout.Sider
            theme={mode}
            style={{
              background: token.colorBgContainer,
              borderInlineEnd: `1px solid ${token.colorSplit}`,
            }}
            data-testid="app-shell-sider"
          >
            {/* A column, so the theme switch can sit at the FOOT of the rail
                rather than under the last menu row: appearance is a setting,
                and a setting inline with the destinations reads as a
                destination. */}
            <div
              style={{ display: "flex", flexDirection: "column", height: "100%" }}
            >
              <NavMenu
                nav={props.nav}
                gate={gate}
                {...(props.navBadges !== undefined ? { badges: props.navBadges } : {})}
                style={{ borderInlineEnd: "none", paddingBlockStart: spacing[2] }}
              />
              {themeControl && (
                <div
                  style={{
                    marginBlockStart: "auto",
                    padding: spacing[3],
                    borderBlockStart: `1px solid ${token.colorSplit}`,
                  }}
                  data-testid="app-shell-theme"
                >
                  <ShellThemeControl />
                </div>
              )}
            </div>
          </Layout.Sider>
        ) : (
          <Drawer
            placement="left"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            /* Our own header, not antd's: `closable` grew an options object
               only in 5.17, and the accessible name of the one control that
               dismisses this sheet is not something to make conditional on a
               minor version. */
            closable={false}
            /* Width through `styles.wrapper`, not the `width` prop: antd 6
               deprecates `width` in favour of a `size` that antd 5 spells
               differently, and a shell must not warn on either. */
            styles={{ wrapper: { width: DRAWER_WIDTH }, body: { padding: 0 } }}
            data-testid="app-shell-drawer"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing[3],
                minHeight: HEADER_HEIGHT_PHONE,
                padding: `0 ${String(spacing[3])}px 0 ${String(spacing[4])}px`,
                borderBottom: `1px solid ${token.colorSplit}`,
              }}
              data-testid="app-shell-drawer-header"
            >
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>{props.logo}</div>
              <Button
                type="text"
                aria-label={t(SHELL_I18N_KEYS.navCloseMenu)}
                onClick={() => setDrawerOpen(false)}
                icon={<CloseGlyph />}
                data-testid="app-shell-drawer-close"
                data-analytics="none"
                data-analytics-reason="local-ui-close-nav-drawer"
              />
            </div>
            <NavMenu
              nav={props.nav}
              gate={gate}
              {...(props.navBadges !== undefined ? { badges: props.navBadges } : {})}
              onNavigate={() => setDrawerOpen(false)}
              style={{ borderInlineEnd: "none", paddingBlock: spacing[2] }}
            />
            {/* The sheet's footer. A phone has no `Sider` to hang a setting
                off, and the header is one 56px line with a hamburger, a brand
                and an account control already in it — so the sheet, below the
                destinations, is where a setting sits without reading as one
                of them. */}
            {themeControl && (
              <div
                style={{
                  padding: spacing[3],
                  borderBlockStart: `1px solid ${token.colorSplit}`,
                }}
                data-testid="app-shell-theme"
              >
                <ShellThemeControl />
              </div>
            )}
          </Drawer>
        )}
        <Layout.Content style={{ padding: spacing[4] }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
