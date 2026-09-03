/**
 * Demo fixtures — real response BODIES, shaped exactly as stapel-categories
 * sends them, so a demo exercises the same parsing a stand would.
 *
 * Note what that means in practice, because it is the pair's whole subject:
 * `name` is a translation KEY, `tn_ancestors_pks` is a COMMA-JOINED STRING,
 * `tn_children_pks` likewise, and the list envelope is
 * `{pagination, revisions, results}` rather than DRF's usual
 * `{count, next, results}`.
 */
import type { FeatureDef } from "@stapel/attributes-react";
import { categoryLabel } from "../src/index.js";
import type {
  CarouselEntry,
  Category,
  CategoryListPage,
  CategoryTreeNode,
} from "../src/index.js";

function row(
  id: number,
  slug: string,
  name: string,
  parent: number | null,
  ancestors: string,
  children: string,
  extra: Partial<Category> = {}
): Category {
  return {
    id,
    name,
    slug,
    catalog_icon: "",
    carousel_icon: "",
    carousel_enabled: false,
    active: true,
    features: [],
    translatable: true,
    tn_parent: parent,
    tn_priority: 0,
    tn_ancestors_pks: ancestors,
    tn_children_pks: children,
    revision: id,
    deleted: false,
    ...extra,
  };
}

export const DEMO_ROWS: readonly Category[] = [
  row(1, "electronics", "demo.category.electronics", null, "", "2,3", {
    tn_priority: 20,
    carousel_enabled: true,
    carousel_icon: "carousel/electronics",
  }),
  row(2, "phones", "demo.category.phones", 1, "1", "4", { tn_priority: 10 }),
  row(3, "laptops", "demo.category.laptops", 1, "1", "", { tn_priority: 5 }),
  row(4, "used-phones", "demo.category.used_phones", 2, "1,2", ""),
  row(5, "vehicles", "demo.category.vehicles", null, "", "", {
    tn_priority: 10,
    carousel_enabled: true,
  }),
  // Off the storefront tree, and each for a different reason — the demo shows
  // that both are filtered without either being mistaken for the other.
  row(6, "retired", "demo.category.retired", null, "", "", { active: false }),
  row(7, "gone", "demo.category.gone", null, "", "", { deleted: true }),
];

/** One full page: what a cold sync gets back. */
export const DEMO_PAGE: CategoryListPage = {
  pagination: {
    page: 1,
    page_size: 100,
    total_pages: 1,
    total_count: DEMO_ROWS.length,
    has_next: false,
    has_previous: false,
  },
  revisions: { min: 1, max: 7, global_max: 7, deleted_ids: [] },
  results: [...DEMO_ROWS],
};

/** The carousel endpoint's answer — already filtered by the server. */
export const DEMO_CAROUSEL: readonly Category[] = DEMO_ROWS.filter(
  (r) => r.carousel_enabled === true
);

/**
 * A wider carousel, for the two-row tile grid.
 *
 * Two tiles fit on one screen and prove nothing about a grid whose whole
 * subject is that it scrolls sideways with the third column peeking in. These
 * eight rows are the same shape as the ones above — names are translation
 * keys, icon references are opaque strings — and half of them deliberately
 * carry NO icon reference, so one photograph shows both the resolved art and
 * the placeholder beside each other.
 */
export const DEMO_TILE_CAROUSEL: readonly Category[] = [
  ...DEMO_CAROUSEL,
  row(11, "jobs", "demo.category.jobs", null, "", "", {
    tn_priority: 9,
    carousel_enabled: true,
    carousel_icon: "carousel/jobs",
  }),
  row(12, "services", "demo.category.services", null, "", "", {
    tn_priority: 8,
    carousel_enabled: true,
    carousel_icon: "carousel/services",
  }),
  row(13, "realty", "demo.category.realty", null, "", "", {
    tn_priority: 7,
    carousel_enabled: true,
  }),
  row(14, "home-and-garden", "demo.category.home_and_garden", null, "", "", {
    tn_priority: 6,
    carousel_enabled: true,
  }),
  row(15, "hobby", "demo.category.hobby", null, "", "", {
    tn_priority: 5,
    carousel_enabled: true,
  }),
  row(16, "animals", "demo.category.animals", null, "", "", {
    tn_priority: 4,
    carousel_enabled: true,
  }),
];

