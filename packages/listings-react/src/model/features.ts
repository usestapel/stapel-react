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
 * ── What a DAO does NOT carry, and the two tables that repair it ───────────
 *
 * `select`'s `options`. `SelectType.dto_to_dao` stores the chosen VALUES and
 * the ui config, never the option table — the table lives on the CATEGORY, and
 * not needing it is the whole point of the projection.
 *
 * `formatFeatureValue` resolves an option's copy by looking the value up in
 * `config.options`, so with no table at all it falls through to
 * `String(value)` and the STORAGE SLUG reaches the screen: a live classified
 * deployment printed "Condition: b-u" on its spec rows and a three-slug
 * subtitle on its cards. (The server never had this problem: its own
 * `format_value` has the category's config in hand.)
 *
 * So the split below rebuilds the table, from the better of two sources:
 *
 *  1. The LABEL SNAPSHOT. A `select` DAO written by a stapel-attributes that
 *     snapshots labels carries `labels`, a `string[]` positionally aligned
 *     with `value` — the same device `ref_select` has always used for its
 *     vocabulary terms, and the reason a published listing keeps printing the
 *     copy it was published with however the category is edited afterwards.
 *  2. The IDENTITY table — `{value: v, label: v}` — for a row written before
 *     that release, which carries no `labels` key at all. That is exactly the
 *     table a TRANSLATABLE catalogue would have produced, since its labels ARE
 *     its keys, so such a listing still reads out of the host's bundle. A
 *     NON-translatable catalogue has no key to look up and keeps showing the
 *     slug until the listing is re-projected: a visible `b-u` gets fixed, an
 *     invented "Used" ships wrong.
 *
 * Either table is then read the one way `formatFeatureValue` reads any option
 * table — literal when the config says `translatable_options: false`, through
 * the host's `t` otherwise, where a translatable catalogue's label IS the key
 * and an unknown key comes back unchanged. Nothing on that path is
 * special-cased here, and nothing about it changed.
 */
import type { FeatureDef, FeatureValueDto } from "@stapel/attributes-react";
import type { ListingFeatureDao, ListingFeatureView } from "../api/types.js";

/**
 * Keys that belong to the DAO envelope rather than to the type's config.
 *
 * `labels` is deliberately NOT one of them, even though this module now reads
 * it: `ref_select` and `ref_hierarchical_select` resolve their vocabulary
 * terms from `config.labels` (attributes-react's `refLabels` reads the value
 * envelope first and the config second, and this split hands the formatter a
 * bare `{type, value}`), so envelope-ing the key would blank every term those
 * two types print. For `select` the key is simply inert — its formatter reads
 * `options` and nothing else — so carrying it costs a reference.
 */
const ENVELOPE = new Set(["slug", "value", "name", "order", "title", "badge"]);

/** The two types whose stored `value` is an option key rather than the thing
 * itself. `hierarchical_select` is deliberately absent: its formatter joins
 * the path with " / " and never consults an option table at all. */
const OPTION_VALUED = new Set(["select"]);

/** The canon's `FeatureDef.translate` vocabulary — three values, closed. */
function isTranslateMode(value: unknown): value is "all" | "title" | "none" {
  return value === "all" || value === "title" || value === "none";
}

/**
 * The option table a stored `select` needs and does not carry — see the
 * module header. Built from the row's `labels` snapshot when there is one,
 * from the values themselves when there is not.
 *
 * The alignment rule is the engine's own (`labels if len(labels) ==
 * len(codes) else codes`): a snapshot of a different length than `value` is a
 * snapshot of some other value list, and pairing the two anyway would print
 * one option's copy against another option's value — worse than a slug,
 * because it does not LOOK wrong. So a length mismatch drops the whole
 * snapshot back to identity rather than pairing the overlap. Within a usable
 * snapshot, a missing or empty entry falls back to its own value for that one
 * pair.
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
  const raw: readonly unknown[] = Array.isArray(dao.value)
    ? (dao.value as readonly unknown[])
    : [dao.value];
  const snapshot: unknown = dao.labels;
  const labels: readonly unknown[] | undefined =
    Array.isArray(snapshot) && snapshot.length === raw.length
      ? (snapshot as readonly unknown[])
      : undefined;

  const table: { value: string; label: string }[] = [];
  raw.forEach((value, index) => {
    if (typeof value !== "string") return;
    const label = labels?.[index];
    table.push({
      value,
      label: typeof label === "string" && label.length > 0 ? label : value,
    });
  });
  return table.length === 0 ? undefined : table;
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
    // `translate` is a CLOSED vocabulary in the canon (`all` / `title` /
    // `none`), and the stored row types it as a loose string. A value outside
    // the three is dropped rather than smuggled through: `FeatureDef`'s own
    // default is `all`, which is what the engine falls back to anyway.
    ...(isTranslateMode(dao.translate) ? { translate: dao.translate } : {}),
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
