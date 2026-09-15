/**
 * `<CategoryMegaMenu>` — the desktop catalogue panel: a rail of roots on the
 * left, and the chosen root's second and third levels on the right.
 *
 * ── One request, not one per branch ────────────────────────────────────────
 *
 * The whole panel is `useCategoryTree(depth)`, i.e. `GET /tree/?depth=3`: one
 * call, one server-cached answer, four fields per node. Assembled the other
 * two ways available to this pair it is either one request per branch (roots
 * plus a `children` read per root, on the coldest page a storefront has) or
 * the whole catalogue table, which is 1.4 MB before the first name can be
 * drawn. A host that already holds the nodes passes {@link
 * CategoryMegaMenuProps.nodes} and this component asks for nothing.
 *
 * ── The guard is a guard, not a policy ─────────────────────────────────────
 *
 * Below `minWidth` (default `breakpoints.desktop`) this renders NOTHING. The storefront still
 * decides when to mount it — it opens from a button, and a phone gets the tile
 * grid instead, with no drawer. The guard only makes the two decisions
 * impossible to contradict: a menu that opened at 480px because somebody's
 * button forgot a media query would cover the page it was navigating.
 *
 * ── ARIA, and the one thing the seam cannot carry ──────────────────────────
 *
 * The RAIL is a `menu` and its roots are `menuitem`s: they own the keyboard
 * model (roving tabindex, arrows, Home/End, Escape), and each says it
 * discloses the pane with `aria-haspopup` / `aria-expanded` /
 * `aria-controls`. The pane is a list named by the root that opened it — it
 * sits beside the menu rather than inside it, so no element claims to be a
 * menu whose children are not menu items.
 *
 * The second- and third-level entries are LINKS, and they are not marked
 * `menuitem` — deliberately. They are drawn through core's `LinkComponent`, a
 * host's own router link, whose props contract carries no `role`. A component
 * that put `role="menuitem"` on the anchors it renders itself would announce
 * one thing on a plain-anchor host and another on a router host, for the same
 * screen. So the pane is a labelled group of ordinary links — which is what a
 * navigation panel is — and every keyboard affordance a menu owes is
 * implemented rather than merely declared.
 *
 * ── Where the third level stops ────────────────────────────────────────────
 *
 * Five links per second-level column, then a "N more" link pointing at the
 * second-level node itself, whose own page lists the rest. A column that grew
 * to the length of its longest branch would set the height of the whole panel
 * from one crowded category.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  ReactElement,
} from "react";
import { Skeleton } from "antd";
import { breakpoints, cssVar, fontWeight, radii, spacing } from "@stapel/tokens-antd";
import { loadStateFromQuery, useT } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { CategoryTreeNode } from "../api/types.js";
import { categoryIconSrc } from "../catalog/tiles.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { DEFAULT_TREE_DEPTH, useCategoryTree } from "../model/queries.js";
import { CategoryLink } from "./CategoryLink.js";
import type { LinkComponentProp } from "./CategoryLink.js";
import type { ThemeModeProp } from "./types.js";

/** Third-level links a column shows before it hands the rest to the tail. */
const DEFAULT_MAX_LINKS = 5;

/**
 * The narrowest viewport this panel may appear at, by default — the tokens'
 * own `desktop` rung. The phone door is the tile grid; a mega-menu on a phone
 * covers the page it navigates.
 *
 * IT WAS A HARD-CODED 1024, which is on no rung of `@stapel/tokens` and
 * happened to equal one deployment's private edge — so the fleet default
 * silently carried one storefront's composition to every host that named
 * nothing. A width that is a claim about every device belongs to the ladder or
 * to the caller, never to a literal in between: the rung is the default and
 * {@link CategoryMegaMenuProps.minWidth} is how a deployment says otherwise.
 * (Same treatment as `<SearchPage railFrom>` and `<PublicShell chromeFrom>`.)
 */
const DEFAULT_MIN_WIDTH: number = breakpoints.desktop;

