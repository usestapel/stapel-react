/**
 * The draft a composer holds, and its two conversions to the wire.
 *
 * stapel-listings stores every user-editable field TWICE: `title_draft` beside
 * `title`, `images_draft` beside `images`, and so on. `publish` promotes the
 * draft half onto the published half; nothing else does. So a composer edits
 * exactly one side of that twin, and this module is where the browser's
 * shape (plain values keyed the way a form keys them) meets the wire's
 * (`*_draft` fields plus the `{slug: {type, value}}` feature envelope).
 *
 * Everything here is PURE — no React, no fetch — so the round trip is
 * testable without mounting anything, and so `test/compose.test.tsx` can
 * assert the BODY a save sends rather than the fact that it sent one.
 */
import type { FeatureDef, FeaturesDto } from "@stapel/attributes-react";
import {
  fromFeaturesDto,
  mirrorValidate,
  toFeaturesDto,
} from "@stapel/attributes-react";
import type {
  ListingDetail,
  ListingDraft,
  ListingDraftPatch,
} from "../api/types.js";
import { DEFAULT_LISTING_CURRENCY } from "../api/types.js";

/**
 * Where the listing is, as ONE value.
 *
 * A composite because the four members only make sense together: a `lat`
 * without a `lon` is not "half a location", it is a broken one, and a
 * `geohash` that disagrees with the coordinates beside it is worse than no
 * geohash — the pin and the bucket point at different places.
 *
 * `geohash` is SERVER-COMPUTED and read-only since stapel-listings 0.7.1.
 * `Listing.save()` stamps `geohash_draft` from `lat_draft`/`lon_draft` through
 * the `geo.geohash_encode` comm function, and `ListingDraftSerializer` marks
 * the field `readOnly` — a value sent in the request body is silently ignored.
 * So this member is something the composer READS BACK (a reopened draft, a
 * published listing) and never something it sends: `draftPatchFromValues`
 * omits it, and a picker that happens to know a geohash may keep it for its
 * own display without expecting the wire to carry it.
 */
export interface ListingLocation {
  /** Opaque id from whatever place directory the deployment uses. */
  readonly locationId: string;
  /** What a person reads: "Kazan, Vahitovsky district". */
  readonly locationLabel: string;
  /** Decimal STRING, as the wire spells it — a float here would round-trip
   * `55.796100` into `55.7961` and change what was submitted. */
  readonly lat: string | null;
  readonly lon: string | null;
  /** Read-only: the server computes it from `lat`/`lon` (0.7.1). Never sent. */
  readonly geohash: string;
}

export const EMPTY_LOCATION: ListingLocation = {
  locationId: "",
  locationLabel: "",
  lat: null,
  lon: null,
  geohash: "",
};

/**
 * Everything a composer edits.
 *
 * `features` holds PLAIN values keyed by slug — what a value editor's
 * `onChange` produces — never the DTO envelope. The envelope is built at send
 * time by `toFeaturesDto`, which tags each value with its type from the
 * category schema; a composer that stored tagged values would have to
 * re-tag them on every category change.
 */
export interface ListingDraftValues {
  readonly categoryId: string;
  readonly title: string;
  readonly description: string;
  /** Decimal string, or `""` for "no price yet". */
  readonly price: string;
  readonly currency: string;
  readonly language: string;
  /** CDN references (`<type>/<hash>`) — ORDER IS THE GALLERY ORDER, and the
   * first one is the cover. This is exactly `bag.refs` from
   * `@stapel/cdn-react`'s upload queue; see `headless/ListingComposer.tsx`. */
  readonly images: readonly string[];
  readonly location: ListingLocation;
  readonly features: Readonly<Record<string, unknown>>;
  /** A countable good (a quantity applies) vs a service. */
  readonly countable: boolean;
  readonly stockQuantity: number | null;
  readonly autoRepublish: boolean;
}

export interface EmptyDraftOptions {
  readonly categoryId?: string;
  readonly currency?: string;
  readonly language?: string;
}

/** A blank draft. `currency` defaults to the storefront's (owner verdict F6 —
 * RUB), overridable per runtime and per call. */
export function emptyDraftValues(
  options: EmptyDraftOptions = {}
): ListingDraftValues {
  return {
    categoryId: options.categoryId ?? "",
    title: "",
    description: "",
    price: "",
    currency: options.currency ?? DEFAULT_LISTING_CURRENCY,
    language: options.language ?? "",
    images: [],
    location: EMPTY_LOCATION,
    features: {},
    countable: false,
    stockQuantity: null,
    autoRepublish: false,
  };
}

function text(value: string | null | undefined): string {
  return value ?? "";
}

