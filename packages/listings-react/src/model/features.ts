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
 * ── What a DAO does NOT carry, and the one line that repairs it ────────────
 *
 * `select`'s `options`. `SelectType.dto_to_dao` stores the chosen VALUES and
 * the ui config, never the option table — the table lives on the CATEGORY, and
 * not needing it is the whole point of the projection.
 *
 * The consequence was a defect the visual pass caught on every card and every
 * spec row: `formatFeatureValue` resolves an option's copy by looking the
 * value up in `config.options`, and with no table it falls through to
 * `String(value)`. The stored value of a translatable catalogue IS a
 * translation key, so a listing page printed `demo.condition.used` and
 * `demo.brand.bosch` at people. (The server does not have this problem: its
 * own `format_value` has the category's config in hand.)
 *
 * So the split below synthesizes the IDENTITY table — `{value: v, label: v}`
 * for each stored value — which is exactly the table a translatable catalogue
 * would have produced, since its labels ARE the keys. `formatFeatureValue`
 * then runs the value through the host's `t` and a bundle carrying the
 * catalogue copy reads "Used". A bundle that does not still shows the key, on
 * purpose: a visible `option.condition.used` gets fixed, an invented "Used"
 * ships wrong. A NON-translatable catalogue stores literal labels, `t` returns
 * an unknown key unchanged, and the output is what it always was.
 */
import type { FeatureDef, FeatureValueDto } from "@stapel/attributes-react";
import type { ListingFeatureDao, ListingFeatureView } from "../api/types.js";

/** Keys that belong to the DAO envelope rather than to the type's config. */
const ENVELOPE = new Set(["slug", "value", "name", "order", "title", "badge"]);

/** The two types whose stored `value` is an option key rather than the thing
 * itself. `hierarchical_select` is deliberately absent: its formatter joins
 * the path with " / " and never consults an option table at all. */
const OPTION_VALUED = new Set(["select"]);

/**
 * The identity option table for a stored `select` — see the module header.
 *
 * Returns `undefined` when there is nothing to add (another type, a config
 * that already carries a table, a value that is not a list of strings), so the
 * common path allocates nothing and a DAO that DOES carry options is left
 * exactly as it arrived.
 */
function synthesizedOptions(
  dao: ListingFeatureDao,
  config: Readonly<Record<string, unknown>>
): readonly { value: string; label: string }[] | undefined {
  if (typeof dao.type !== "string" || !OPTION_VALUED.has(dao.type)) return undefined;
  if (Array.isArray(config["options"])) return undefined;
  const raw = Array.isArray(dao.value) ? dao.value : [dao.value];
  const values = raw.filter((item): item is string => typeof item === "string");
  if (values.length === 0) return undefined;
  return values.map((value) => ({ value, label: value }));
}

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
  const options = synthesizedOptions(dao, config);
  if (options !== undefined) config["options"] = options;

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