/** Root rows the loading arm reserves room for. */
const SKELETON_ROWS = [1, 2, 3, 4, 5, 6] as const;

/**
 * The rail's narrowest width, in px — see {@link CategoryMegaMenuProps.railWidth}.
 *
 * The rail used to be `minmax(180px, 1fr)` beside a `3fr` pane: a quarter of
 * the panel at 1440 (338px of 1400) and 236px at a 1024 guard, where a
 * four-word root wraps onto two lines. The owner's read
 * of the stand (2026-09-14) was that the column is too narrow; the reference's
 * overlay could not be measured from this host (its edge refuses the address),
 * so the number is a floor a host can move, not a measurement: 360px never
 * wraps a two-word root at 16px, and above the floor the rail takes
 * 1/(1 + {@link MEGA_MENU_PANE_FRACTION}) of the panel.
 */
export const MEGA_MENU_RAIL_WIDTH = 360;

/** The pane's share of the panel against the rail's `1fr`: 2.5 puts the rail
 * at two sevenths of the width (386px of 1400) — wider than the old quarter,
 * still the narrower of the two columns. */
export const MEGA_MENU_PANE_FRACTION = 2.5;

/**
 * The panel's own height ceiling — see {@link CategoryMegaMenuProps.maxHeight}.
 *
 * `dvh`, not `vh`: on a phone-class browser with a collapsing address bar the
 * `vh` unit is the LARGEST viewport, and a panel sized by it would put its
 * last rows under the bar. `spacing[6]` (32px) is the room for whatever the
 * host stood the panel under — a header row typically — when it passes no
 * measure of its own.
 */
export const MEGA_MENU_MAX_HEIGHT: string = `calc(100dvh - ${String(spacing[6])}px)`;

/** The class every rail root carries — the hover/focus fill hangs on it. */
export const MEGA_MENU_ROOT_CLASS = "stapel-mega-menu-root";

/** The modifier the DISCLOSED root carries: the row whose pane is showing. */
export const MEGA_MENU_ROOT_ACTIVE_CLASS = "stapel-mega-menu-root-active";

/** The `href` the hoisted mega-menu sheet is deduplicated by. */
export const MEGA_MENU_STYLE_HREF = "stapel-mega-menu";

/**
 * The rail row's rule set.
 *
 * A sheet rather than inline styles because `:hover` and `:focus-visible`
 * cannot be said in a style attribute — and the row's fill could not stay
 * inline either, since an inline `background` beats any sheet rule and the
 * hover would never paint. So the fill LEAVES the style attribute and every
 * state of it lives here, with `--stapel-*` custom properties so both themes
 * resolve at paint time.
 *
 * `surface-sunken` — the design system's neutral tertiary fill — for the
 * hovered, the focused and the disclosed row alike, and deliberately not
 * `brand-subtle` (which the disclosed row drew before 0.32.0). The reference's
 * overlay highlights its hovered root in light grey; a pointer resting on a row
 * is an answer about THAT row and a brand tint there reads as a selection the
 * person has not made. The three states share one fill because on this rail
 * they are one state — hovering or focusing a root discloses it — and the
 * disclosed row still says which it is by weight.
 *
 * `background-color`, never the shorthand: a host that put an image behind a
 * row of its own keeps it.
 */
export function megaMenuCss(): string {
  const root = `.${MEGA_MENU_ROOT_CLASS}`;
  const active = `.${MEGA_MENU_ROOT_ACTIVE_CLASS}`;
  return [
    // A `<button>` brings a platform fill and border of its own.
    `${root}{background-color:transparent;color:${cssVar("text")}}`,
    `${root}:hover,${root}:focus-visible,${active}{` +
      `background-color:${cssVar("surface-sunken")}}`,
    // The pane's links: an underline under the pointer, so a column of plain
    // text says which row is about to be followed.
    `[data-stapel-mega-pane] a:hover,[data-stapel-mega-pane] a:focus-visible{` +
      `text-decoration:underline}`,
  ].join("");
}

