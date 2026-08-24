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
import type { ReactElement, ReactNode } from "react";
import { Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import { Link, useLocation, useNavigate } from "react-router";
import { useT } from "@stapel/core";
import type { ActionAvailability, TranslateFn } from "@stapel/core";
import { resolveNavIcon } from "./icons.js";
import type { ResolvedNavEntry } from "../headless/resolveNav.js";

/** Why an entry is offered, or is not. See {@link NavMenuProps.gate}. */
export type NavGate = (entry: ResolvedNavEntry) => ActionAvailability;

const OPEN: ActionAvailability = { available: true };
const alwaysOpen: NavGate = () => OPEN;

/** Does `pathname` refer to `entry`'s route? An entry's address is its
 * resolved `linkPath` (`route.path`, or its SECTION's path for an
 * `route.index` entry — an index route mounts at its parent's address), and
 * that address is either absolute (`"/login"`) or a bare relative segment
 * (`"settings"`, `"security"`) per the nav-manifest contract (`@stapel/core`'s
 * `NavRoute`): an absolute path matches exactly, a relative one matches the
 * pathname's last segment (the shell doesn't know the full mount prefix a
 * host nested its routes under). */
export function matchesLocation(entry: ResolvedNavEntry, pathname: string): boolean {
  const path = entry.linkPath;
  if (path.startsWith("/")) return pathname === path;
  const segments = pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] === path;
}

export function flatten(
  nav: readonly ResolvedNavEntry[]
): readonly ResolvedNavEntry[] {
  return nav.flatMap((entry) => (entry.children ? [entry, ...entry.children] : [entry]));
}

/**
 * The entry the current location is ON. Children are considered BEFORE their
 * parent, because an `route.index` child shares its parent's address: at
 * `/app/settings` both `profiles.settings` and an index child of it match,
 * and the one the person is actually looking at is the child.
 */
export function findActive(
  nav: readonly ResolvedNavEntry[],
  pathname: string
): ResolvedNavEntry | undefined {
  for (const top of nav) {
    for (const child of top.children ?? []) {
      if (matchesLocation(child, pathname)) return child;
    }
  }
  return nav.find((entry) => matchesLocation(entry, pathname));
}

/** The label of a blocked entry: its own copy, plus the reason under it. The
 * reason is TEXT beside the control, never a hover title — touch has no
 * hover, and a person who cannot see why a section is closed cannot ask for
 * it to be opened. */
function blockedLabel(label: string, reason: string): ReactNode {
  return (
    <span data-stapel-nav-blocked="">
      {label}
      <Typography.Text
        type="secondary"
        style={{ display: "block", fontSize: "0.75em", lineHeight: 1.3 }}
        data-stapel-nav-blocked-reason=""
      >
        {reason}
      </Typography.Text>
    </span>
  );
}

export function toMenuItems(
  nav: readonly ResolvedNavEntry[],
  t: TranslateFn,
  gate: NavGate = alwaysOpen
): NonNullable<MenuProps["items"]> {
  const one = (
    entry: ResolvedNavEntry,
    /** `false` for a child of an already-blocked section: the reason is
     * stated once, on the section it belongs to. Repeating it on every screen
     * inside turns one sentence into a wall. */
    statesReason = true
  ): NonNullable<MenuProps["items"]>[number] => {
    const availability = gate(entry);
    const text = t(entry.labelKey);
    const icon = resolveNavIcon(entry.icon);
    if (!availability.available) {
      const reason = t(availability.block.code, availability.block.params);
      return {
        key: entry.id,
        icon,
        label: statesReason ? blockedLabel(text, reason) : text,
        disabled: true,
      };
    }
    return { key: entry.id, icon, label: <Link to={entry.linkPath}>{text}</Link> };
  };

  return nav.map((entry) => {
    const availability = gate(entry);
    const text = t(entry.labelKey);
    const icon = resolveNavIcon(entry.icon);
    if (entry.children && entry.children.length > 0) {
      // A blocked SECTION keeps its children LISTED: the reason belongs to the
      // section, and a person asking for access has to be able to name what
      // they are asking for. Hiding the section would leave them nothing to
      // point at.
      const reason = availability.available
        ? undefined
        : t(availability.block.code, availability.block.params);
      return {
        key: entry.id,
        icon,
        label: reason === undefined ? text : blockedLabel(text, reason),
        children: entry.children.map((child) => one(child, reason === undefined)),
      };
    }
    return one(entry);
  });
}

export interface NavMenuProps {
  readonly nav: readonly ResolvedNavEntry[];
  readonly onNavigate?: () => void;
  /** antd layout mode. `"inline"` (the default) is the vertical Sider/Drawer
   * menu; `"horizontal"` is the public shell's top bar. */
  readonly mode?: "inline" | "horizontal";
  /**
   * Per-entry availability. Default: everything is open.
   *
   * A blocked entry is rendered LISTED and switched off, with the block's
   * reason as visible text under its label — never hidden, never a hover
   * title. The one caller today is the staff gate over the admin section
   * (`<AppShell staff={…}/>`), and the shape is `@stapel/core`'s
   * {@link ActionAvailability} precisely because that type has no way to
   * spell "off, reason unknown".
   */
  readonly gate?: NavGate;
  /** Test hook. Defaults to `AppShell`'s historical id so its suite — and any
   * host asserting on it — keeps working unchanged. */
  readonly testId?: string;
}

/** One build of the resolved nav, mounted wherever a skin needs it. */
export function NavMenu(props: NavMenuProps): ReactElement {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const { nav, onNavigate, gate } = props;
  const flat = useMemo(() => flatten(nav), [nav]);
  const items = useMemo(() => toMenuItems(nav, t, gate), [nav, t, gate]);

  const active = findActive(nav, location.pathname);
  const selectedKeys = active ? [active.id] : [];
  const openKeys = nav
    .filter((entry) => entry.children?.some((c) => c.id === active?.id))
    .map((e) => e.id);

  const handleClick: MenuProps["onClick"] = ({ key }) => {
    const entry = flat.find((e) => e.id === key);
    // A blocked entry is `disabled` in the item list, so antd never routes a
    // click here — the guard is belt-and-braces for a host that builds its
    // own items from `toMenuItems`.
    if (entry === undefined || gate?.(entry).available === false) return;
    navigate(entry.linkPath);
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
