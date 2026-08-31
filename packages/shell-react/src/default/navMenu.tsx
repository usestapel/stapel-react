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
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Badge, ConfigProvider, Menu, Typography, theme } from "antd";
import type { MenuProps } from "antd";
import { Link, useLocation, useNavigate } from "react-router";
import { useT } from "@stapel/core";
import type { ActionAvailability, TranslateFn } from "@stapel/core";
import { radii, spacing } from "@stapel/tokens-antd";
import { LockGlyph, resolveNavIcon } from "./icons.js";
import type { ResolvedNavEntry } from "../headless/resolveNav.js";
import { SHELL_I18N_KEYS } from "../i18n/keys.js";

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
 * pathname's trailing segments (the shell doesn't know the full mount prefix a
 * host nested its routes under; a multi-segment relative path such as
 * `workspaces/settings` matches as a whole, never on `settings` alone). */
export function matchesLocation(entry: ResolvedNavEntry, pathname: string): boolean {
  const path = entry.linkPath;
  if (path.startsWith("/")) return pathname === path;
  const segments = pathname.split("/").filter(Boolean);
  const own = path.split("/").filter(Boolean);
  if (own.length === 0 || own.length > segments.length) return false;
  return own.every((segment, i) => segments[segments.length - own.length + i] === segment);
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

/**
 * A nav glyph, spaced from its label.
 *
 * antd's own icon gap is styled onto `.ant-menu-item-icon` / `.anticon`, and
 * this package's icons are neither: they are plain inline SVGs (house
 * convention — `default/icons.tsx` carries no `@ant-design/icons`
 * dependency). So the rule never matched them and every row in the shipped
 * drawer read `⌂Notifications`, with the glyph welded to the word. The gap is
 * ours to draw, on our own element, rather than a class name borrowed from
 * antd's internals.
 */
function navIcon(name: string): ReactNode {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        marginInlineEnd: spacing[3],
      }}
    >
      {resolveNavIcon(name)}
    </span>
  );
}

/**
 * The label of a blocked entry: its own copy under a padlock, plus the reason
 * under that. The reason is TEXT beside the control, never a hover title —
 * touch has no hover, and a person who cannot see why a section is closed
 * cannot ask for it to be opened.
 *
 * `whiteSpace: "normal"` and the block layout are not decoration. antd sizes a
 * menu row from one line of text and clips the overflow, so the reason
 * rendered inside a row was PRESENT IN THE DOM AND INVISIBLE ON THE SCREEN —
 * which is how the shell's `admin-blocked` state was pixel-identical to its
 * open one while its tests passed. A blocked entry is laid out to grow.
 */
function blockedLabel(label: string, reason: string, icon?: ReactNode): ReactNode {
  return (
    <span
      data-stapel-nav-blocked=""
      style={{ display: "block", whiteSpace: "normal", lineHeight: 1.35 }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: spacing[2],
          verticalAlign: "middle",
        }}
      >
        {icon}
        <span>{label}</span>
        <LockGlyph />
      </span>
      <Typography.Text
        type="secondary"
        style={{
          display: "block",
          fontSize: "0.8125em",
          lineHeight: 1.35,
          whiteSpace: "normal",
        }}
        data-stapel-nav-blocked-reason=""
      >
        {reason}
      </Typography.Text>
    </span>
  );
}

/** A blocked ROW has to be allowed to be two lines tall — see `blockedLabel`. */
const BLOCKED_ROW_STYLE: CSSProperties = {
  height: "auto",
  lineHeight: 1.35,
  paddingBlock: spacing[2],
  whiteSpace: "normal",
};

/**
 * Counts to mark nav destinations with, keyed by `ResolvedNavEntry.id`.
 *
 * The RUNTIME channel over a static manifest: a manifest states which
 * destinations exist, and how many of anything is waiting behind one is a fact
 * only the module that owns the thing can answer. The shell depends on no
 * module, so the number arrives as data addressed by the id the manifest
 * already gave the entry — the same shape `<NavDock/>` takes, because the dock
 * and the menu are two renderings of one tree and a second shape would be a
 * second place to keep in step.
 */
export type NavBadges = Readonly<Record<string, number>>;

/**
 * A row's label with its count beside it — and the count folded into the
 * accessible name rather than left as a digit glued to the word.
 *
 * The `<Badge>` is `aria-hidden`, exactly as it is in the dock: it is the
 * number FOR THE EYE, and a screen reader that read it twice — once as
 * "Messages 3" from the badge's own text, once from the name — would be
 * reporting one fact as two. The name lives on the wrapper, which is what a
 * menu row (and the `<Link>` inside it) computes its own name from.
 *
 * Zero draws nothing at all, and the label stays a bare string: a zero badge
 * is a mark that says nothing is happening, and an empty wrapper element
 * around every unbadged row would change the menu's DOM for no reason.
 */
