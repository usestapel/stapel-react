/**
 * The wire shapes of `stapel-categories`, taken from the generated schema
 * wherever the generated schema is TRUE, and hand-mirrored — with the reason
 * written down — in the one place it is not.
 *
 * ── The one place the generated types are wrong: `config.type` ─────────────
 *
 * `FeatureCompact.config` is `{"allOf": [{"$ref": "FeatureConfig"}]}`, and
 * `FeatureConfig` is a `oneOf` over ten config schemas carrying
 * `discriminator: {propertyName: "type", mapping: {"null": ConvertibleUnitConfig}}`
 * (stapel-categories `docs/schema.json`). That mapping is malformed — it has
 * ONE entry, keyed `"null"`, instead of the ten type slugs — so
 * openapi-typescript does two things to the generated surface:
 *
 *   1. it strips the discriminator from every use site, emitting
 *      `Omit<components["schemas"]["FeatureConfig"], "type">`; and
 *   2. it re-adds a SYNTHETIC discriminant on each member, so the generated
 *      `IntConfig` declares `type: "IntConfig"` where the wire sends
 *      `type: "int"` (see `generated/schema.ts`, "discriminator enum property
 *      added by openapi-typescript").
 *
 * A pair that typed features off the generated union would therefore hand
 * `@stapel/attributes-react` a `config` with no `type` at all, and any
 * narrowing written against it would compare the value to a string the server
 * never sends. So the features surface is typed through attributes-react's
 * hand-mirrored `FeatureDef` / `FeatureConfig` (`attributes-react/src/types.ts`,
 * itself checked against the engine's generated golden corpus) — the same
 * shapes the value editors, the mirror and the formatter already switch on.
 * Everything else here comes from the generated schema untouched.
 *
 * The upstream ask is recorded rather than worked around twice: emit the ten
 * `type` slugs in `discriminator.mapping`, and both of the above disappear.
 */
import type { FeatureConfig, FeatureDef } from "@stapel/attributes-react";
import type { components } from "./generated/schema.js";

export type Schemas = components["schemas"];

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
export type Category = Schemas["Category"];

/** The `{pagination, revisions, results}` envelope of `RevisionPagination`. */
export type CategoryPage = Schemas["PaginatedCategoryList"];

/** `revisions` — the delta-sync bookkeeping half of the envelope. */
export type CategoryRevisions = CategoryPage["revisions"];

/** `GET /categories/revision/` — `{revision}`, the table's current maximum. */
export type MaxRevision = Schemas["MaxRevision"];

/**
 * One resolved feature of a category (own + inherited, deduplicated by slug,
 * in the category's own order first).
 *
 * Structurally `FeatureCompact`, but typed as attributes-react's `FeatureDef`
 * for the discriminator reason at the top of this file. The two agree field
 * for field; only `config` differs, and only in the direction of the truth.
 *
 * `config` arrives **verbatim**, NOT through `get_config_with_defaults()`
 * (`FeatureCompactSerializer.get_config`) — an absent key means "the type's
 * default", never "off". attributes-react owns those defaults; this pair does
 * not re-state them.
 */
export type CategoryFeature = FeatureDef;

export type { FeatureConfig };

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
