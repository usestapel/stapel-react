/**
 * The stored DAO projection → something `@stapel/attributes-react` can draw.
 *
 * A listing carries its attribute values THREE times, all of them DAO lists:
 * `features` (everything, ordered), `features_title` (the ones flagged for
 * the title line) and `features_badges` (the ones flagged for the card). A
 * DAO is the value together with the display configuration its type needs —
 * `prefix`, `precision`, `trueLabel`, `unitType`, … all inline beside
 * `value` — which is the single most useful property of this contract:
 *
 *   **a card can render its badges without ever fetching the category.**
 *
 * `formatFeatureValue` wants a `(FeatureDef, FeatureValueDto)` pair, so this
 * module splits a DAO back into one. The split is mechanical, and it is
 * written down once here rather than at each of the three call sites.
 *
 * ── Where the config comes from, and why the whole row is handed over ──────
 *
 * `FeatureConfig` has an index signature, so passing the DAO itself as the
 * config costs nothing and loses nothing: the type-specific keys are already
 * at the top level of the row, and the four presentation flags (`name`,
 * `order`, `title`, `badge`) are simply ignored by every formatter. Copying a
 * hand-picked subset instead would be a list to keep in step with ten types.
 *
 * ── What a DAO does NOT carry ──────────────────────────────────────────────
 *
 * `select`'s `options`. `normalize_to_dao` stores the chosen VALUES, not the
 * option table, so `formatFeatureValue` falls back to the raw option value —
 * which is a translation KEY when the config is translatable (the default),
 * so a host whose bundle carries the catalogue's option copy still reads a
 * word. A host whose bundle does not sees the key, on purpose: a visible
 * `option.condition.used` gets fixed, an invented "Used" ships wrong.
 */
import type { FeatureDef, FeatureValueDto } from "@stapel/attributes-react";
import type { ListingFeatureDao, ListingFeatureView } from "../api/types.js";

/** Keys that belong to the DAO envelope rather than to the type's config. */
const ENVELOPE = new Set(["slug", "value", "name", "order", "title", "badge"]);

/**
 * One DAO row → the definition/value pair the display half consumes.
 *
 * `undefined` for a row with no `slug`: the stored projection always injects
 * one (`build_features_list`: `{**dao, "slug": slug}`), so a row without it
 * is a malformed record, and a synthesized index would key a badge to a
 * position that changes whenever the category does.
 */
export function featureFromDao(
  dao: ListingFeatureDao
): ListingFeatureView | undefined {
  if (typeof dao.slug !== "string" || dao.slug.length === 0) return undefined;

  const config: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(dao)) {
    if (!ENVELOPE.has(key)) config[key] = value;
  }

  const feature: FeatureDef = {
    slug: dao.slug,
    config,
    name: dao.name ?? null,
    ...(dao.translate !== undefined ? { translate: dao.translate } : {}),
  };

  const value: FeatureValueDto | undefined =
    typeof dao.type === "string" && dao.type.length > 0
      ? { type: dao.type, value: dao.value }
      : undefined;

  return { feature, value };
}

/** A stored projection → the pairs a display component iterates. Malformed
 * rows are dropped HERE, in one place, and counted by {@link
 * unreadableFeatureCount} so a skin can say how many rather than pretend the
 * listing had fewer attributes. */
export function featuresFromDaoList(
  daos: readonly ListingFeatureDao[] | null | undefined
): readonly ListingFeatureView[] {
  const out: ListingFeatureView[] = [];
  for (const dao of daos ?? []) {
    const view = featureFromDao(dao);
    if (view !== undefined) out.push(view);
  }
  return out;
}

/** How many rows of a stored projection this build could not key. */
export function unreadableFeatureCount(
  daos: readonly ListingFeatureDao[] | null | undefined
): number {
  return (daos ?? []).length - featuresFromDaoList(daos).length;
}

/**
 * A stored projection → the `{slug: {type, value}}` envelope, which is what
 * a composer reopening a PUBLISHED listing needs: `draftValuesFromDetail`
 * seeds its editors from the published values, and the published values live
 * only in the DAO list.
 */
export function featuresDtoFromDaoList(
  daos: readonly ListingFeatureDao[] | null | undefined
): Readonly<Record<string, FeatureValueDto>> {
  const out: Record<string, FeatureValueDto> = {};
  for (const view of featuresFromDaoList(daos)) {
    if (view.value !== undefined) out[view.feature.slug] = view.value;
  }
  return out;
}

/**
 * The `features` field of a detail response, typed.
 *
 * The generated `FeatureDao` union is unusable (the discriminator defect —
 * see `api/types.ts`), and `features` is a `JSONField` on the serializer, so
 * this cast is the boundary between "the schema's description" and "the row
 * the JSONField actually emitted". It lives in ONE function so there is one
 * place to change when upstream fixes the mapping.
 */
export function asFeatureDaoList(value: unknown): readonly ListingFeatureDao[] {
  return Array.isArray(value) ? (value as readonly ListingFeatureDao[]) : [];
}