/**
 * The panel's box.
 *
 * It is its OWN scroll container — `overflow-y: auto` under a ceiling, with
 * `overscroll-behavior: contain` — because the page behind it must not move
 * when a wheel turns over it. Measured on the stand at 1440 (2026-09-14): the
 * host's wrapper was the scroll box, the panel inside it was shorter than the
 * wrapper's ceiling, so the box had nothing to scroll and the wheel CHAINED to
 * the document — 1500px of page under a panel that then re-anchored to a
 * header that had left the screen. `contain` on a box with nothing to scroll
 * still stops the chain (probed on Chromium 153), which is what lets this be
 * a property of the panel and not a rule the host has to remember.
 */
function panelStyle(maxHeight: number | string, railWidth: number): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns:
      `minmax(${String(railWidth)}px, 1fr) ${String(MEGA_MENU_PANE_FRACTION)}fr`,
    gap: spacing[4],
    padding: spacing[4],
    borderRadius: radii.lg,
    background: cssVar("surface-overlay"),
    boxShadow: cssVar("elevation-medium"),
    boxSizing: "border-box",
    maxHeight,
    overflowY: "auto",
    overscrollBehavior: "contain",
  };
}

/**
 * Hold the document still while a panel stands over it.
 *
 * `overflow: hidden` on the ROOT element, as an inline style that beats any
 * sheet the host wrote; reference-counted because two panels may overlap
 * (this one inside a host's own dialog) and the inner one closing must not
 * hand the page back while the outer one stands; the previous inline values
 * are restored exactly. `scrollbar-gutter: stable` beside it keeps a classic
 * scrollbar's gutter while the bar itself is gone, so a page with one does
 * not widen by 15px under the panel the moment it opens.
 *
 * The same lock `SkinDialog` holds, kept private there — an ask to export it
 * from `/skin` is filed with this component's changeset.
 */
let pageScrollLocks = 0;
let unlockedRoot: { readonly overflow: string; readonly gutter: string } | null = null;

function lockPageScroll(): () => void {
  if (typeof document === "undefined") return () => undefined;
  const root = document.documentElement;
  pageScrollLocks += 1;
  if (pageScrollLocks === 1) {
    unlockedRoot = {
      overflow: root.style.overflow,
      gutter: root.style.scrollbarGutter,
    };
    root.style.overflow = "hidden";
    root.style.scrollbarGutter = "stable";
  }
  return () => {
    pageScrollLocks -= 1;
    if (pageScrollLocks > 0) return;
    const previous = unlockedRoot;
    unlockedRoot = null;
    if (previous === null || previous.overflow === "") {
      root.style.removeProperty("overflow");
    } else {
      root.style.overflow = previous.overflow;
    }
    if (previous === null || previous.gutter === "") {
      root.style.removeProperty("scrollbar-gutter");
    } else {
      root.style.scrollbarGutter = previous.gutter;
    }
  };
}

const railStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing[1],
  borderInlineEnd: `1px solid ${cssVar("border-subtle")}`,
  paddingInlineEnd: spacing[3],
  margin: 0,
  minWidth: 0,
};

/** A rail row is a target, not a sentence: the whole row is the button, and
 * its fill — rest, hover, focus, disclosed — is `megaMenuCss()`'s, because an
 * inline background would beat the sheet's hover rule. */
function railItemStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    width: "100%",
    padding: `${String(spacing[2])}px ${String(spacing[3])}px`,
    border: "none",
    borderRadius: radii.md,
    font: "inherit",
    fontWeight: active ? fontWeight.semibold : fontWeight.regular,
    textAlign: "start",
    cursor: "pointer",
  };
}

const railIconStyle: CSSProperties = {
  width: "1.5em",
  height: "1em",
  objectFit: "contain",
  flex: "none",
};

/** The row's disclosure mark, at its trailing edge: the reference's root row
 * is icon, name, chevron, and the chevron is what makes a 360px row read as
 * one target rather than a short label in a wide column. Decorative — the
 * button already says `aria-haspopup`. */
