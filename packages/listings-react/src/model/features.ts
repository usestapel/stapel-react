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
 * ── What a DAO does NOT carry, and the tables that repair it ───────────────
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
 * So the split below rebuilds the table, from the best of three sources:
 *
 *  1. The LABEL SNAPSHOT. A `select` DAO written by a stapel-attributes that
 *     snapshots labels carries `labels`, a `string[]` positionally aligned
 *     with `value` — the same device `ref_select` has always used for its
 *     vocabulary terms, and the reason a published listing keeps printing the
 *     copy it was published with however the category is edited afterwards.
 *  2. The CATEGORY's own option table, when the display surface has it —
 *     `GET /categories/api/v1/categories/{id}/features/` answers with
 *     `{"slug":"condition","config":{"type":"select","options":[…]}}`, labels
 *     and all. It is handed in through {@link FeatureCopySource}, because a
 *     library may not fetch another module's endpoint and a card grid has no
 *     category to fetch one FOR.
 *  3. The IDENTITY table — `{value: v, label: v}` — for a value neither of the
 *     first two names. That is exactly the table a TRANSLATABLE catalogue
 *     would have produced, since its labels ARE its keys, so such a value
 *     still reads out of the host's bundle; a NON-translatable one keeps
 *     showing the slug. A visible `b-u` gets fixed by rung 1 or 2, and an
 *     invented "Used" ships wrong, so the floor stays the value itself.
 *
 * ── Which rung wins, and why that order and not the other one ──────────────
 *
 * The SNAPSHOT outranks the category. The snapshot is what the listing was
 * PUBLISHED with; the category is what the catalogue says today. A category
 * whose option copy was rewritten after a listing went live must not silently
 * restate that listing — the person reading it is reading an advert somebody
 * else wrote, not a form. The category outranks identity, which is the whole
 * point: every listing published before the snapshot release, and every row
 * written by an older server, has no snapshot to outrank it and prints its
 * slug today.
 *
 * A category def that does not describe the STORED row — a different value
 * type, or no such slug — is ignored rather than forced. A category edited
 * from `select` to `string` is a different question, and pairing its options
 * against this row's values would print one question's copy under another
 * question's answer, which does not even LOOK wrong.
 *
 * With no category defs supplied, every rung above 1 is absent and the
 * projection behaves exactly as it did.
 *
 * ── The category path is the REPAIR path, not the mechanism ────────────────
 *
 * The primary mechanism is the server's, and it is the snapshot: stapel-
 * attributes writes `labels` beside a `select`'s codes exactly as it always
 * has for `ref_select`, and stapel-listings ships a reprojection command that
 * back-fills rows written before it. Nothing here competes with that. Rung 2
 * exists for the three states that outlive that deploy:
 *
 *   - a row written before the snapshot existed and not yet reprojected;
 *   - a deployment that never runs the reprojection;
 *   - a category whose option copy was edited AFTER publication — where the
 *     snapshot is deliberately the older and correct answer, which is exactly
 *     why the precedence runs the way it does above.
 *
 * The resulting table is then read the one way `formatFeatureValue` reads any
 * option table — literal when the config says `translatable_options: false`,
 * through the host's `t` otherwise, where a translatable catalogue's label IS
 * the key and an unknown key comes back unchanged. The flag stays the ROW's:
 * it describes how the listing's own stored config wants its copy resolved,
 * and an unknown key resolves to itself either way.
 */
import type { FeatureDef, FeatureValueDto } from "@stapel/attributes-react";
import { featureType, isRedactedValue } from "@stapel/attributes-react";
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
const ENVELOPE = new Set([
  "slug",
  "value",
  "name",
  "order",
  "title",
  "badge",
  // ── The visibility axis (stapel-attributes 0.8.1 / stapel-listings 0.12.0) ──
  //
  // These four are envelope for exactly the reason the six above are: they
  // describe the ROW, not the type, and no formatter has ever read one. But
  // they matter more than the others, because the alternative is not noise —
  // it is a marker reaching the display BY ACCIDENT, through the index
  // signature, with nothing stating that it did.
  //
  // `visibility` is a genuine `FeatureDef` field and is lifted onto the
  // definition below; `redacted`/`present`/`verification` describe THIS
  // reader's access to THIS stored value, so they ride the value envelope,
  // which is where `@stapel/attributes-react`'s predicates read them.
  "visibility",
  "redacted",
  "present",
  "verification",
]);