/**
 * Tiles a HOST supplies — the `entries` override.
 *
 * These are the CHILDREN of one category, which is the case the carousel bag
 * cannot answer: `GET /categories/carousel/` returns the storefront's front
 * page and nothing else, so a `/c/electronics` landing that wants "Phones,
 * Laptops, Used phones" has to hand its own rows in. They are built the way a
 * container builds them — from the tree it already has, through the pair's own
 * `categoryLabel` — and deliberately share no row with `DEMO_TILE_CAROUSEL`,
 * so the override variant photographs as a different row rather than the same
 * one by another route.
 */
export const DEMO_CHILD_TILES: readonly CarouselEntry[] = DEMO_ROWS.filter(
  (candidate) => candidate.tn_parent !== null && !candidate.deleted
).map((category) => ({
  category,
  label: categoryLabel(category),
  icon:
    category.carousel_icon !== undefined && category.carousel_icon !== ""
      ? category.carousel_icon
      : null,
  href: `/c/${category.slug}`,
}));

/**
 * A category's resolved feature schema. `config` is VERBATIM — no defaults
 * filled in — exactly as `FeatureCompactSerializer.get_config` sends it, and
 * one row deliberately carries a type no builtin editor covers.
 */
export const DEMO_FEATURES: readonly FeatureDef[] = [
  {
    id: 11,
    slug: "brand",
    name: "demo.feature.brand",
    comment: "demo.feature.brand.comment",
    mandatory: true,
    show_as_badge: true,
    show_at_title: true,
    translate: "all",
    config: {
      type: "select",
      options: [
        { value: "bosch", label: "demo.brand.bosch" },
        { value: "makita", label: "demo.brand.makita" },
      ],
    },
  },
  {
    id: 12,
    slug: "power_w",
    name: "demo.feature.power",
    mandatory: false,
    show_as_badge: true,
    translate: "title",
    config: { type: "int", min: 0, max: 3000, postfix: "demo.unit.watt" },
  },
  {
    id: 13,
    slug: "warranty",
    // `translate: "none"` — the stored string IS the label, and the demo shows
    // the pair rendering it as one instead of running it through `t`.
    name: "Warranty",
    comment: "Tick it if the box says so",
    translate: "none",
    config: { type: "bool" },
  },
  {
    id: 14,
    slug: "holo_signature",
    name: "demo.feature.holo",
    translate: "all",
    config: { type: "holo_signature" },
  },
];

// ── the nested tree (`GET /tree/?depth=3`) ─────────────────────────────────
//
// The mega-menu's whole data source, and a different shape from the rows
// above: children inline, four fields per node, no sync bookkeeping. The
// second level is deliberately uneven — one column runs past the five links a
// column shows, so one photograph carries both a full column and the tail
// link that stands in for the rest.

function node(
  id: number,
  slug: string,
  name: string,
  path: string,
  extra: Partial<CategoryTreeNode> = {}
): CategoryTreeNode {
  return { id, slug, name, path, catalog_icon: "", children_as: null, children: [], ...extra };
}

function leaves(
  parentId: number,
  parentPath: string,
  names: readonly string[]
): readonly CategoryTreeNode[] {
  return names.map((name, i) =>
    node(
      parentId * 100 + i,
      `${String(parentId)}-${String(i)}`,
      name,
      `${parentPath}/${String(parentId * 100 + i)}`
    )
  );
}

export const DEMO_TREE: readonly CategoryTreeNode[] = [
  node(1, "electronics", "demo.category.electronics", "1", {
    children_as: "tiles",
    children: [
      node(2, "phones", "demo.category.phones", "1/2", {
        children_as: "chips",
        children: leaves(2, "1/2", [
          "demo.category.phones_new",
          "demo.category.phones_used",
        ]),
      }),
      node(3, "laptops", "demo.category.laptops", "1/3", {
        children_as: "tiles",
        children: leaves(3, "1/3", [
          "demo.category.laptops_gaming",
          "demo.category.laptops_office",
          "demo.category.laptops_apple",
          "demo.category.laptops_parts",
          "demo.category.laptops_bags",
          "demo.category.laptops_docks",
          "demo.category.laptops_screens",
        ]),
      }),
    ],
  }),
  node(5, "vehicles", "demo.category.vehicles", "5", {
    children_as: "tiles",
    children: [
      node(51, "cars", "demo.category.cars", "5/51", {
        children_as: "chips",
        children: leaves(51, "5/51", [
          "demo.category.cars_new",
          "demo.category.cars_used",
        ]),
      }),
    ],
  }),
  node(11, "jobs", "demo.category.jobs", "11", { children_as: "tiles" }),
  node(13, "realty", "demo.category.realty", "13", { children_as: "tiles" }),
];