const railChevronStyle: CSSProperties = {
  marginInlineStart: "auto",
  color: cssVar("text-subtle"),
  flex: "none",
};

const paneStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: `${String(spacing[4])}px ${String(spacing[5])}px`,
  alignContent: "start",
  minWidth: 0,
};

const columnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing[1],
  minWidth: 0,
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const headerLinkStyle: CSSProperties = {
  fontWeight: fontWeight.semibold,
  color: cssVar("text"),
};

const childLinkStyle: CSSProperties = {
  color: cssVar("text-muted"),
};

const moreLinkStyle: CSSProperties = {
  color: cssVar("link"),
};

/**
 * Is the viewport at least `minWidth` wide?
 *
 * Measured against `window.innerWidth` with a `resize` subscription rather
 * than a `matchMedia` handle: this is one number a caller passes, so there is
 * no fixed query to register, and the two agree on every browser that has
 * both. Absent a `window` (SSR) the answer is "yes" — a component the host
 * deliberately mounted should render its markup, and the first client frame
 * corrects it.
 */
function useViewportAtLeast(minWidth: number): boolean {
  const read = useCallback(
    (): boolean =>
      typeof window === "undefined" ? true : window.innerWidth >= minWidth,
    [minWidth]
  );
  const [wide, setWide] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = (): void => {
      setWide(read());
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [read]);
  return wide;
}

export interface CategoryMegaMenuProps extends ThemeModeProp, LinkComponentProp {
  /** Path prefix for a node's link, and the fallback href builder's base.
   * Default `/c` — the same `/c/:slug` convention the rest of the pair uses. */
  readonly basePath?: string;
  /**
   * Where a node leads. Default `${basePath}/${node.slug}`.
   *
   * A builder rather than a prefix because a storefront may route a category
   * through its feed with the node's `path` (`"141/151/166"` — the exact form
   * the search query's `category` parameter takes) instead of its slug.
   */
  readonly href?: (node: CategoryTreeNode) => string;
  /** Levels to ask for. Default {@link DEFAULT_TREE_DEPTH}; below 3 the third
   * level is simply absent and every column is its header alone. */
  readonly depth?: number;
  /**
   * Nodes the HOST supplies, instead of the tree read.
   *
   * Given, this component asks the server nothing — the same bargain
   * `<CategoryTileGrid>`'s `entries` strikes: a host that already mounted
   * `useCategoryTree` for its own chrome should not pay for a second read, and
   * an override that "swapped the data" would still fire the request and
   * discard it. An empty array is a real answer and draws the empty state.
   */
  readonly nodes?: readonly CategoryTreeNode[];
  /** Third-level links per column before the tail link. Default 5. */
  readonly maxLinksPerColumn?: number;
  /**
   * Narrowest viewport this panel may appear at. Default `breakpoints.desktop`
   * (1200) — the tokens' own rung, not a number picked here.
   *
   * A deployment whose catalogue button appears earlier than the ladder says
   * passes its own width, and passes the SAME one it uses everywhere else: the
   * fleet storefront opens this panel at its `SERP_RAIL_MIN_WIDTH` (1024, the
   * owner's tablet rule), which is one number that deployment names once and
   * hands to every pair that needs it.
   */
  readonly minWidth?: number;
  /**
   * The panel's height ceiling, above which its own box scrolls. Default
   * {@link MEGA_MENU_MAX_HEIGHT} (`100dvh` less 32px). A host that stands the
   * panel under a measured header passes the room that is actually left —
   * `calc(100dvh - ${headerBottom}px - 16px)` — and drops any scroll box of
   * its own around the panel: two nested scroll containers give the wheel
   * to whichever has the taller content, which is the OUTER one exactly when
   * the panel fits, and the outer one has no containment.
   */
  readonly maxHeight?: number | string;
  /** The rail's narrowest width in px. Default {@link MEGA_MENU_RAIL_WIDTH}. */
  readonly railWidth?: number;
  /**
   * Hold the document still while the panel is mounted on a wide viewport.
   * Default `true`.
   *
   * A mounted panel is an open panel — this component never hides itself,
   * the host mounts it when it opens — so the lock follows the mount. A host
   * that draws the panel INLINE, as a page region rather than an overlay (a
   * demo, a sitemap page), passes `false`. The lock is `overflow: hidden` on
   * the root element with a stable scrollbar gutter, reference-counted
   * against any other panel or dialog holding the same lock.
   */
  readonly lockScroll?: boolean;
  /** Escape, or a click outside the panel. The host owns the open state; this
   * component never hides itself, because a panel that closed on its own and a
   * button that still reads "open" are two answers to one question. */
  readonly onClose?: () => void;
  /**
   * Fired on click (or Enter — a link and this panel's rail buttons both
   * dispatch a native `click` for that) of ANY item: a rail root, a column's
   * own header link, or one of its third-level links. `kind` says which rung.
   *
   * Before this the only way a host learned WHICH row was picked was reading
   * `data-category-id`/`data-testid` back off the DOM through a delegated
   * listener of its own — this replaces that with the seam every other
   * `onSelect` in the fleet takes. Additive: the row still navigates through
   * `href`/`linkComponent` exactly as before, and a host still owns closing
   * the panel (this never calls `onClose` itself).
   */
  readonly onSelect?: (
    node: CategoryTreeNode,
    kind: "root" | "child" | "grandchild"
  ) => void;
}