/** The type whose stored `value` is a flat list of option keys rather than the
 * things themselves, and whose copy therefore has to be repaired pairwise.
 * `ref_select` is absent because it repairs itself: its `labels` snapshot has
 * always been mandatory (no display package can reach a vocabulary term). */
const OPTION_VALUED = new Set(["select"]);

/**
 * The type whose copy lives in a TREE on the category rather than in a flat
 * table: `hierarchical_select` stores a path of option keys and
 * `formatFeatureValue` walks `config.options` level by level to name each
 * step, so a row without that tree prints "passenger / sedan" — the storage
 * keys — exactly as a table-less `select` prints `b-u`.
 *
 * It is kept apart from {@link OPTION_VALUED} because the two repairs are not
 * the same repair: a flat positional `labels` list cannot describe a tree, so
 * there is nothing to merge and the category's tree is adopted whole or not at
 * all. `formatFeatureValue` already keeps a step the tree does not contain as
 * its raw value, so an adopted tree can only add copy, never blank one out.
 */
const TREE_VALUED = new Set(["hierarchical_select"]);

/** The canon's `FeatureDef.translate` vocabulary — three values, closed. */
function isTranslateMode(value: unknown): value is "all" | "title" | "none" {
  return value === "all" || value === "title" || value === "none";
}

/**
 * The stamped `FeatureDef.visibility`, or `undefined` when the row is public.
 *
 * `public` is stamped as nothing at all upstream (`dataclass_to_dict_no_none`
 * drops it), which is why an existing public row is byte-identical after the
 * axis landed — so an absent key means public and is dropped here too.
 *
 * A string that is NOT one of the three becomes `"staff"`, the most
 * restrictive one. Python raises `UnknownVisibility` on the same input; this
 * side has nobody to raise at, so it takes the only direction that cannot
 * leak — a typo must not publish a VIN. The engine normalizes at write time,
 * so this is the belt on a stored row nobody expects to see.
 */
function storedVisibility(value: unknown): "public" | "owner" | "staff" | undefined {
  if (typeof value !== "string" || value.length === 0 || value === "public") return undefined;
  return value === "owner" || value === "staff" ? value : "staff";
}

/** A `verification` result, when the row carries one. An object and nothing
 * else: the shape belongs to whichever product ran the check, and this
 * projection passes it through rather than describing it. */
function storedVerification(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Readonly<Record<string, unknown>>;
}

/**
 * The category's feature defs, for a display surface that has them.
 *
 * A detail page reads one listing of one category and its container usually
 * holds that category's schema already (it is the same read the composer is
 * given); a card grid spanning forty categories does not, and passes nothing.
 * Optional for exactly that reason: the seam adds a source of copy, it never
 * becomes a requirement, and a host that wires nothing keeps the behaviour it
 * has.
 */
export interface FeatureCopySource {
  /**
   * The chosen category's features, as
   * `GET /categories/api/v1/categories/{id}/features/` answers — the same
   * `readonly FeatureDef[]` `<ListingComposerPage>` already takes. Defs are
   * matched to stored rows by slug AND value type; anything else is ignored.
   */
  readonly categoryFeatures?: readonly FeatureDef[];
}

/** Category defs keyed by slug, or `undefined` when there are none to key —
 * built once per list so a 40-row projection is not 40 linear scans. */
type CategoryDefs = ReadonlyMap<string, FeatureDef>;

