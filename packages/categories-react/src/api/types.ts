/**
 * The wire shapes of `stapel-categories`, taken from the generated schema.
 *
 * The discriminator this pair once had to route around is FIXED upstream.
 * `FeatureConfig`'s `discriminator.mapping` used to carry a single bogus
 * `"null"` entry instead of the ten type slugs, so openapi-typescript re-added
 * a synthetic discriminant per member (`type: "IntConfig"` where the wire
 * sends `type: "int"`). The pair filed it; stapel-attributes 0.4.7 fixed the
 * `PolymorphicProxySerializer`, stapel-categories 0.6.1 regenerated, and
 * `{@link CategoryFeatureConfig}` below is now the real slug-keyed union —
 * asserted by `test/contract.test.ts`, which fails if a slug ever goes back to
 * being a class name.
 *
 * `CategoryFeature` still names `@stapel/attributes-react`'s `FeatureDef`, and
 * that is a SEAM, not a workaround: attributes-react owns the feature axis (it
 * draws the editors, mirrors the validation and formats the values), the
 * features endpoint serializes `config` VERBATIM rather than through
 * `get_config_with_defaults()`, so a malformed row can arrive with no `type`
 * at all, and `FeatureDef`'s open config is what tolerates that loudly instead
 * of crashing. The generated union is what a WELL-FORMED row narrows to, and
 * the two are checked against each other rather than trusted.
 */
import type { FeatureConfig, FeatureDef } from "@stapel/attributes-react";
import type { components } from "./generated/schema.js";

export type Schemas = components["schemas"];

/**
 * How a category's children are PRESENTED — the resolved value, never `auto`.
 *
 * - `tiles` — the children are real subcategories (they diverge in attribute
 *   schema, or have children of their own): a tile grid, no feed.
 * - `chips` — the children are a PARTITION of one template, the same attribute
 *   set split by a value the child name expresses (new/used, buy/sell/rent):
 *   the parent renders a feed with a single-select chip row.
 * - `transparent` — browsing skips THIS NODE: its children appear where it
 *   would, and its own page is treated as its parent's. Unlike
 *   {@link isTransparentWrapper}'s one-child structural rule (a wrapper the
 *   catalogue never marked), this is an AUTHORED value — the reference
 *   collapses this level deliberately, whether or not it has siblings.
 *
 * The stored field is `auto | tiles | chips | transparent`; `auto` is
 * resolved server-side by a derivation command and an authored value wins
 * over it, so this pair only ever sees the three resolved values. A `chips`
 * parent's children keep their ids, paths and URLs — only the presentation
 * changes; a `transparent` node keeps its own id, slug and page too — see
 * `catalog/wrapper.ts`.
 *
 * `"transparent"` is declared here by hand, ahead of the pinned schema
 * (`Schemas["ChildrenAsEnum"]` still lists only `tiles | chips` —
 * stapel-categories 0.20.4 added the value server-side) — an extension, not a
 * widening of the generated union, so a regenerated schema that adds it
 * upstream only removes this local addition rather than conflicting with it.
 */
export type CategoryChildrenAs = Schemas["ChildrenAsEnum"] | "transparent";

/**
 * The presentation fields the serializer adds beyond the pinned schema.
 *
 * A type ALIAS, not an interface, and that is load-bearing: an interface has
 * no implicit index signature, so intersecting one into {@link Category} would
 * stop the row being readable as a `Record<string, unknown>` — which is how
 * `catalog/browse.ts` reads the undeclared `is_test` flag off the wire.
 */
export type CategoryPresentation = {
  /**
   * The RESOLVED presentation of this row's children. Absent on a build whose
   * server does not send it yet, and `null` where the row has no children to
   * present — {@link browseStage} reads both as "no chip row".
   */
  readonly children_as?: CategoryChildrenAs | null;
  /**
   * What a `chips` row SPLITS ON — the axis the children partition, as a
   * translation key like `name` (stapel-categories 0.20.0). Empty when nobody
   * named it, and absent on a server that predates the field, which
   * `partitionAxisLabel` reads as the same thing: a chip row with no caption.
   */
  readonly children_axis_label?: string;
}

/**
 * One category row, exactly as the list / children / carousel endpoints send
 * it (`CategorySerializer`).
 *
 * Three fields decide what a storefront may do with it, and each is a trap if
 * read casually:
 *
 * - `name` is a **translation key**, not a label, whenever `translatable` is
 *   true — see `catalog/labels.ts`. Nothing on this endpoint resolves it.
 * - `tn_ancestors_pks` / `tn_children_pks` are django-treenode's
 *   COMMA-JOINED PK STRINGS (`treenode/utils.py: PKS_SEPARATOR = ","`), typed
 *   `string` here because that is what arrives — `""` for a root. Parse them
 *   with `parseTreenodePks`, never with `JSON.parse` and never by assuming an
 *   array.
 * - `deleted` is a TOMBSTONE flag, not an absence: a soft-deleted row is still
 *   served (the list endpoint's `include_deleted` defaults to **true**), which
 *   is exactly what makes the delta protocol work and exactly what shows a
 *   deleted category in a menu if nobody filters.
 */
/**
 * The two presentation keys are REQUIRED on the pinned schema and optional
 * here, so the intersection is over `Omit` rather than the row whole: a
 * generated type is a promise about the contract, and a storefront pointed at
 * a server older than 0.20 receives rows carrying neither. Every reader in
 * this pair already answers "absent" the way it answers `null`.
 */
export type Category = Omit<Schemas["Category"], keyof CategoryPresentation> &
  CategoryPresentation;

/** The `{pagination, revisions, results}` envelope of `RevisionPagination`.
 * Its rows are {@link Category}, not the generated row: the two presentation
 * keys are optional on this side and the envelope must say so too. */
