/**
 * The nav `<Menu/>` both skins render — `<AppShell/>`'s Sider/Drawer and
 * `<PublicShell/>`'s top bar/Drawer.
 *
 * It exists as its own module because the two chromes differ ONLY in
 * geometry: which surface the menu is mounted on and whether it lays out
 * `inline` or `horizontal`. The selection rules — how a pathname is matched
 * to an entry, how a submenu is flattened, how a click navigates — are the
 * same rules, and two copies of them would drift the moment one skin gained
 * a route shape the other did not.
 *
 * Nothing here owns nav LOGIC either: `nav` is already the output of
 * `resolveNav` (`../headless/resolveNav.js`). This module is a renderer.
 */
import { useMemo } from "react";
import type { ReactElement } from "react";
import { Menu } from "antd";
import type { MenuProps } from "antd";
import { Link, useLocation, useNavigate } from "react-router";
import { useT } from "@stapel/core";
import { resolveNavIcon } from "./icons.js";
import type { ResolvedNavEntry } from "../headless/resolveNav.js";

/** Does `pathname` refer to `entry`'s route? `route.path` is either
 * absolute (`"/login"`) or a bare relative segment (`"settings"`,
 * `"security"`) per the nav-manifest contract (`@stapel/core`'s
 * `NavRoute`) — an absolute path matches exactly, a relative one matches
 * the pathname's last segment (the shell doesn't know the full mount
 * prefix a host nested its routes under). */
export function matchesLocation(entry: ResolvedNavEntry, pathname: string): boolean {
  const path = entry.route.path;
  if (path.startsWith("/")) return pathname === path;
  const segments = pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] === path;
}

export function flatten(
  nav: readonly ResolvedNavEntry[]
): readonly ResolvedNavEntry[] {
  return nav.flatMap((entry) => (entry.children ? [entry, ...entry.children] : [entry]));
}

export function toMenuItems(
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

export interface NavMenuProps {
  readonly nav: readonly ResolvedNavEntry[];
  readonly onNavigate?: () => void;
  /** antd layout mode. `"inline"` (the default) is the vertical Sider/Drawer
   * menu; `"horizontal"` is the public shell's top bar. */
  readonly mode?: "inline" | "horizontal";
  /** Test hook. Defaults to `AppShell`'s historical id so its suite — and any
   * host asserting on it — keeps working unchanged. */
  readonly testId?: string;
}

/** One build of the resolved nav, mounted wherever a skin needs it. */
export function NavMenu(props: NavMenuProps): ReactElement {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const { nav, onNavigate } = props;
  const flat = useMemo(() => flatten(nav), [nav]);
  const items = useMemo(() => toMenuItems(nav, t), [nav, t]);

  const active = flat.find((entry) => matchesLocation(entry, location.pathname));
  const selectedKeys = active ? [active.id] : [];
  const openKeys = nav
    .filter((entry) => entry.children?.some((c) => c.id === active?.id))
    .map((e) => e.id);

  const handleClick: MenuProps["onClick"] = ({ key }) => {
    const entry = flat.find((e) => e.id === key);
    if (entry) navigate(entry.route.path);
    onNavigate?.();
  };

  return (
    <Menu
      mode={props.mode ?? "inline"}
      items={items}
      selectedKeys={selectedKeys}
      defaultOpenKeys={openKeys}
      onClick={handleClick}
      data-testid={props.testId ?? "app-shell-menu"}
      data-analytics="none"
      data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
    />
  );
}
