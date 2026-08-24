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
import { Button, Drawer, Layout } from "antd";
import { Outlet } from "react-router";
import { SkinTheme, useThemeMode } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { actionAvailable, actionBlocked, useBreakpoint, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { adminNavIds } from "../headless/resolveNav.js";
import type { ResolvedNavEntry } from "../headless/resolveNav.js";
import { NavMenu } from "./navMenu.js";
import { MenuGlyph } from "./icons.js";
import { SHELL_I18N_KEYS } from "../i18n/keys.js";

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
  /** Optional brand slot at the top of the `Sider`/`Drawer`. */
  readonly logo?: ReactNode;
  /** Optional right-aligned header slot (e.g. a user/account menu the host
   * composes from its own auth state). */
  readonly headerExtra?: ReactNode;
}

/** Full app chrome: responsive `Sider`/`Drawer` nav + `<Outlet/>` content. */
export function AppShell(props: AppShellProps): ReactElement {
  const t = useT();
  const liveMode = useThemeMode();
  const mode = props.mode ?? liveMode;
  const breakpoint = useBreakpoint();
  const isDesktop = breakpoint === "desktop";
  const [drawerOpen, setDrawerOpen] = useState(false);

  const staff = props.staff ?? false;
  const adminIds = useMemo(() => adminNavIds(props.nav), [props.nav]);
  const gate = useCallback(
    (entry: ResolvedNavEntry): ActionAvailability =>
      staff || !adminIds.has(entry.id)
        ? actionAvailable()
        : actionBlocked(SHELL_I18N_KEYS.navAdminStaffOnly),
    [staff, adminIds]
  );

  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface="base"
      style={{ minHeight: "100vh" }}
    >
      <Layout style={{ minHeight: "100vh" }} data-testid="app-shell">
        {isDesktop ? (
          <Layout.Sider theme={mode} data-testid="app-shell-sider">
            {props.logo && <div style={{ padding: spacing[4] }}>{props.logo}</div>}
            <NavMenu nav={props.nav} gate={gate} />
          </Layout.Sider>
        ) : (
          <Drawer
            placement="left"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            closable={false}
            styles={{ body: { padding: 0 } }}
            data-testid="app-shell-drawer"
          >
            {props.logo && <div style={{ padding: spacing[4] }}>{props.logo}</div>}
            <NavMenu nav={props.nav} gate={gate} onNavigate={() => setDrawerOpen(false)} />
          </Drawer>
        )}
        <Layout>
          <Layout.Header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: `0 ${String(spacing[4])}px`,
            }}
          >
            {!isDesktop && (
              <Button
                aria-label={t(SHELL_I18N_KEYS.navOpenMenu)}
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen(true)}
                icon={<MenuGlyph />}
                data-testid="app-shell-menu-trigger"
                data-analytics="none"
                data-analytics-reason="local-ui-open-nav-drawer"
              />
            )}
            {props.headerExtra}
          </Layout.Header>
          <Layout.Content style={{ padding: spacing[4] }}>
            <Outlet />
          </Layout.Content>
        </Layout>
      </Layout>
    </SkinTheme>
  );
}