function categoryDefs(source: FeatureCopySource): CategoryDefs | undefined {
  const defs = source.categoryFeatures;
  if (defs === undefined || defs.length === 0) return undefined;
  const index = new Map<string, FeatureDef>();
  for (const def of defs) {
    // First wins: a duplicate slug in a category is a catalogue defect, and
    // silently preferring the last one would make the copy depend on the
    // order the endpoint happened to serialize.
    if (typeof def.slug === "string" && def.slug.length > 0 && !index.has(def.slug)) {
      index.set(def.slug, def);
    }
  }
  return index.size === 0 ? undefined : index;
}

/**
 * The category's definition OF THIS ROW, or `undefined`.
 *
 * Same slug and same value type, or it is not a definition of this row — see
 * the module header on why a mismatch is ignored rather than forced.
 */
function categoryDefFor(
  dao: ListingFeatureDao,
  defs: CategoryDefs | undefined
): FeatureDef | undefined {
  if (defs === undefined) return undefined;
  const def = defs.get(dao.slug);
  if (def === undefined) return undefined;
  return featureType(def) === dao.type ? def : undefined;
}

/** A category def's declared option list, when it declares one. */
function declaredOptions(def: FeatureDef | undefined): readonly unknown[] | undefined {
  const raw = def?.config?.["options"];
  return Array.isArray(raw) ? (raw as readonly unknown[]) : undefined;
}

/** One entry of an option list → its `(value, label)` pair, when it is one. */
function optionPair(entry: unknown): { value: string; label: string } | undefined {
  if (entry === null || typeof entry !== "object") return undefined;
  const option = entry as { value?: unknown; label?: unknown };
  if (typeof option.value !== "string" || option.value.length === 0) return undefined;
  return {
    value: option.value,
    label: typeof option.label === "string" && option.label.length > 0 ? option.label : option.value,
  };
}

/**
 * The option table a stored `select` needs and does not carry — see the
 * module header. The category's table underneath, the row's own `labels`
 * snapshot on top, the values themselves as the floor.
 *
 * The alignment rule is the engine's own (`labels if len(labels) ==
 * len(codes) else codes`): a snapshot of a different length than `value` is a
 * snapshot of some other value list, and pairing the two anyway would print
 * one option's copy against another option's value — worse than a slug,
 * because it does not LOOK wrong. So a length mismatch drops the whole
 * snapshot rather than pairing the overlap, and the row falls back to the
 * category (or to identity). Within a usable snapshot, a missing or empty
 * entry falls back to whatever the category, then the value itself, offers for
 * that one pair.
 *
 * Returns `undefined` when there is nothing to add (another type, a config
 * that already carries a table, a value that is not a list of strings and no
 * category table either), so the common path allocates nothing and a DAO that
 * DOES carry options is left exactly as it arrived — a stored table is a
 * write-time snapshot of the whole question, which is a stronger statement
 * about this listing than either the per-value snapshot or today's category.
 */
function selectOptions(
  dao: ListingFeatureDao,
  config: Readonly<Record<string, unknown>>,
  categoryDef: FeatureDef | undefined
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

  // A Map so the three rungs can overwrite one another by value instead of
  // the reader having to scan a list that carries the same value twice —
  // `labelOf` takes the FIRST match, so a duplicate would make the losing
  // rung win.
  const table = new Map<string, string>();
  for (const entry of declaredOptions(categoryDef) ?? []) {
    const pair = optionPair(entry);
    if (pair !== undefined) table.set(pair.value, pair.label);
  }
  raw.forEach((value, index) => {
    if (typeof value !== "string") return;
    const label = labels?.[index];
    if (typeof label === "string" && label.length > 0) table.set(value, label);
    else if (!table.has(value)) table.set(value, value);
  });
  if (table.size === 0) return undefined;
  return [...table].map(([value, label]) => ({ value, label }));
}