/** A node's own name, translated. Tree nodes carry no `translatable` flag, and
 * an absent flag means KEY — the same default `categoryLabel` takes. */
function nodeLabel(
  node: CategoryTreeNode,
  t: (key: string) => string
): string {
  return node.translatable === false ? node.name : t(node.name);
}

/** The rail's root row: art when the catalogue has been seeded, name always. */
function RailIcon(props: {
  readonly node: CategoryTreeNode;
}): ReactElement | null {
  const src = categoryIconSrc(props.node.catalog_icon);
  if (src === null) return null;
  // Decorative: the row's own name is beside it, one text node away.
  return <img src={src} alt="" loading="lazy" style={railIconStyle} />;
}

/** One second-level column: its header link, then its third level. */
function Column(props: {
  readonly node: CategoryTreeNode;
  readonly href: (node: CategoryTreeNode) => string;
  readonly maxLinks: number;
  readonly linkComponent?: LinkComponentProp["linkComponent"];
  readonly onSelect?: CategoryMegaMenuProps["onSelect"];
}): ReactElement {
  const t = useT();
  const linkProps =
    props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {};
  const children = props.node.children ?? [];
  const shown = children.slice(0, props.maxLinks);
  const hidden = children.length - shown.length;
  const onSelect = props.onSelect;
  return (
    <li style={columnStyle} data-testid={`categories-mega-menu-column-${String(props.node.id)}`}>
      <CategoryLink
        {...linkProps}
        href={props.href(props.node)}
        slug={props.node.slug}
        categoryId={props.node.id}
        style={headerLinkStyle}
        onClick={() => {
          onSelect?.(props.node, "child");
        }}
        data-analytics="none"
        data-analytics-reason="a category link the host tracks itself once it navigates; onSelect only names which row was pressed"
      >
        {nodeLabel(props.node, t)}
      </CategoryLink>
      {shown.map((child) => (
        <CategoryLink
          key={child.id}
          {...linkProps}
          href={props.href(child)}
          slug={child.slug}
          categoryId={child.id}
          style={childLinkStyle}
          onClick={() => {
            onSelect?.(child, "grandchild");
          }}
          data-analytics="none"
          data-analytics-reason="a category link the host tracks itself once it navigates; onSelect only names which row was pressed"
        >
          {nodeLabel(child, t)}
        </CategoryLink>
      ))}
      {hidden > 0 && (
        <CategoryLink
          {...linkProps}
          href={props.href(props.node)}
          slug={props.node.slug}
          categoryId={props.node.id}
          style={moreLinkStyle}
          onClick={() => {
            // The tail link leads to the SAME node its header does — one
            // more way to pick the column's own category, not a third rung.
            onSelect?.(props.node, "child");
          }}
          data-analytics="none"
          data-analytics-reason="a category link the host tracks itself once it navigates; onSelect only names which row was pressed"
        >
          {t(CATEGORIES_I18N_KEYS.megaMenuMore, { count: hidden })}
        </CategoryLink>
      )}
    </li>
  );
}

