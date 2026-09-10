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
import type { AxisRole, FeatureConfig, FeatureDef } from "@stapel/attributes-react";
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
 * `"transparent"` was carried here as a hand-written extension while the pin
 * predated it. The pin is now stapel-categories 0.20.5 and
 * `Schemas["ChildrenAsEnum"]` states all three values itself, so the local
 * addition is DELETED rather than left standing over a generated union that
 * already covers it — one source for one key.
 */
export type CategoryChildrenAs = Schemas["ChildrenAsEnum"];

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
  /**
   * The SOURCE CATALOGUE's own identifier for the field the children
   * enumerate — `operation_type`, `body_type` (stapel-categories 0.22.0).
   *
   * Sits beside {@link children_axis_label} and is the opposite kind of
   * string: the label is a TRANSLATION KEY a person reads, this tag is the
   * import's own name for the question and is never shown. It is how a client
   * recognises that this level and an ordinary feature elsewhere in the tree
   * ask the same thing. Empty when nobody named it, and absent on a server
   * that predates the field — read as the same thing.
   */
  readonly children_axis_tag?: string;
  /**
   * Slug of the feature whose VALUES are this category's children
   * (stapel-categories 0.22.0).
   *
   * Set only on an expanded branch, and it changes what
   * `GET /{id}/children/` answers: virtual children, one per value, and
   * `children_pks` empty because there are no rows. Empty for every ordinary
   * node. See {@link CategoryVirtualChild}.
   */
  readonly children_expand_by?: string;
  /**
   * The ids of the children a READER can fetch — what
   * `GET /categories/{id}/children/` returns, in the same order
   * (stapel-categories 0.20.5).
   *
   * Not the same set as `tn_children_pks`: that is django-treenode's raw
   * structure column and it counts soft-deleted and retired rows, so a rule
   * built on it (leaf-ness, a child count, the one-child wrapper check) sees
   * children nobody can open. Every reader in this pair that used to parse
   * `tn_children_pks` for that question — `hasChildren`, `categoryChildIds`,
   * `isWrapperAncestor` — now reads this first and falls back to
   * `tn_children_pks` only when a server predates the field.
   */
  readonly children_pks?: readonly number[];
  /** How many children a reader can see — `children_pks.length`
   * (stapel-categories 0.20.5). Absent on a server that predates it; the same
   * fallback as {@link children_pks} applies. */
  readonly children_count?: number;
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
 *   array. Since stapel-categories 0.20.5 `tn_children_pks` is no longer the
 *   preferred source for "does this row have children" — `children_pks` /
 *   `children_count` (live rows only) answer that, and every reader in this
 *   pair reads them first, falling back to `tn_children_pks` only on a server
 *   that predates the two fields.
 * - `deleted` is a TOMBSTONE flag, not an absence: a soft-deleted row is still
 *   served (the list endpoint's `include_deleted` defaults to **true**), which
 *   is exactly what makes the delta protocol work and exactly what shows a
 *   deleted category in a menu if nobody filters.
 */
/**
 * Every key of {@link CategoryPresentation} is REQUIRED on the pinned schema
 * and optional here, so the intersection is over `Omit` rather than the row
 * whole: a generated type is a promise about the contract, and the announced
 * range `>=0.20 <0.21` contains servers that send none of them — a 0.20.0
 * server has no `children_pks`/`children_count` (0.20.5) and a pre-0.20 one
 * no `children_as`/`children_axis_label` either. Every reader in this pair
 * already answers "absent" the way it answers `null`.
 */
export type Category = Omit<Schemas["Category"], keyof CategoryPresentation> &
  CategoryPresentation;

/**
 * A POINTER among a category's children, as the children endpoint sends it
 * (stapel-categories 0.22.0).
 *
 * EVERY key is the TARGET's — `id`, `slug`, `tn_parent`, the ancestry columns,
 * the icons, the child counts — so the address a reader navigates to, the
 * breadcrumbs it draws and the listings it counts all belong to the node the
 * pointer leads to. Two keys are the pointer's own: `linked`, which says this
 * row lives elsewhere in the tree, and `name`, which is the link's label when
 * an operator gave it one.
 *
 * That is why this pair grows no second rendering path for it: structurally a
 * linked child IS a {@link Category} plus `linked`, which is exactly what
 * {@link CategoryRowChild} says. The presentation keys are optional here for
 * the same reason they are on `Category` — see {@link CategoryPresentation}.
 */
export type CategoryLinkedChild = Omit<
  Schemas["CategoryLinkedChild"],
  keyof CategoryPresentation
> &
  CategoryPresentation;

/**
 * One VALUE of an expanded branch — a child with no row behind it
 * (stapel-categories 0.22.0).
 *
 * Emitted where the parent carries {@link CategoryPresentation.children_expand_by}.
 * There is no `id`, no `slug` and no `path`, because there is nothing to
 * address: the address is the HOST's own filter URL on the PARENT category,
 * built from `filter` — a `{feature slug: value}` pair. This pair does not
 * invent that route; it hands the pair over (see `categoryChildTileEntries`).
 */
export type CategoryVirtualChild = Schemas["CategoryVirtualChild"];

/**
 * A child that is a ROW: a real subcategory, or a {@link CategoryLinkedChild}
 * pointing at one.
 *
 * One type for both, deliberately. `virtual?: false` is the discriminant of
 * {@link CategoryChild} and nothing else — it is never sent on the wire.
 */
export type CategoryRowChild = Category & {
  /** Present and `true` on a POINTER — this row is drawn here but lives
   * elsewhere in the tree, and every other key is the target's. */
  readonly linked?: boolean;
  readonly virtual?: false;
};

/**
 * What `GET /categories/{id}/children/` answers since stapel-categories
 * 0.22.0: the level below a category, in the order a storefront draws it.
 *
 * Three kinds of entry, and a reader that renders the first renders the second
 * with no new code — a pointer carries the target's whole row. The third is
 * the one that needs the host: a virtual child has no id and no slug, so only
 * the host can say what URL its `filter` becomes.
 */
export type CategoryChild = CategoryRowChild | CategoryVirtualChild;

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

/**
 * Re-exported so a host reading `axis_role` off a {@link CategoryFeature} — or
 * off `CategoryFeaturesBag.axes` — names the type without also depending on
 * `@stapel/attributes-react` directly. Same seam, same reason, as
 * {@link FeatureConfig}: attributes-react owns the vocabulary, this pair
 * serves the rows that carry it.
 */
export type { AxisRole, FeatureConfig };

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
 * `browseStage` prefers a row's own `children_pks`/`children_count`
 * (falling back to `tn_children_pks`, then `children_as`) when it has one.
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
  /** The axis's translation key, for a `chips` row — the caption over the
   * chips (stapel-categories 0.20.0). Empty when nobody named it. */
  readonly children_axis_label?: string;
  /** The SOURCE CATALOGUE's own identifier for the field the children
   * enumerate, beside the label and never shown (stapel-categories 0.22.0) —
   * see {@link CategoryPresentation.children_axis_tag}. */
  readonly children_axis_tag?: string;
  /** Present and `true` on a POINTER: `id`, `slug` and `path` are the
   * TARGET's, so following it lands on the target's own page; only `name` may
   * be the pointer's (stapel-categories 0.22.0). */
  readonly linked?: boolean;
  /** Present and `true` on a VALUE of an expanded branch: no `id`, no `slug`
   * and no `path` — {@link value} and {@link filter} are what it carries
   * (stapel-categories 0.22.0). */
  readonly virtual?: boolean;
  /** Virtual nodes only: the option code this node stands for. */
  readonly value?: string;
  /** Virtual nodes only: the `{feature slug: value}` pair that selects this
   * node's listings on the PARENT category. */
  readonly filter?: Readonly<Record<string, string>>;
  /**
   * How many LIVE children this node has, over the whole visible set — not
   * `len(children)`, which is cut at the requested `depth` (stapel-categories
   * 0.20.5). This is what tells a menu there is another level to ask for once
   * the nested array has been trimmed away by the depth cap. Absent on a
   * server that predates the field; `hasChildren` falls back to
   * `children_as` surviving the cut, then to the (possibly empty) array.
   */
  readonly children_count?: number;
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
