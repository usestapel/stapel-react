/**
 * `<NavDock/>` — the phone's PRIMARY navigation: a floating, translucent
 * island of up to five destinations pinned above the bottom edge.
 *
 * ## Why a dock and not "the drawer is enough"
 *
 * A hamburger is one tap away from every destination and zero taps away from
 * none of them. On a phone the thing a person navigates with is the thing
 * their thumb already rests on, which is the bottom of the screen — every
 * classified marketplace ships this bar, and the shell shipping only a drawer
 * is why a scaffolded storefront's phone chrome read as a desktop page that
 * had been squeezed. The drawer stays: it is where the OTHER destinations
 * live, and the dock never claims to be the whole menu.
 *
 * ## Which five, and why the library is not guessing
 *
 * The dock shows the FIRST {@link DOCK_MAX_DESTINATIONS} top-level entries of
 * the nav it is handed, in the order `resolveNav` already sorted them by. That
 * is not an arbitrary rule — it is the rule the project ALREADY steers, from
 * one place, without touching code: `stapel.nav.json`'s per-entry `order` is
 * what decides the menu's order, so it is what decides the dock. A pair
 * inventing a second selection axis ("dock: true" in a manifest) would put the
 * same decision in two files and let them disagree.
 *
 * Sub-entries are deliberately not eligible. A dock destination has to be a
 * place, not a step inside one.
 *
 * ## The island: translucent, and legible anyway
 *
 * Owner directive (2026-08-24): a floating island with liquid glass, the way
 * Telegram and the macOS Dock draw one, rather than a flat opaque bar welded
 * to the viewport's bottom edge. Four things make that safe rather than
 * fashionable:
 *
 *  - **The blur is progressive enhancement, not the design.** The translucent
 *    fill lives inside `@supports (backdrop-filter: …)`; every engine that
 *    cannot blur gets the OPAQUE elevated surface, which is the same island
 *    minus the effect. A page whose text sits on 78% of a background over
 *    unblurred content is unreadable, and "unreadable on old Firefox" is not
 *    a degradation, it is a break.
 *  - **Contrast never rests on the fill alone.** The label and glyph are
 *    `colorText`/`colorPrimary` — the same pair every other surface uses —
 *    over a fill that keeps 78% of the elevated surface's opacity, and the
 *    island carries a real 1px border and an elevation shadow so its EDGE is
 *    visible even where the fill nearly matches what is behind it.
 *  - **It respects the home indicator.** `env(safe-area-inset-bottom)` is
 *    added to the island's own inset, so on a notched phone the dock floats
 *    above the gesture bar instead of underneath it.
 *  - **It is themed from the live token bag**, so light and dark are two
 *    deliberate looks rather than one look and its accident.
 *
 * ## Reachability
 *
 * Every destination is a real `<Link>`: Tab reaches it, Enter follows it, and
 * the current one carries `aria-current="page"`. The badge count is folded
 * into the link's accessible name (`"Chat, 3 unread"`) rather than left as a
 * bare number a screen reader reads as part of the label.
 */
import type { CSSProperties, ReactElement } from "react";
import { Badge, theme } from "antd";
import { Link, useLocation } from "react-router";
import { useT } from "@stapel/core";
import { fontSize, radii, spacing } from "@stapel/tokens-antd";
import { resolveNavIcon } from "./icons.js";
import { findActive } from "./navMenu.js";
import type { ResolvedNavEntry } from "../headless/resolveNav.js";
import { SHELL_I18N_KEYS } from "../i18n/keys.js";

/**
 * How many destinations a dock holds.
 *
 * Five is not a preference: at a 390px viewport, minus the island's own inset
 * and padding, a sixth destination takes each item below the 44px touch floor
 * `SkinTheme` raises every other phone control to. A dock whose targets are
 * too small to hit is a worse menu than the drawer it was meant to replace.
 */
export const DOCK_MAX_DESTINATIONS: number = 5;

/** The island's own height — the same 48+8 the phone header is built from. */
export const DOCK_HEIGHT: number = spacing[7] + spacing[2];

/** How far the island floats in from the viewport's edges. */
const DOCK_INSET = spacing[3];

/**
 * How much room the page has to leave under its last row so the island is not
 * sitting on it. A `calc()` rather than a number, because the safe area is
 * only known to the engine.
 */
export const DOCK_CLEARANCE: string = `calc(${String(
  DOCK_HEIGHT + DOCK_INSET * 2
)}px + env(safe-area-inset-bottom, 0px))`;

/** The class the island carries, for {@link dockGlassCss}. */
export const DOCK_CLASS: string = "stapel-nav-dock";

/** The `href` the hoisted dock stylesheet is deduplicated by. */
export const DOCK_STYLE_HREF: string = "stapel-shell-nav-dock";

/**
 * The one rule an inline style cannot express: `@supports`.
 *
 * The colours arrive as CUSTOM PROPERTIES set on the element itself, so this
 * sheet is static (one copy per document, whatever the theme) while the fill
 * still comes from the live token bag — two docks on one page in two themes
 * would otherwise fight over one hoisted stylesheet. The properties are named
 * `--shell-*` rather than `--stapel-*` on purpose: the `--stapel-` namespace is
 * the design-system's ROLE catalogue (`stapel/valid-token-name` guards it), and
 * these two are a component's private plumbing, not a role a project retunes.
 *
 * The opaque fill is the BASE and the translucent one is the override, which
 * is the order that degrades safely: an engine that cannot read the `@supports`
 * block never blurs and never becomes see-through either.
 */