/**
 * A reopened draft: the server's `*_draft` fields → the composer's values.
 *
 * `features_draft` is `null` on a listing nobody has filled in yet, which is
 * not the same as `{}` on the wire but is the same thing to a composer.
 */
export function draftValuesFromWire(
  draft: ListingDraft,
  options: EmptyDraftOptions = {}
): ListingDraftValues {
  const base = emptyDraftValues(options);
  return {
    categoryId: text(draft.category_id),
    title: text(draft.title_draft),
    description: text(draft.description_draft),
    price: text(draft.price_draft),
    currency: draft.currency !== undefined && draft.currency.length > 0
      ? draft.currency
      : base.currency,
    language: text(draft.language),
    images: draft.images_draft ?? [],
    location: {
      locationId: text(draft.location_id_draft),
      locationLabel: text(draft.location_label_draft),
      lat: draft.lat_draft ?? null,
      lon: draft.lon_draft ?? null,
      geohash: text(draft.geohash_draft),
    },
    features: fromFeaturesDto((draft.features_draft ?? {}) as FeaturesDto),
    countable: draft.countable ?? false,
    stockQuantity: draft.stock_quantity ?? null,
    autoRepublish: draft.auto_republish ?? false,
  };
}

/**
 * Editing something already PUBLISHED: the published half → the composer.
 *
 * A live listing's `*_draft` fields hold whatever was last submitted, which
 * after a publish is the same content — but a listing published before this
 * pair existed, or one whose draft was cleared, would open empty. Seeding
 * from the PUBLISHED fields is what makes "edit" show the listing a person
 * can actually see. Feature values come back from the DAO projection, which
 * is the one place the published values live.
 */
export function draftValuesFromDetail(
  detail: ListingDetail,
  featuresDto: FeaturesDto,
  options: EmptyDraftOptions = {}
): ListingDraftValues {
  const base = emptyDraftValues(options);
  return {
    // `text()` for the same reason as the draft seed above: 0.21.4 answers
    // `category_id: null` for a row created before its category was chosen,
    // and a seed that took it verbatim put `null` where a string is declared
    // and crashed the first control that measured its length.
    categoryId: text(detail.category_id),
    title: text(detail.title),
    description: text(detail.description),
    price: text(detail.price),
    currency: detail.currency !== undefined && detail.currency.length > 0
      ? detail.currency
      : base.currency,
    language: text(detail.language),
    images: detail.images ?? [],
    location: {
      locationId: text(detail.location_id),
      locationLabel: text(detail.location_label),
      lat: detail.lat ?? null,
      lon: detail.lon ?? null,
      geohash: text(detail.geohash),
    },
    features: fromFeaturesDto(featuresDto),
    countable: detail.countable ?? false,
    stockQuantity: detail.stock_quantity ?? null,
    autoRepublish: detail.auto_republish ?? false,
  };
}

/** The wire's shape for `features_draft`: since stapel-listings 0.6.1 fixed
 * the discriminator, this is a map of properly discriminated DTOs. */
type WireFeaturesDraft = NonNullable<ListingDraftPatch["features_draft"]>;

/**
 * The ONE boundary between the two descriptions of a feature value.
 *
 * `toFeaturesDto` speaks the engine's own structural shape (`{type: string,
 * value: unknown}` plus whatever a type adds) — it has to, because the type
 * vocabulary is an OPEN registry server-side (`EXTRA_TYPES`, runtime
 * `register_feature_type`), so a deployment can legitimately submit a type
 * this generated union has never heard of. The generated union describes the
 * ten BUILTIN types precisely, which is exactly right for reading and one
 * notch too narrow for writing.
 *
 * Rather than widen the wire type or narrow the engine's, the conversion is
 * named here, once, with the reason attached. A cast scattered at call sites
 * would be the same code with nowhere to write this down.
 */
function toWireFeatures(
  features: readonly FeatureDef[],
  values: Readonly<Record<string, unknown>>
): WireFeaturesDraft {
  return toFeaturesDto(features, values) as unknown as WireFeaturesDraft;
}

/** One field of the `save-draft` body, by the name the wire uses. */
export type ListingDraftField = keyof ListingDraftPatch;

/** Options for {@link draftPatchFromValues}. */
export interface DraftPatchOptions {
  /**
   * NAME THE FIELDS THIS SAVE IS WRITING, and the body carries no others.
   *
   * `save-draft` REPLACES every field in the body — it does not merge — so a
   * body is not "the values I have", it is "the fields I am claiming". A save
   * fired by one control (a photo settling, a blurred title) previously
   * claimed all fourteen, which is only harmless while every one of them is
   * loaded and true.
   *
   * Given, only these keys are spelled; the omission rules below still apply
   * inside the selection, so naming `features_draft` without a schema still
   * writes nothing. Absent, the whole body is sent, which is right for the
   * composer's own save — it holds every value on the form.
   */
  readonly fields?: readonly ListingDraftField[];
}

