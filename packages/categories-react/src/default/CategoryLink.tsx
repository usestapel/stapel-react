/**
 * One link, and the one place this skin decides how to render it.
 *
 * Category chrome is nothing BUT links — breadcrumbs, the tree, the carousel —
 * and every one of them was a plain `<a href>`. Inside a SPA that is a full
 * page load per click: the whole app thrown away and rebuilt to move between
 * two categories whose data is already in memory (the catalogue is synced by
 * delta and kept in an app-scoped repository, which is the point of this pair).
 * The storefront named it a gap and routed around the chrome (Wave D, G-4).
 *
 * The pair still carries no router — there are several, and a library that
 * picks one picks it for every host. It takes core's `LinkComponent` instead:
 * a component over a plain `href`, which a host adapts to its own router in
 * one line. Absent, an anchor renders exactly as before, so nothing that
 * worked stops working.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Typography } from "antd";
import type { LinkComponent } from "@stapel/core";

export interface CategoryLinkProps {
  /** The host's `<Link>`. Absent: an antd `Typography.Link`, i.e. an anchor. */
  readonly linkComponent?: LinkComponent;
  readonly href: string;
  readonly children: ReactNode;
  /** The row's slug, kept on the DOM for hosts and tests that key on it. */
  readonly slug?: string;
  /**
   * The row's id, kept on the DOM as `data-category-id`.
   *
   * The one thing a host needs to make a category click cheap. `/c/:slug` has
   * no server-side lookup (`stapel-categories` never overrides `lookup_field`
   * and its list takes no `slug` filter), so a cold slug costs the whole
   * catalogue — 36 requests and 23 seconds on a live 3583-row deployment —
   * while the id costs two small reads. Every link this pair draws KNOWS the
   * id, because it drew the row; passing it through the seam is what lets a
   * router host carry it into the destination (`<Link state>`, a query hint,
   * a cache seed) instead of making the next page re-derive it from nothing.
   *
   * A `data-*` attribute rather than a new prop on core's `LinkComponent`:
   * the contract already has the `data-${string}` index signature, so this
   * reaches a host component that spreads its rest props and changes no
   * shared type.
   */
  readonly categoryId?: number;
  /** Inline styles for the anchor — how a list row makes the WHOLE row the
   * target instead of a 24px word inside it. */
  readonly style?: CSSProperties;
}

export function CategoryLink(props: CategoryLinkProps): ReactElement {
  const Link = props.linkComponent;
  const attributes = {
    ...(props.slug === undefined ? {} : { "data-category-slug": props.slug }),
    ...(props.categoryId === undefined
      ? {}
      : { "data-category-id": String(props.categoryId) }),
    ...(props.style === undefined ? {} : { style: props.style }),
  };
  return Link !== undefined ? (
    <Link href={props.href} {...attributes}>
      {props.children}
    </Link>
  ) : (
    <Typography.Link href={props.href} {...attributes}>
      {props.children}
    </Typography.Link>
  );
}

/** The prop every skin in this pair spells the same way. */
export interface LinkComponentProp {
  /**
   * The host's `<Link>`, so a click on category chrome stays inside the SPA.
   * Absent: plain anchors — correct, and a full page load in a router app.
   */
  readonly linkComponent?: LinkComponent;
}
