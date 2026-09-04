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
 * Below `minWidth` (default 1024) this renders NOTHING. The storefront still
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
import { cssVar, fontWeight, radii, spacing } from "@stapel/tokens-antd";
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

/** The narrowest viewport this panel may appear at. The phone door is the
 * tile grid; a mega-menu on a phone covers the page it navigates. */
const DEFAULT_MIN_WIDTH = 1024;

/** Root rows the loading arm reserves room for. */
const SKELETON_ROWS = [1, 2, 3, 4, 5, 6] as const;

const panelStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1fr) 3fr",
  gap: spacing[4],
  padding: spacing[4],
  borderRadius: radii.lg,
  background: cssVar("surface-overlay"),
  boxShadow: cssVar("elevation-medium"),
};

const railStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing[1],
  borderInlineEnd: `1px solid ${cssVar("border-subtle")}`,
  paddingInlineEnd: spacing[3],
  margin: 0,
  minWidth: 0,
};

function railItemStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    width: "100%",
    padding: `${String(spacing[2])}px ${String(spacing[3])}px`,
    border: "none",
    borderRadius: radii.md,
    // A rail row is a target, not a sentence: the whole row highlights.
    background: active ? cssVar("brand-subtle") : "transparent",
    color: active ? cssVar("brand") : cssVar("text"),
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
  /** Narrowest viewport this panel may appear at. Default 1024. */
  readonly minWidth?: number;
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
      style={panelStyle}
      data-analytics="none"
      data-analytics-reason="keyboard navigation inside a local panel — moving focus is not an outcome; the host tracks the category link that is followed out of it"
      onKeyDown={onKeyDown}
    >
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

  if (!wide) return null;

  const panelProps = {
    href,
    maxLinks: props.maxLinksPerColumn ?? DEFAULT_MAX_LINKS,
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
            <div style={panelStyle}>
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