/**
 * The composer's values → the `save-draft` body.
 *
 * `features` needs the category schema to be tagged, so it is passed in. A
 * feature the schema no longer declares is dropped by `toFeaturesDto` only if
 * it is absent from `features`; keeping a stale slug in the payload would be
 * refused per-feature by 0.6.0's M-7 rule
 * (`error.400.listing_feature_not_allowed`), which is why
 * {@link retainKnownFeatureValues} prunes on the way in rather than letting
 * the server explain it.
 *
 * ── NO SCHEMA IS NOT AN EMPTY ANSWER SHEET ───────────────────────────────
 *
 * An absent or empty `features` used to produce `features_draft: {}`, and
 * `save-draft` REPLACES that map rather than merging into it — so a save that
 * left before the category's schema arrived DELETED every characteristic the
 * row was holding, while the form on screen still showed them. Measured by a
 * live container over two cold loads of one draft: a reopen's own
 * settled-photo save fires in the first commit, before the row's category has
 * even been adopted, and the row alternated between the draft's answers and
 * none of them (a client storefront's README, "Named gaps").
 *
 * `{}` is a claim — "this listing has no characteristics" — and a caller with
 * no schema is in no position to make it. So the key is OMITTED entirely
 * whenever there is no schema to tag values with, and `save-draft` then
 * leaves the stored map exactly as it was. A category that genuinely declares
 * no features writes nothing either, which is the same answer arrived at
 * honestly: there is nothing to say and the row already says it.
 *
 * {@link DraftPatchOptions.fields} is the general form of the same rule — a
 * save that names what it is writing cannot erase what it is not.
 */
export function draftPatchFromValues(
  values: ListingDraftValues,
  features: readonly FeatureDef[] | undefined,
  options: DraftPatchOptions = {}
): ListingDraftPatch {
  const full: ListingDraftPatch = {
    // Omitted while unchosen rather than sent as `""`: a draft is allowed to
    // have no category (0.21.4), and `""` is not "no category" on the wire —
    // it is an empty id the serializer refuses. The category is written by
    // whichever save follows the pick.
    ...(values.categoryId.length > 0 ? { category_id: values.categoryId } : {}),
    title_draft: values.title,
    description_draft: values.description,
    price_draft: values.price.length > 0 ? values.price : null,
    currency: values.currency,
    ...(values.language.length > 0 ? { language: values.language } : {}),
    images_draft: [...values.images],
    location_id_draft: values.location.locationId,
    location_label_draft: values.location.locationLabel,
    // No `geohash_draft`: stapel-listings 0.7.1 computes it in `Listing.save()`
    // from the coordinates and marks the serializer field read-only, so a value
    // sent here is discarded. Sending one would be a claim the wire ignores.
    lat_draft: values.location.lat,
    lon_draft: values.location.lon,
    // Omitted, not emptied, when there is no schema to tag with — see the
    // doc above. `{}` is a claim about the listing; silence is not.
    ...(features !== undefined && features.length > 0
      ? { features_draft: toWireFeatures(features, values.features) }
      : {}),
    countable: values.countable,
    // The pair mirrors the model's cross-field rule rather than sending a
    // contradiction: a service carries no quantity, and `validate_countable
    // _stock` refuses a `stock_quantity` beside `countable: false`.
    stock_quantity: values.countable ? values.stockQuantity : null,
    auto_republish: values.autoRepublish,
  };
  const named = options.fields;
  if (named === undefined) return full;
  // A selection, not a second body: the field's VALUE is still whatever the
  // rules above produced, so a named field the rules omit stays omitted.
  const wanted = new Set<string>(named);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(full)) {
    if (wanted.has(key)) out[key] = value;
  }
  return out as ListingDraftPatch;
}

/**
 * The body for CREATING a draft: the category if there is one, `{}` if there
 * is not.
 *
 * `perform_create` forces `owner` and `status`, and everything else has a
 * model default, so a create that also carried the form's current contents
 * would be a second write of data the very next `save-draft` sends anyway —
 * and would fail the whole submission on a field the person could still fix.
 * Create the row, then save into it.
 *
 * `{}` IS a valid create body since stapel-listings 0.21.4 made `category_id`
 * nullable on a draft: a draft may exist before its category is chosen, and
 * `publish` is where the category becomes mandatory (`publish_validation
 * _failed` naming `category_id`). Not being able to create the row first is
 * what left an analysis job addressed by the draft id with no id to start
 * from (D261).
 */