export function dockGlassCss(): string {
  return [
    `.${DOCK_CLASS}{background:var(--shell-dock-fill)}`,
    `@supports ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){`,
    `.${DOCK_CLASS}{background:var(--shell-dock-fill-glass);`,
    `-webkit-backdrop-filter:blur(18px) saturate(180%);`,
    `backdrop-filter:blur(18px) saturate(180%)}`,
    `}`,
  ].join("");
}

export interface NavDockProps {
  /** Already-resolved nav — `resolveNav`'s output, exactly as the menus take
   * it. The dock takes the first {@link DOCK_MAX_DESTINATIONS} TOP entries. */
  readonly nav: readonly ResolvedNavEntry[];
  /**
   * Counts to mark destinations with, keyed by `ResolvedNavEntry.id` — unread
   * messages, pending moderation, a cart.
   *
   * A SLOT, and it has to be: how many of anything is waiting is a fact each
   * module's own pair owns (`chat-react`'s unread query, `notifications-react`'s
   * feed), and a shell that fetched it would be reading state for modules it
   * must not depend on. Absent or `0` draws no badge — a zero badge is a mark
   * that says nothing is happening.
   */
  readonly badges?: Readonly<Record<string, number>>;
  /** Fewer destinations than {@link DOCK_MAX_DESTINATIONS}, for a chrome that
   * wants a smaller island. Never more: see that constant. */
  readonly max?: number;
}

/** Which entries the dock actually draws. */
export function dockEntries(
  nav: readonly ResolvedNavEntry[],
  max: number = DOCK_MAX_DESTINATIONS
): readonly ResolvedNavEntry[] {
  return nav.slice(0, Math.min(max, DOCK_MAX_DESTINATIONS));
}

/**
 * The floating phone dock. Renders nothing at all for fewer than two
 * destinations: an island holding one link is not navigation, it is a button
 * that has been given a bar to sit in.
 */
export function NavDock(props: NavDockProps): ReactElement | null {
  const t = useT();
  const { token } = theme.useToken();
  const location = useLocation();
  const entries = dockEntries(props.nav, props.max ?? DOCK_MAX_DESTINATIONS);
  const active = findActive(entries, location.pathname);

  if (entries.length < 2) return null;

  const island: CSSProperties = {
    position: "fixed",
    insetInline: DOCK_INSET,
    bottom: `calc(${String(DOCK_INSET)}px + env(safe-area-inset-bottom, 0px))`,
    zIndex: token.zIndexPopupBase,
    display: "flex",
    alignItems: "stretch",
    height: DOCK_HEIGHT,
    padding: spacing[1],
    gap: spacing[1],
    borderRadius: radii.xl,
    border: `1px solid ${token.colorBorderSecondary}`,
    boxShadow: token.boxShadowSecondary,
    // The two fills the stylesheet picks between. The glass one keeps most of
    // the elevated surface: enough for the label's contrast to survive
    // whatever scrolls under it, little enough to read as glass.
    ["--shell-dock-fill" as string]: token.colorBgElevated,
    ["--shell-dock-fill-glass" as string]: `color-mix(in srgb, ${token.colorBgElevated} 78%, transparent)`,
  };

  return (
    <>
      <style href={DOCK_STYLE_HREF} precedence="default">
        {dockGlassCss()}
      </style>
      <nav
        className={DOCK_CLASS}
        aria-label={t(SHELL_I18N_KEYS.dockLabel)}
        style={island}
        data-testid="nav-dock"
      >
        {entries.map((entry) => (
          <DockLink
            key={entry.id}
            entry={entry}
            current={active?.id === entry.id}
            count={props.badges?.[entry.id] ?? 0}
          />
        ))}
      </nav>
    </>
  );
}

/** One destination: glyph, badge, label — and the whole cell is the target. */
function DockLink(props: {
  readonly entry: ResolvedNavEntry;
  readonly current: boolean;
  readonly count: number;
}): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const { entry, current, count } = props;
  const label = t(entry.labelKey);
  const tint = current ? token.colorPrimary : token.colorTextSecondary;

  return (
    <Link
      to={entry.linkPath}
      aria-current={current ? "page" : undefined}
      aria-label={
        count > 0
          ? `${label}, ${t(SHELL_I18N_KEYS.dockUnread, { count })}`
          : undefined
      }
      data-testid={`nav-dock-item-${entry.id}`}
      data-current={current ? "true" : "false"}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing[1],
        borderRadius: radii.lg,
        color: tint,
        // A pill behind the current destination, so "where am I" survives on a
        // colour-blind screen and in a photograph where the tint is subtle.
        background: current ? token.colorPrimaryBg : "transparent",
      }}
    >
      <Badge
        count={count}
        size="small"
        // The number is already in the link's accessible name; a second
        // reading of it is noise.
        aria-hidden="true"
      >
        <span style={{ display: "inline-flex", color: tint }}>
          {resolveNavIcon(entry.icon)}
        </span>
      </Badge>
      <span
        style={{
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.1,
          fontSize: fontSize.xs.fontSize,
        }}
      >
        {label}
      </span>
    </Link>
  );
}