export type CategoryPage = Omit<Schemas["PaginatedCategoryList"], "results"> & {
  results: Category[];
};

/** `revisions` — the delta-sync bookkeeping half of the envelope. */
export type CategoryRevisions = CategoryPage["revisions"];

/** `GET /categories/revision/` — `{revision}`, the table's current maximum. */
export type MaxRevision = Schemas["MaxRevision"];

/**
 * One resolved feature of a category (own + inherited, deduplicated by slug,
 * in the category's own order first).
 *
 * Structurally `Schemas["FeatureCompact"]`, named as attributes-react's
 * `FeatureDef` because that package owns the feature axis (see this file's
 * header). The two agree field for field; `config` is open here and the
 * generated {@link CategoryFeatureConfig} below is what a well-formed one
 * narrows to.
 *
 * `config` arrives **verbatim**, NOT through `get_config_with_defaults()`
 * (`FeatureCompactSerializer.get_config`) — an absent key means "the type's
 * default", never "off". attributes-react owns those defaults; this pair does
 * not re-state them.
 */
/**
 * `divergent` is stapel-categories 0.20.1's extension, declared here by hand
 * rather than folded into the generated `FeatureDef` — that type is a
 * cross-package canon (`@stapel/attributes-react`'s §68 schema, checked
 * against the Python dataclass and stapel-categories' own payload), not this
 * pair's to widen. Present and `true` only on a `chips` parent's EFFECTIVE
 * schema ({@link CategoryFeaturesEffectiveFrom} `"children"`), for a feature
 * whose children disagree on config, `mandatory` or `rules` — see
 * `visibleFeatures`.
 */
export type CategoryFeature = FeatureDef & { readonly divergent?: true };

export type { FeatureConfig };

/**
 * `own` — this row's resolved schema (own + inherited), byte-for-byte what
 * every build before stapel-categories 0.20.1 answered. `children` — this row
 * is a `chips` parent declaring no features of its own, so the answer is the
 * INTERSECTION of its children's, off the `X-Effective-From` response header.
 * A server predating 0.20.1 sends no such header, which reads as `"own"` —
 * the byte-for-byte answer it always sent.
 */
export type CategoryFeaturesEffectiveFrom = "own" | "children";

/** `GET {id}/features/`'s full answer: the rows plus which schema they are. */
export interface CategoryFeaturesResult {
  readonly features: readonly CategoryFeature[];
  readonly effectiveFrom: CategoryFeaturesEffectiveFrom;
}

/**
 * The wire's feature-config union, straight from the generated schema: ten
 * members discriminated on `type` by the value type's SLUG (`"int"`,
 * `"bool"`, `"convertible_unit"`, …).
 *
 * Narrowing on it is the point — `config.type === "select"` gives you
 * `options`, and TypeScript refuses a member the server does not send. Use it
 * for a config a row is known to carry; use {@link FeatureConfig} (open) for
 * one straight off the wire, which may be missing `type` entirely.
 */
export type CategoryFeatureConfig = Schemas["FeatureConfig"];

/**
 * Every value-type slug `config.type` can carry — the discriminants of
 * {@link CategoryFeatureConfig}, derived rather than restated. Pinned to the
 * ten registered types by `test/contract.test.ts`.
 */
export type CategoryFeatureType = CategoryFeatureConfig["type"];

/**
 * One node of `GET /categories/api/v1/tree/?depth=N` — the NESTED shape, and
 * the only endpoint in this contract that sends children inline.
 *
 * A narrow row on purpose: the menu this feeds needs a name, a link, a picture
 * and the presentation of the level below, and nothing else. It is NOT a
 * {@link Category} — no revision, no ancestry string, no `active`, no
 * tombstone — because the server already applied the visibility rule and the
 * client has nothing left to filter here.
 *
 * `children` is CUT AT `depth`. A node whose `children` is empty is therefore
 * "no children within the depth asked for", not "a leaf" — the distinction
 * {@link CategoryPresentation.children_as} keeps honest, and the reason
 * `browseStage` prefers a row's own `tn_children_pks` when it has one.
 */
export interface CategoryTreeNode {
  readonly id: number;
  readonly slug: string;
  /** A translation KEY unless `translatable` is false — the same rule as
   * {@link Category.name}, and no serializer resolves it. */
  readonly name: string;
  /** Ancestor ids root→self, `/`-joined (`"141/151/166"`) — the exact form
   * the search query's `category` parameter takes, which is why a menu link
   * can hand it straight to the feed. */
  readonly path: string;
  /** An opaque CDN reference, or `""` where nobody has uploaded art. */
  readonly catalog_icon?: string;
  readonly translatable?: boolean;
  readonly children_as?: CategoryChildrenAs | null;
  /** Cut at the requested depth; absent and `[]` mean the same thing. */
  readonly children?: readonly CategoryTreeNode[];
}

/** Query parameters of `GET /categories/api/v1/tree/`. */
export interface CategoryTreeParams {
  /** Levels to return, the roots counting as level 1. Server-capped. */
  readonly depth?: number;
}

/** Query parameters of `GET /categories/api/v1/categories/`. */
export interface CategoryListParams {
  /** Exclusive lower bound: rows with `revision > minRevision`. Omit for a
   * full sync. `0` is NOT the same as omitting it — it skips unsynced legacy
   * rows whose revision is still 0. */
  readonly minRevision?: number;
  /** Inclusive upper bound. The pair pins it across a multi-page walk so a
   * write landing mid-walk cannot shift page boundaries under the reader. */
  readonly maxRevision?: number;
  /** Default on the server is **true**. */
  readonly includeDeleted?: boolean;
  readonly page?: number;
  readonly pageSize?: number;
}