/**
 * The config keys that carry a value's UNIT, in the order they belong to.
 *
 * There is no generic `unit` key anywhere in this contract — the unit of an
 * `int`/`float` is its `postfix` (free text on the type's config, with
 * `postfix1000` as the abbreviated unit the engine switches to at a
 * thousand), and `convertible_unit` states its own with `unitType`/`unit_m`/
 * `unit_i`. `prefix` rides along because it is the same fact on the other
 * side of the number (a currency mark, a «~»).
 *
 * `precision` is deliberately NOT here. `dto_to_dao` writes it on every
 * numeric row (defaulted, never absent), so it could only ever be adopted
 * onto a row from some older server — where the stored value has already
 * been ROUNDED to the precision it was written with, and re-rendering it at
 * today's would print decimals the record does not contain.
 */
const UNIT_KEYS: readonly string[] = [
  "prefix",
  "postfix",
  "postfix1000",
  "unitType",
  "unit_m",
  "unit_i",
];

/**
 * The unit the CATEGORY declares, for a stored row that carries none.
 *
 * Measured on the live listing page: "Power 173", "Mileage 20000" — bare
 * numbers, in a deployment whose detail page holds the category's own feature
 * defs and passes them in for exactly this kind of repair. `dto_to_dao`
 * copies `postfix` at WRITE time, so a listing published before its category
 * gained a unit keeps printing without one for the rest of its life, and so
 * does every row written by a server that predates the key.
 *
 * Same rule as the option table two functions up, and for the same reason:
 * the stored row wins wherever it said anything, because it is what the
 * listing was published with, and the category fills only the silence. An
 * empty string counts as silence — `dto_to_dao` writes `postfix=None` as
 * absent, but a catalogue that once held `""` should not out-rank a
 * catalogue that now holds "km".
 */
