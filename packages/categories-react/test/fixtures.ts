/**
 * Response bodies shaped exactly as stapel-categories sends them.
 *
 * Every awkward detail is present on purpose, because those are the details a
 * pair gets wrong: `name` is a translation key, ancestry is a comma-joined
 * string, the envelope is `{pagination, revisions, results}`, and the fixture
 * carries both an inactive row and a tombstone so a test can prove they are
 * filtered for DIFFERENT reasons.
 */
import type { FeatureDef } from "@stapel/attributes-react";
import type {
  Category,
  CategoryListPage,
  CategoryTreeNode,
} from "../src/index.js";

export function categoryRow(
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
    // The 0.19 contract sends it on every row; `null` is "no children to
    // present", which is what a fixture built without an `extra` describes.
    children_as: null,
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

/**
 * ```
 * electronics (1, prio 20)
 *   phones (2, prio 10)
 *     used-phones (4)
 *   laptops (3, prio 5)
 * vehicles (5, prio 10)
 * retired (6, active:false)
 * gone (7, deleted:true)
 * ```
 */
export const ELECTRONICS: Category = categoryRow(
  1,
  "electronics",
  "category.electronics",
  null,
  "",
  "2,3",
  { tn_priority: 20, carousel_enabled: true, carousel_icon: "carousel/electronics" }
);
export const PHONES: Category = categoryRow(2, "phones", "category.phones", 1, "1", "4", {
  tn_priority: 10,
});
export const LAPTOPS: Category = categoryRow(3, "laptops", "category.laptops", 1, "1", "", {
  tn_priority: 5,
});
export const USED_PHONES: Category = categoryRow(
  4,
  "used-phones",
  "category.used_phones",
  2,
  "1,2",
  ""
);
export const VEHICLES: Category = categoryRow(5, "vehicles", "category.vehicles", null, "", "", {
  tn_priority: 10,
  carousel_enabled: true,
});
/** Served by the list endpoint and hidden by the storefront — `active` is
 * filtered only by /carousel/. */
export const RETIRED: Category = categoryRow(6, "retired", "category.retired", null, "", "", {
  active: false,
});
/** A tombstone: still served, because that is what makes deltas work. */
export const GONE: Category = categoryRow(7, "gone", "category.gone", null, "", "", {
  deleted: true,
});

/**
 * A row an end-to-end run left behind, flagged by the deployment itself.
 *
 * Shaped after the real thing: on a live classified deployment 105 of the 187
 * rows the list endpoint returns are fixtures with slugs like this one. The
 * `is_test` flag is NOT in the pinned schema — which is precisely the case the
 * predicate has to survive — so it is attached the way the wire attaches it,
 * as a field the generated type does not declare.
 */
export const TEST_LEFTOVER: Category = {
  ...categoryRow(8, "authz-1787369370", "category.authz", null, "", ""),
  is_test: true,
} as Category;

/** The same leftover WITHOUT the flag: still active, still live, still a real
 * category as far as any consumer may tell. */
export const UNFLAGGED: Category = categoryRow(
  9,
  "storefront-2",
  "category.storefront_2",
  null,
  "",
  ""
);

export const ROWS: readonly Category[] = [
  ELECTRONICS,
  PHONES,
  LAPTOPS,
  USED_PHONES,
  VEHICLES,
  RETIRED,
  GONE,
];

export function page(
  results: readonly Category[],
  overrides: {
    page?: number;
    totalPages?: number;
    hasNext?: boolean;
    globalMax?: number;
    deletedIds?: readonly number[];
  } = {}
): CategoryListPage {
  const revisions = results.map((r) => r.revision);
  return {
    pagination: {
      page: overrides.page ?? 1,
      page_size: 100,
      total_pages: overrides.totalPages ?? 1,
      total_count: results.length,
      has_next: overrides.hasNext ?? false,
      has_previous: (overrides.page ?? 1) > 1,
    },
    revisions: {
      min: revisions.length > 0 ? Math.min(...revisions) : null,
      max: revisions.length > 0 ? Math.max(...revisions) : null,
      global_max: overrides.globalMax ?? (revisions.length > 0 ? Math.max(...revisions) : 0),
      deleted_ids: [...(overrides.deletedIds ?? [])],
    },
    results: [...results],
  };
}

/** A full first page: every live row, no tombstones (the server only computes
 * `deleted_ids` when `min_revision` was sent). */
export const FULL_PAGE: CategoryListPage = page(
  ROWS.filter((r) => r.deleted !== true),
  { globalMax: 7 }
);

/**
 * A category's resolved feature schema. `config` is VERBATIM — no defaults
 * filled in — exactly as `FeatureCompactSerializer.get_config` sends it.
 */
export const FEATURE_BRAND: FeatureDef = {
  id: 11,
  slug: "brand",
  name: "feature.brand",
  // The catalogue author's note to the person filling the form. A KEY, on the
  // same terms as `name` — stapel-categories' own translation.py reads it as
  // `translate(feature.comment) or translate(feature.name)`.
  comment: "feature.brand.comment",
  mandatory: true,
  show_as_badge: true,
  show_at_title: true,
  translate: "all",
  config: {
    type: "select",
    options: [
      { value: "bosch", label: "brand.bosch" },
      { value: "makita", label: "brand.makita" },
    ],
  },
};

/** `translate: "title"` — the name is a key, the options are not. */
export const FEATURE_POWER: FeatureDef = {
  id: 12,
  slug: "power_w",
  name: "feature.power",
  translate: "title",
  config: { type: "int", min: 0, max: 3000 },
};

/** `translate: "none"` — the stored string IS the label. */
export const FEATURE_WARRANTY: FeatureDef = {
  id: 13,
  slug: "warranty",
  name: "Warranty (raw label)",
  comment: "Tick if the box says so",
  translate: "none",
  config: { type: "bool" },
};

/** Opted out of option translation while still translating its own name. */
export const FEATURE_CLOSED_SET: FeatureDef = {
  id: 14,
  slug: "closed_set",
  name: "feature.closed",
  translate: "all",
  config: {
    type: "select",
    translatable_options: false,
    options: [{ value: "a", label: "A" }],
  },
};

/** A type no builtin value editor covers — legal in the catalogue, and the
 * thing attributes-react's `unsupportedTypes` gate exists to name. */
export const FEATURE_HOLO: FeatureDef = {
  id: 15,
  slug: "holo_signature",
  name: "feature.holo",
  translate: "all",
  config: { type: "holo_signature" },
};

export const FEATURES: readonly FeatureDef[] = [
  FEATURE_BRAND,
  FEATURE_POWER,
  FEATURE_WARRANTY,
  FEATURE_CLOSED_SET,
  FEATURE_HOLO,
];

// ── the NESTED tree (`GET /tree/?depth=N`) ─────────────────────────────────
//
// A different shape from the flat rows above, and deliberately so: four fields
// per node, children inline, no revision and no tombstone. The fixture carries
// the two things a menu gets wrong — a second-level column with more children
// than one column may show, and a `chips` parent whose children are a
// partition rather than a level.

export function treeNode(
  id: number,
  slug: string,
  name: string,
  path: string,
  extra: Partial<CategoryTreeNode> = {}
): CategoryTreeNode {
  return {
    id,
    slug,
    name,
    path,
    catalog_icon: "",
    children_as: null,
    children: [],
    ...extra,
  };
}

/** A cars-shaped node: a partition, not a level (contract §1). */
export const TREE_CARS: CategoryTreeNode = treeNode(
  151,
  "cars",
  "category.cars",
  "141/151",
  {
    children_as: "chips",
    children: [
      treeNode(152, "cars-new", "category.cars_new", "141/151/152"),
      treeNode(153, "cars-used", "category.cars_used", "141/151/153"),
    ],
  }
);

/** Seven third-level links under one header — two past the five a column
 * shows, which is what makes the tail link appear. */
export const TREE_PARTS: CategoryTreeNode = treeNode(
  161,
  "parts",
  "category.parts",
  "141/161",
  {
    children_as: "tiles",
    children: Array.from({ length: 7 }, (_, i) =>
      treeNode(1610 + i, `part-${String(i)}`, `category.part_${String(i)}`, `141/161/${String(1610 + i)}`)
    ),
  }
);

export const TREE_TRANSPORT: CategoryTreeNode = treeNode(
  141,
  "transport",
  "category.transport",
  "141",
  {
    catalog_icon: "https://cdn.test/catalog/transport.png",
    children_as: "tiles",
    children: [TREE_CARS, TREE_PARTS],
  }
);

export const TREE_ELECTRONICS: CategoryTreeNode = treeNode(
  1,
  "electronics",
  "category.electronics",
  "1",
  {
    children_as: "tiles",
    children: [
      treeNode(2, "phones", "category.phones", "1/2", {
        children_as: "tiles",
        children: [treeNode(4, "used-phones", "category.used_phones", "1/2/4")],
      }),
      treeNode(3, "laptops", "category.laptops", "1/3"),
    ],
  }
);

export const TREE: readonly CategoryTreeNode[] = [
  TREE_TRANSPORT,
  TREE_ELECTRONICS,
];