function badgedLabel(text: string, count: number, t: TranslateFn): ReactNode {
  if (count <= 0) return text;
  return (
    <span
      aria-label={`${text}, ${t(SHELL_I18N_KEYS.dockUnread, { count })}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacing[3],
        maxWidth: "100%",
      }}
      data-stapel-nav-badged=""
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
      <Badge count={count} size="small" aria-hidden="true" />
    </span>
  );
}

export function toMenuItems(
  nav: readonly ResolvedNavEntry[],
  t: TranslateFn,
  gate: NavGate = alwaysOpen,
  badges?: NavBadges
): NonNullable<MenuProps["items"]> {
  const countOf = (entry: ResolvedNavEntry): number => badges?.[entry.id] ?? 0;
  const one = (
    entry: ResolvedNavEntry,
    /** `false` for a child of an already-blocked section: the reason is
     * stated once, on the section it belongs to. Repeating it on every screen
     * inside turns one sentence into a wall. */
    statesReason = true
  ): NonNullable<MenuProps["items"]>[number] => {
    const availability = gate(entry);
    const text = t(entry.labelKey);
    if (!availability.available) {
      const reason = t(availability.block.code, availability.block.params);
      return statesReason
        ? {
            key: entry.id,
            label: blockedLabel(text, reason, resolveNavIcon(entry.icon)),
            disabled: true,
            style: BLOCKED_ROW_STYLE,
          }
        : { key: entry.id, icon: navIcon(entry.icon), label: text, disabled: true };
    }
    return {
      key: entry.id,
      icon: navIcon(entry.icon),
      label: <Link to={entry.linkPath}>{badgedLabel(text, countOf(entry), t)}</Link>,
    };
  };

  return nav.map((entry) => {
    const availability = gate(entry);
    const text = t(entry.labelKey);
    if (entry.children && entry.children.length > 0) {
      // A blocked SECTION keeps its children LISTED: the reason belongs to the
      // section, and a person asking for access has to be able to name what
      // they are asking for. Hiding the section would leave them nothing to
      // point at.
      const reason = availability.available
        ? undefined
        : t(availability.block.code, availability.block.params);
      if (reason === undefined) {
        return {
          key: entry.id,
          icon: navIcon(entry.icon),
          // A section carries its own count too: whatever is waiting inside a
          // collapsed submenu is invisible until the submenu is opened, which
          // is precisely when a mark on the section is the only thing that
          // says to open it.
          label: badgedLabel(text, countOf(entry), t),
          children: entry.children.map((child) => one(child)),
        };
      }
      // A closed section is a GROUP, not a collapsed submenu: there is nothing
      // to expand into, the twisty would promise a fold that does nothing, and
      // a group title is the one menu row antd lets grow to the two lines the
      // reason needs. Its children stay on screen, switched off, so the person
      // can name the screen they are asking to be let into.
      return {
        key: entry.id,
        type: "group" as const,
        label: blockedLabel(text, reason, resolveNavIcon(entry.icon)),
        children: entry.children.map((child) => one(child, false)),
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
  /**
   * Per-entry counts ({@link NavBadges}) — unread messages, ads awaiting
   * moderation. Absent or `0` draws no badge.
   *
   * The same input the dock takes, rendered on the same entries: a count that
   * appeared under the thumb and not in the sheet (or on a desktop `Sider`,
   * which has no dock at all) would be a fact the chrome knows and only one of
   * its surfaces says.
   */
  readonly badges?: NavBadges;
  /** Test hook. Defaults to `AppShell`'s historical id so its suite — and any
   * host asserting on it — keeps working unchanged. */
  readonly testId?: string;
  /** Layout styles for the `<Menu>` itself — the surface it is mounted on is
   * the caller's knowledge (a Sider, a sheet, a top bar). */
  readonly style?: CSSProperties;
}

/**
 * One build of the resolved nav, mounted wherever a skin needs it.
 *
 * The scoped `ConfigProvider` is geometry, not a theme: it is where the rows
 * get a real touch height and the selected row gets a BACKGROUND rather than
 * only a change of text colour, which is the only marking that survives a
 * glance. `no-local-skin-theme` is about a per-pair
 * theme MODULE; this is a scoped component override inside one component, and
 * the mode still comes from the enclosing `SkinTheme`.
 */
export function NavMenu(props: NavMenuProps): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const location = useLocation();
  const navigate = useNavigate();
  const { nav, onNavigate, gate, badges } = props;
  const flat = useMemo(() => flatten(nav), [nav]);
  const items = useMemo(
    () => toMenuItems(nav, t, gate, badges),
    [nav, t, gate, badges]
  );
  // One config object per distinct answer. A fresh `ThemeConfig` on every
  // render makes antd re-derive the whole theme on every render — the exact
  // cost `SkinTheme`'s own cache exists to avoid.
  const menuTheme = useMemo(
    () => ({
      components: {
        Menu: {
          itemHeight: spacing[7],
          itemBorderRadius: radii.md,
          itemMarginInline: spacing[2],
          itemSelectedBg: token.colorPrimaryBg,
          itemSelectedColor: token.colorPrimary,
          groupTitleFontSize: token.fontSize,
          groupTitleColor: token.colorText,
        },
      },
    }),
    [token.colorPrimaryBg, token.colorPrimary, token.fontSize, token.colorText]
  );

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
    <ConfigProvider theme={menuTheme}>
      <Menu
        mode={props.mode ?? "inline"}
        items={items}
        selectedKeys={selectedKeys}
        defaultOpenKeys={openKeys}
        onClick={handleClick}
        {...(props.style === undefined ? {} : { style: props.style })}
        data-testid={props.testId ?? "app-shell-menu"}
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
      />
    </ConfigProvider>
  );
}
