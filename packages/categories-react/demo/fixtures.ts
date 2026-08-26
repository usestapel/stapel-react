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
import type { Category, CategoryListPage } from "../src/index.js";

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