export function createDraftBody(categoryId?: string): ListingDraftPatch {
  return categoryId !== undefined && categoryId.length > 0
    ? { category_id: categoryId }
    : {};
}

/**
 * A SHARED SLUG IS NOT A SHARED ANSWER (D455).
 *
 * Retention used to ask one question — "does the new schema declare this
 * slug?" — and a slug is the cheapest half of the answer. Measured on the
 * live stand, 2026-09-12: the analysis read a photo as the wristwatch leaf
 * and answered the colour with `zolotoy`, which that leaf offers; the
 * category was then corrected to the laptop leaf, which declares `color` too
 * and therefore KEPT the value — but its sixteen options spell gold
 * `zolotistyy`, not `zolotoy`. The control drew the raw code, the mirror
 * refused it `not_in_options`, and the publish gate shut on the colour field
 * over a row the catalogue marks OPTIONAL and the server publishes without
 * (`validate-draft` -> `valid: true`). The seller cannot read the demand and
 * the gate cannot be cleared by answering what it names.
 *
 * So the question is asked of the VALUE: a retained answer must be one the
 * new schema would accept. The judge is `mirrorValidate` — the very function
 * the publish gate reads — so a value kept here can never be one the gate
 * refuses, and the two cannot drift. Same invariant `acceptableAiWrites`
 * states for the analysis's writes, now held for the person's own.
 *
 * Only a value that is BOTH present and non-blank can be dropped this way.
 * A blank one has nothing to lose, and its `mandatory_missing` row is a
 * demand for an answer rather than a verdict on one — naming it as "dropped"
 * would tell a person their answer did not apply when they never gave one.
 * A rule set the mirror cannot parse fails the batch on `_root` and drops
 * nothing: the schema is broken, not the draft.
 */
function judgeRetention(
  values: Readonly<Record<string, unknown>>,
  features: readonly FeatureDef[]
): { readonly kept: Record<string, unknown>; readonly dropped: string[] } {
  const known = new Set(features.map((feature) => feature.slug));
  const kept: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [slug, value] of Object.entries(values)) {
    if (known.has(slug)) kept[slug] = value;
    else dropped.push(slug);
  }

  let refused: ReadonlySet<string>;
  try {
    const batch = mirrorValidate(features, toFeaturesDto(features, kept));
    refused = new Set(
      batch.results
        .filter((result) => result.status !== "ok")
        .map((result) => result.slug)
    );
  } catch {
    // A schema this build cannot judge is not a reason to delete answers.
    return { kept, dropped: dropped.sort() };
  }

  const survived: Record<string, unknown> = {};
  for (const [slug, value] of Object.entries(kept)) {
    if (refused.has(slug) && answeredFeatureValue(value)) dropped.push(slug);
    else survived[slug] = value;
  }
  return { kept: survived, dropped: dropped.sort() };
}

/**
 * Does this value count as an answer? An empty list is what clearing the last
 * chip leaves behind — an unanswered field, not an answer of `[]`.
 */
function answeredFeatureValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

/**
 * Switching category: keep the answers the new schema also asks for AND would
 * accept, drop the rest.
 *
 * Spec §4.1 asks for exactly this, and the reason is the same one the forms
 * spec gives for `error.409.forms_version_superseded`: a person who picked
 * "Phones", filled in Brand and Condition, then realised they meant "Used
 * phones" should not retype what both categories ask for. A value whose slug
 * is gone IS dropped, because 0.6.0 rejects an unknown slug per feature —
 * carrying it would turn a category change into a publish refusal about a
 * field the composer no longer draws. Since 0.30.2 a value whose slug SURVIVES
 * but which the new schema refuses is dropped for the same reason, which is
 * the harm rather than the mechanism — see {@link judgeRetention}.
 */
export function retainKnownFeatureValues(
  values: Readonly<Record<string, unknown>>,
  features: readonly FeatureDef[]
): Readonly<Record<string, unknown>> {
  return judgeRetention(values, features).kept;
}

/** Slugs that were answered and the new schema will not carry — what
 * {@link retainKnownFeatureValues} just dropped, whether because the slug is
 * gone or because the answer is not one this category offers. A composer
 * tells the person ("2 answers do not apply to this category") instead of
 * losing them silently. */
export function droppedFeatureSlugs(
  values: Readonly<Record<string, unknown>>,
  features: readonly FeatureDef[]
): readonly string[] {
  return judgeRetention(values, features).dropped;
}