function adoptedUnits(
  config: Readonly<Record<string, unknown>>,
  categoryDef: FeatureDef | undefined
): Readonly<Record<string, string>> | undefined {
  const declared = categoryDef?.config;
  if (declared === undefined) return undefined;
  const out: Record<string, string> = {};
  for (const key of UNIT_KEYS) {
    const stored = config[key];
    if (typeof stored === "string" && stored.length > 0) continue;
    const value = (declared as Readonly<Record<string, unknown>>)[key];
    if (typeof value === "string" && value.length > 0) out[key] = value;
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

/**
 * The category's option TREE, adopted whole for a `hierarchical_select` that
 * stored none — see {@link TREE_VALUED}.
 *
 * Nothing is merged and nothing is rewritten: the tree is the category's
 * structure, and this projection has no per-level snapshot with which to
 * disagree about it.
 */
function adoptedTree(
  dao: ListingFeatureDao,
  config: Readonly<Record<string, unknown>>,
  categoryDef: FeatureDef | undefined
): readonly unknown[] | undefined {
  if (typeof dao.type !== "string" || !TREE_VALUED.has(dao.type)) return undefined;
  if (Array.isArray(config["options"])) return undefined;
  return declaredOptions(categoryDef);
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
  dao: ListingFeatureDao,
  source: FeatureCopySource = {}
): ListingFeatureView | undefined {
  return featureView(dao, categoryDefs(source));
}

/** The work of {@link featureFromDao}, against an already-built index. */
function featureView(
  dao: ListingFeatureDao,
  defs: CategoryDefs | undefined
): ListingFeatureView | undefined {
  if (typeof dao.slug !== "string" || dao.slug.length === 0) return undefined;

  const config: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(dao)) {
    if (!ENVELOPE.has(key)) config[key] = value;
  }
  const categoryDef = categoryDefFor(dao, defs);
  const options =
    selectOptions(dao, config, categoryDef) ?? adoptedTree(dao, config, categoryDef);
  if (options !== undefined) config["options"] = options;
  const units = adoptedUnits(config, categoryDef);
  if (units !== undefined) Object.assign(config, units);

  const visibility = storedVisibility(dao.visibility);
  const feature: FeatureDef = {
    slug: dao.slug,
    config,
    name: dao.name ?? null,
    // `translate` is a CLOSED vocabulary in the canon (`all` / `title` /
    // `none`), and the stored row types it as a loose string. A value outside
    // the three is dropped rather than smuggled through: `FeatureDef`'s own
    // default is `all`, which is what the engine falls back to anyway.
    ...(isTranslateMode(dao.translate) ? { translate: dao.translate } : {}),
    // A genuine `FeatureDef` field, so it goes on the DEFINITION rather than
    // into `config`: it is what `isPublicFeature` reads to keep a hidden
    // value off a badge strip.
    ...(visibility !== undefined ? { visibility } : {}),
  };

  // A REDACTED STUB — a row this reader may not see — carries no `value` key
  // at all, and this envelope must not invent one. What it carries instead is
  // what the system honestly observed: `present` (did the seller answer) and,
  // reserved for the day some product actually runs a VIN or an IMEI check,
  // `verification`. `@stapel/attributes-react`'s `<FeatureValueList/>` reads
  // exactly these and prints "provided by the seller" — never "verified".
  //
  // The row is built even when `type` is missing, which the normal path below
  // refuses: an unkeyable value is a row a buyer cannot be told about, but a
  // stub's whole content is "this field exists and was answered", and that is
  // still true without a type slug.
  if (dao.redacted === true) {
    const verification = storedVerification(dao.verification);
    const stub: FeatureValueDto = {
      type: typeof dao.type === "string" ? dao.type : "",
      // No stored answer exists on this side of the wire. Spelled rather than
      // omitted only because `FeatureValueDto.value` is a required key;
      // `isBlank(undefined)` is true, so no formatter prints anything for it.
      value: undefined,
      redacted: true,
      present: dao.present === true,
      ...(verification !== undefined ? { verification } : {}),
    };
    return { feature, value: stub };
  }

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
  daos: readonly ListingFeatureDao[] | null | undefined,
  source: FeatureCopySource = {}
): readonly ListingFeatureView[] {
  const defs = categoryDefs(source);
  const out: ListingFeatureView[] = [];
  for (const dao of daos ?? []) {
    const view = featureView(dao, defs);
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
 *
 * ── Why a redacted stub is DROPPED here, and not passed through ────────────
 *
 * This is the EDIT envelope, and the only one that can destroy data. A stub
 * has no value; seeding an editor from it would put `undefined` in the
 * composer's draft under the seller's own slug, and the next save would write
 * that back — blanking a stored VIN the seller never touched and cannot see
 * was blanked. Dropping the row instead leaves the field empty in the form
 * and untouched in the record, which is the recoverable failure.
 *
 * A composer reopening a listing belongs to its OWNER, whose read is
 * unredacted, so a stub reaching this function means something upstream
 * already went wrong — a cached anonymous payload, a viewer id that did not
 * arrive, a host wiring the public detail into an edit form. It fails safe
 * rather than fails loudly on purpose: there is no honest recovery from "the
 * value was withheld from the person editing it", and refusing the whole seed
 * would take the other twenty answers down with it.
 *
 * {@link featureValuesForDisplay} is the other half of this split: a spec
 * table WANTS the stub, because "the seller answered this" is exactly what it
 * has to say.
 */
export function featuresDtoFromDaoList(
  daos: readonly ListingFeatureDao[] | null | undefined
): Readonly<Record<string, FeatureValueDto>> {
  const out: Record<string, FeatureValueDto> = {};
  for (const view of featuresFromDaoList(daos)) {
    if (view.value === undefined || isRedactedValue(view.value)) continue;
    out[view.feature.slug] = view.value;
  }
  return out;
}

/**
 * A stored projection → the envelope a DISPLAY component reads, redacted
 * stubs and all.
 *
 * Same shape as {@link featuresDtoFromDaoList} and a different job, which is
 * why it is a different function rather than a flag: a stub belongs in a spec
 * table (in place, in order, saying the seller answered) and must never reach
 * an editor. A boolean argument would put the destructive default one
 * forgotten parameter away.
 */
export function featureValuesForDisplay(
  daos: readonly ListingFeatureDao[] | null | undefined,
  source: FeatureCopySource = {}
): Readonly<Record<string, FeatureValueDto>> {
  const out: Record<string, FeatureValueDto> = {};
  for (const view of featuresFromDaoList(daos, source)) {
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