/** The panel itself, over nodes that are already in hand. */
function Panel(props: {
  readonly nodes: readonly CategoryTreeNode[];
  readonly href: (node: CategoryTreeNode) => string;
  readonly maxLinks: number;
  readonly maxHeight: number | string;
  readonly railWidth: number;
  readonly linkComponent?: LinkComponentProp["linkComponent"];
  readonly onClose?: () => void;
  readonly onSelect?: CategoryMegaMenuProps["onSelect"];
}): ReactElement {
  const t = useT();
  const roots = props.nodes;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const railRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const onClose = props.onClose;

  // The rail shrank under a refetch: an index past the end would leave the
  // pane blank with no way back to it.
  const index = active < roots.length ? active : 0;
  const activeRoot = roots[index];

  const focusRoot = useCallback((next: number): void => {
    setActive(next);
    railRefs.current[next]?.focus();
  }, []);

  // Outside click. `pointerdown` rather than `click`: the trigger that opened
  // this panel is outside it, and a `click` listener would see the same press
  // that reopened it.
  useEffect(() => {
    if (onClose === undefined) return;
    const onPointerDown = (event: Event): void => {
      const node = rootRef.current;
      if (node !== null && !node.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose?.();
      return;
    }
    if (roots.length === 0) return;
    const last = roots.length - 1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRoot(index === last ? 0 : index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRoot(index === 0 ? last : index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusRoot(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusRoot(last);
    } else if (event.key === "ArrowRight") {
      // Into the disclosed pane, at its first link.
      const first = rootRef.current?.querySelector<HTMLElement>(
        "[data-stapel-mega-pane] a"
      );
      if (first !== null && first !== undefined) {
        event.preventDefault();
        first.focus();
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusRoot(index);
    }
  };

  const paneId = "categories-mega-menu-pane";
  const paneLabel = activeRoot === undefined ? {} : { "aria-label": nodeLabel(activeRoot, t) };
  return (
    <div
      ref={rootRef}
      data-testid="categories-mega-menu"
      style={panelStyle(props.maxHeight, props.railWidth)}
      data-analytics="none"
      data-analytics-reason="keyboard navigation inside a local panel — moving focus is not an outcome; the host tracks the category link that is followed out of it"
      onKeyDown={onKeyDown}
    >
      {/* The rail row's rest/hover/focus/disclosed fills and the pane links'
          hover — see `megaMenuCss`. Hoisted and deduped by `href`. */}
      <style href={MEGA_MENU_STYLE_HREF} precedence="default">
        {megaMenuCss()}
      </style>
      <div
        role="menu"
        aria-label={t(CATEGORIES_I18N_KEYS.megaMenuLabel)}
        aria-orientation="vertical"
        style={railStyle}
      >
        {roots.map((root, position) => (
          <button
            key={root.id}
            type="button"
            role="menuitem"
            ref={(element) => {
              railRefs.current[position] = element;
            }}
            data-testid={`categories-mega-menu-root-${String(root.id)}`}
            className={
              position === index
                ? `${MEGA_MENU_ROOT_CLASS} ${MEGA_MENU_ROOT_ACTIVE_CLASS}`
                : MEGA_MENU_ROOT_CLASS
            }
            aria-haspopup="true"
            aria-expanded={position === index}
            aria-controls={paneId}
            tabIndex={position === index ? 0 : -1}
            data-analytics="none"
            data-analytics-reason="discloses a local pane of links; the host tracks the category LINK that is followed out of it"
            style={railItemStyle(position === index)}
            onMouseEnter={() => {
              setActive(position);
            }}
            onFocus={() => {
              setActive(position);
            }}
            onClick={() => {
              focusRoot(position);
              props.onSelect?.(root, "root");
            }}
          >
            <RailIcon node={root} />
            <span>{nodeLabel(root, t)}</span>
            <span aria-hidden="true" style={railChevronStyle}>
              ›
            </span>
          </button>
        ))}
      </div>
      <ul
        id={paneId}
        data-stapel-mega-pane=""
        data-testid="categories-mega-menu-pane"
        {...paneLabel}
        style={paneStyle}
      >
        {(activeRoot?.children ?? []).map((child) => (
          <Column
            key={child.id}
            node={child}
            href={props.href}
            maxLinks={props.maxLinks}
            {...(props.linkComponent !== undefined
              ? { linkComponent: props.linkComponent }
              : {})}
            {...(props.onSelect !== undefined
              ? { onSelect: props.onSelect }
              : {})}
          />
        ))}
      </ul>
    </div>
  );
}

export function CategoryMegaMenu(
  props: CategoryMegaMenuProps
): ReactElement | null {
  const t = useT();
  const minWidth = props.minWidth ?? DEFAULT_MIN_WIDTH;
  const wide = useViewportAtLeast(minWidth);
  const basePath = props.basePath ?? "/c";
  const builder = props.href;
  const href = useMemo(
    () =>
      builder ?? ((node: CategoryTreeNode): string => `${basePath}/${node.slug}`),
    [builder, basePath]
  );
  const override = props.nodes;
  // The read is skipped below the guard and under an override: a panel nobody
  // may see must not pay for the rows it would hide.
  const query = useCategoryTree(props.depth ?? DEFAULT_TREE_DEPTH, {
    enabled: wide && override === undefined,
  });
  // The lock follows the mount, and the guard: a panel that renders nothing
  // holds nothing still.
  const lockScroll = props.lockScroll ?? true;
  useEffect(() => {
    if (!wide || !lockScroll) return;
    return lockPageScroll();
  }, [wide, lockScroll]);

  if (!wide) return null;

  const maxHeight = props.maxHeight ?? MEGA_MENU_MAX_HEIGHT;
  const railWidth = props.railWidth ?? MEGA_MENU_RAIL_WIDTH;
  const panelProps = {
    href,
    maxLinks: props.maxLinksPerColumn ?? DEFAULT_MAX_LINKS,
    maxHeight,
    railWidth,
    ...(props.linkComponent !== undefined
      ? { linkComponent: props.linkComponent }
      : {}),
    ...(props.onClose !== undefined ? { onClose: props.onClose } : {}),
    ...(props.onSelect !== undefined ? { onSelect: props.onSelect } : {}),
  };
  const empty = (
    <EmptyState
      testId="categories-mega-menu-empty"
      compact
      title={t(CATEGORIES_I18N_KEYS.catalogEmpty)}
    />
  );

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      {override !== undefined ? (
        override.length === 0 ? (
          empty
        ) : (
          <Panel {...panelProps} nodes={override} />
        )
      ) : (
        <LoadList
          state={loadStateFromQuery(query)}
          testId="categories-mega-menu"
          onRetry={() => {
            void query.refetch();
          }}
          loading={
            <div style={panelStyle(maxHeight, railWidth)}>
              <div style={railStyle}>
                {SKELETON_ROWS.map((slot) => (
                  <Skeleton.Button key={slot} active block size="small" />
                ))}
              </div>
              <div style={paneStyle} />
            </div>
          }
          failed={(error) => (
            <ErrorAlert
              testId="categories-mega-menu-failed"
              thrown={error}
              message={t(CATEGORIES_I18N_KEYS.catalogLoadFailed)}
              onRetry={() => {
                void query.refetch();
              }}
            />
          )}
          empty={empty}
        >
          {(nodes: readonly CategoryTreeNode[]) => (
            <Panel {...panelProps} nodes={nodes} />
          )}
        </LoadList>
      )}
    </SkinTheme>
  );
}
