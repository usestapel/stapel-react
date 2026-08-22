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
import { fromFeaturesDto, toFeaturesDto } from "@stapel/attributes-react";
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
 * The pair does NOT compute `geohash` from `lat`/`lon`, and that is a
 * decision. A geohash is precision-dependent, the indexer's bucketing depends
 * on which precision was used, and a client that picked its own would put
 * listings in neighbouring cells for reasons nobody could see. It is written
 * by whatever resolved the place (a geo picker, `stapel-geo`) and carried
 * verbatim from there to the wire.
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
    categoryId: detail.category_id,
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
 */
export function draftPatchFromValues(
  values: ListingDraftValues,
  features: readonly FeatureDef[]
): ListingDraftPatch {
  return {
    category_id: values.categoryId,
    title_draft: values.title,
    description_draft: values.description,
    price_draft: values.price.length > 0 ? values.price : null,
    currency: values.currency,
    ...(values.language.length > 0 ? { language: values.language } : {}),
    images_draft: [...values.images],
    location_id_draft: values.location.locationId,
    location_label_draft: values.location.locationLabel,
    geohash_draft: values.location.geohash,
    lat_draft: values.location.lat,
    lon_draft: values.location.lon,
    features_draft: toWireFeatures(features, values.features),
    countable: values.countable,
    // The pair mirrors the model's cross-field rule rather than sending a
    // contradiction: a service carries no quantity, and `validate_countable
    // _stock` refuses a `stock_quantity` beside `countable: false`.
    stock_quantity: values.countable ? values.stockQuantity : null,
    auto_republish: values.autoRepublish,
  };
}

/**
 * The body for CREATING a draft: `category_id` and nothing else.
 *
 * `perform_create` forces `owner` and `status`, and everything else has a
 * model default, so a create that also carried the form's current contents
 * would be a second write of data the very next `save-draft` sends anyway —
 * and would fail the whole submission on a field the person could still fix.
 * Create the row, then save into it.
 */
export function createDraftBody(categoryId: string): ListingDraftPatch {
  return { category_id: categoryId };
}

/**
 * Switching category: keep the answers whose slug the new schema also
 * declares, drop the rest.
 *
 * Spec §4.1 asks for exactly this, and the reason is the same one the forms
 * spec gives for `error.409.forms_version_superseded`: a person who picked
 * "Phones", filled in Brand and Condition, then realised they meant "Used
 * phones" should not retype what both categories ask for. A value whose slug
 * is gone IS dropped, because 0.6.0 rejects an unknown slug per feature —
 * carrying it would turn a category change into a publish refusal about a
 * field the composer no longer draws.
 */
export function retainKnownFeatureValues(
  values: Readonly<Record<string, unknown>>,
  features: readonly FeatureDef[]
): Readonly<Record<string, unknown>> {
  const known = new Set(features.map((feature) => feature.slug));
  const out: Record<string, unknown> = {};
  for (const [slug, value] of Object.entries(values)) {
    if (known.has(slug)) out[slug] = value;
  }
  return out;
}

/** Slugs that were answered and are NOT in the new schema — what
 * {@link retainKnownFeatureValues} just dropped. A composer tells the person
 * ("2 answers do not apply to this category") instead of losing them
 * silently. */
export function droppedFeatureSlugs(
  values: Readonly<Record<string, unknown>>,
  features: readonly FeatureDef[]
): readonly string[] {
  const known = new Set(features.map((feature) => feature.slug));
  return Object.keys(values)
    .filter((slug) => !known.has(slug))
    .sort();
}
