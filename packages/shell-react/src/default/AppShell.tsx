/**
 * `<AppShell/>` — the default skin for `@stapel/shell-react` (Ф1 lib-side
 * core, owner directive: scripted-fullstack navigation with no LLM in the
 * loop). Renders the tree `resolveNav` (`../headless/resolveNav.js`)
 * already resolved — this component owns NO nav logic of its own, only
 * chrome: an antd `Layout` with a `Sider` + `Menu` on desktop, a hamburger
 * `Drawer` "sheet" on phone/tablet (`@stapel/core`'s `useBreakpoint`, the
 * SAME convention `AuthPanel`/`QrDeviceLinkPanel` already follow for their
 * own responsive dialogs — reused here, not reinvented).
 *
 * Theme comes from `toAntdThemeConfig(mode)` (`@stapel/tokens-antd`) — the
 * exact call `AuthPanel` makes — because `AppShell` sits at the app's
 * chrome root: it owns the top-level `<ConfigProvider>` a settings page like
 * `ProfileSettings` assumes is already present above it in the tree.
 *
 * Shell does NOT own the router: `nav` is already-resolved data, route
 * navigation goes through `react-router`'s own `<Link>`/`useNavigate`, and
 * the page content is whatever the consumer's route tree renders into the
 * `<Outlet/>` this component places — a host wires
 * `<Route element={<AppShell nav={nav} mode="light" />}>` with its real
 * child `<Route>`s nested inside, same as any other react-router layout
 * route.
 */
import { useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, ConfigProvider, Drawer, Layout, Menu } from "antd";
import type { MenuProps } from "antd";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { toAntdThemeConfig } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useBreakpoint, useT } from "@stapel/core";
import type { ResolvedNavEntry } from "../headless/resolveNav.js";
import { resolveNavIcon } from "./icons.js";
import { SHELL_I18N_KEYS } from "../i18n/keys.js";

export interface AppShellProps {
  /** Already-resolved nav — the output of `resolveNav(installed,
   * overridesFile)`. `AppShell` renders it as-is; it never calls
   * `resolveNav` itself (the consumer owns fetching/importing the
   * manifests and the project's override file). */
  readonly nav: readonly ResolvedNavEntry[];
  readonly mode: ThemeMode;
  /** Optional brand slot at the top of the `Sider`/`Drawer`. */
  readonly logo?: ReactNode;
  /** Optional right-aligned header slot (e.g. a user/account menu the host
   * composes from its own auth state). */
  readonly headerExtra?: ReactNode;
}

/** Does `pathname` refer to `entry`'s route? `route.path` is either
 * absolute (`"/login"`) or a bare relative segment (`"settings"`,
 * `"security"`) per the nav-manifest contract (`@stapel/core`'s
 * `NavRoute`) — an absolute path matches exactly, a relative one matches
 * the pathname's last segment (the shell doesn't know the full mount
 * prefix a host nested its routes under). */
function matchesLocation(entry: ResolvedNavEntry, pathname: string): boolean {
  const path = entry.route.path;
  if (path.startsWith("/")) return pathname === path;
  const segments = pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] === path;
}

function flatten(nav: readonly ResolvedNavEntry[]): readonly ResolvedNavEntry[] {
  return nav.flatMap((entry) => (entry.children ? [entry, ...entry.children] : [entry]));
}

function toMenuItems(
  nav: readonly ResolvedNavEntry[],
  t: (key: string) => string
): NonNullable<MenuProps["items"]> {
  return nav.map((entry) => {
    const label = <Link to={entry.route.path}>{t(entry.labelKey)}</Link>;
    const icon = resolveNavIcon(entry.icon);
    if (entry.children && entry.children.length > 0) {
      return {
        key: entry.id,
        icon,
        label: t(entry.labelKey),
        children: entry.children.map((child) => ({
          key: child.id,
          icon: resolveNavIcon(child.icon),
          label: <Link to={child.route.path}>{t(child.labelKey)}</Link>,
        })),
      };
    }
    return { key: entry.id, icon, label };
  });
}

/** The nav `<Menu/>` shared by the desktop `Sider` and the phone/tablet
 * `Drawer` — one build, two mount points. */
function NavMenu({
  nav,
  onNavigate,
}: {
  readonly nav: readonly ResolvedNavEntry[];
  readonly onNavigate?: () => void;
}): ReactElement {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const flat = useMemo(() => flatten(nav), [nav]);
  const items = useMemo(() => toMenuItems(nav, t), [nav, t]);

  const active = flat.find((entry) => matchesLocation(entry, location.pathname));
  const selectedKeys = active ? [active.id] : [];
  const openKeys = nav.filter((entry) => entry.children?.some((c) => c.id === active?.id)).map((e) => e.id);

  const handleClick: MenuProps["onClick"] = ({ key }) => {
    const entry = flat.find((e) => e.id === key);
    if (entry) navigate(entry.route.path);
    onNavigate?.();
  };

  return (
    <Menu
      mode="inline"
      items={items}
      selectedKeys={selectedKeys}
      defaultOpenKeys={openKeys}
      onClick={handleClick}
      data-testid="app-shell-menu"
      data-analytics="none"
      data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
    />
  );
}

/** Full app chrome: responsive `Sider`/`Drawer` nav + `<Outlet/>` content. */
export function AppShell(props: AppShellProps): ReactElement {
  const t = useT();
  const breakpoint = useBreakpoint();
  const isDesktop = breakpoint === "desktop";
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <ConfigProvider theme={toAntdThemeConfig(props.mode)}>
      <Layout style={{ minHeight: "100vh" }} data-testid="app-shell">
        {isDesktop ? (
          <Layout.Sider theme={props.mode} data-testid="app-shell-sider">
            {props.logo && <div style={{ padding: 16 }}>{props.logo}</div>}
            <NavMenu nav={props.nav} />
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
            {props.logo && <div style={{ padding: 16 }}>{props.logo}</div>}
            <NavMenu nav={props.nav} onNavigate={() => setDrawerOpen(false)} />
          </Drawer>
        )}
        <Layout>
          <Layout.Header
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}
          >
            {!isDesktop && (
              <Button
                aria-label={t(SHELL_I18N_KEYS.navOpenMenu)}
                onClick={() => setDrawerOpen(true)}
                data-analytics="none"
                data-analytics-reason="local-ui-open-nav-drawer"
              >
                ☰
              </Button>
            )}
            {props.headerExtra}
          </Layout.Header>
          <Layout.Content style={{ padding: 16 }}>
            <Outlet />
          </Layout.Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
