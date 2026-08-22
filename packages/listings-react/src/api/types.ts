/**
 * Wire types for the stapel-listings HTTP contract — **derived from the
 * generated OpenAPI surface** (frontend-standard §2/§3), never hand-maintained.
 * The single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-listings' OWN `docs/schema.json`).
 *
 * Two notes about the polymorphic feature union, one of them now HISTORY and
 * kept because the reason it is history is the useful part:
 *
 * 1. **The discriminator is correct as of stapel-listings 0.6.1, and was not
 *    in 0.6.0.** 0.6.0 declared `discriminator: {propertyName: "type",
 *    mapping: {"null": ConvertibleUnitDao}}` — one bogus entry instead of the
 *    ten type slugs — and openapi-typescript answers that by stripping `type`
 *    from every member and re-adding a SYNTHETIC discriminant, so the
 *    generated `IntDao` said `type: "IntDao"` where the wire sends `"int"`.
 *    `@stapel/categories-react` hit the same defect one directory over and
 *    routed around it. 0.6.1 emits the ten slugs (and an upstream contract
 *    test now holds them there), so `Schemas["FeatureDao"]` and
 *    `Schemas["FeatureDto"]` discriminate on the real values and ARE the wire
 *    types this pair uses. What still comes from
 *    `@stapel/attributes-react` is the behaviour — the editors, the mirror,
 *    the formatter — which is the spec's L0 seam and never was a workaround.
 *
 * 2. **A stored DAO carries `slug`; the schema's `FeatureDao` does not.**
 *    `features`/`features_title`/`features_badges` are `ListingFeaturesOutput
 *    Field`, a plain `serializers.JSONField` whose OpenAPI *description* is
 *    swapped for the DAO union by an extension (`stapel-listings/
 *    serializers.py`). A JSONField filters nothing: what reaches the wire is
 *    what `build_features_list` stored, and that is `{**dao, "slug": slug}`
 *    (`services/features.py`). The slug is load-bearing — it is how a card
 *    keys a badge and how a refusal finds its control — so {@link
 *    ListingFeatureDao} mirrors the runtime shape and says why.
 */
import type { FeatureConfig, FeatureDef, FeatureValueDto } from "@stapel/attributes-react";
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

/** `GET /listings/{pk}/` 200 — everything a detail page reads. */
export type ListingDetail = Schemas["ListingDetail"];

/** One row of a card list (`GET /listings/`, `GET /listings/my/favorites/`). */
export type ListingCard = Schemas["ListingCard"];

/** `POST /listings/` request+response and `POST /{pk}/save-draft/` response —
 * the draft twin. Every user-editable field is a `*_draft` one, promoted onto
 * its published sibling by `publish`. */
export type ListingDraft = Schemas["ListingDraft"];

/** The partial body a `save-draft` write sends. */
export type ListingDraftPatch = Schemas["PatchedListingDraft"];

/** `GET /{pk}/status/` 200 — the AllowAny status probe, and the ONLY read that
 * still answers for a soft-deleted listing (`Listing.all_objects`). */
export type ListingStatusInfo = Schemas["ListingStatus"];

/** `GET /my/counters/` 200 — the three dashboard tab counts. */
export type MyCounters = Schemas["MyCountersResponse"];

/** `POST /{pk}/publish/` 200. The 400 is a `ValidationBatchResult`, NOT an
 * error envelope — see `model/validation.ts`. */
export type PublishResponse = Schemas["PublishResponse"];

/** `POST /{pk}/archive|complete/` 200. */
export type ListingActionResponse = Schemas["ListingActionResponse"];

/** `POST /{pk}/favorite|unfavorite/` 200. */
export type FavoriteToggleResponse = Schemas["FavoriteToggleResponse"];

/** `DELETE /{pk}/` 200. */
export type DeleteResponse = Schemas["DeleteResponse"];

/** The keyset envelope both card lists come back in (`IDAnchorPagination`). */
export type PaginatedListingCards = Schemas["PaginatedListingCardList"];

/**
 * The nine lifecycle states, as `models.ListingStatus` declares them.
 *
 * A runtime array and not only a type, because the dashboard's own table of
 * expected captions is asserted over it — a status added upstream turns
 * `test/status.test.ts` red instead of rendering as a bare enum value.
 */
export const LISTING_STATUSES: readonly ListingLifecycleStatus[] = [
  "draft",
  "pending",
  "published",
  "paused",
  "expired",
  "sold",
  "rejected",
  "blocked",
  "archived",
];

/** One lifecycle state. THE field that decides public visibility — and the
 * only one (`models.py`: "no visibility-reads-moderation_status coupling"). */
export type ListingLifecycleStatus = Schemas["StatusD41Enum"];

/** The four content-moderation states, as `models.ModerationStatus` declares
 * them. Independent of the lifecycle: see `model/status.ts`. */
export const MODERATION_STATUSES: readonly ListingModerationStatus[] = [
  "pending",
  "approved",
  "rejected",
  "needs_review",
];

/** One moderation state. Decides NOTHING about visibility. */
export type ListingModerationStatus = Schemas["ModerationStatusEnum"];

/**
 * The ten value types, straight out of the generated discriminated union.
 *
 * Not a hand-written list: `Schemas["FeatureDao"]["type"]` is the union of the
 * ten `discriminator.mapping` keys, so a type registered upstream widens this
 * automatically and a type REMOVED upstream reddens every exhaustive switch
 * over it. That is only true because 0.6.1 fixed the mapping (header, note 1).
 */
export type ListingFeatureType = Schemas["FeatureDao"]["type"];

/** The generated union itself, for a consumer that wants to narrow a row
 * exhaustively by `type`. `featureFromDao` deliberately does not — it hands
 * the whole row to `@stapel/attributes-react`, which switches on the same
 * discriminant at runtime and is the one place that knows what each type's
 * `value` means. */
export type ListingFeatureDaoUnion = Schemas["FeatureDao"];

/**
 * One stored feature projection, as it actually arrives.
 *
 * The DAO is the value TOGETHER with the display configuration its type
 * needs — `prefix`, `postfix`, `precision`, `trueLabel`, `maxSelected`, … all
 * ride along beside `value`. That is why a card can render a badge without
 * fetching the category schema: everything `formatFeatureValue` reads is in
 * the row. `featureFromDao` (`model/features.ts`) is the one place that
 * splits it back into the `(FeatureDef, FeatureValueDto)` pair
 * `@stapel/attributes-react` formats.
 *
 * `slug` is declared REQUIRED here even though the schema omits it — see this
 * file's header, note 2. A DAO without one is a stored row this build cannot
 * key, and `featureFromDao` says so rather than inventing an index. The index
 * signature is the other half of the same fact: the field is a `JSONField`,
 * so what the row carries is what was stored, not what the union describes.
 */
export interface ListingFeatureDao {
  readonly slug: string;
  /** The VALUE type slug — the axis `@stapel/attributes-react` switches on.
   * Typed from the generated union, optional because a malformed stored row
   * can lack it and a JSONField will pass that through. */
  readonly type?: ListingFeatureType;
  readonly value?: unknown;
  /** Display name or translation key; falls back to the slug. */
  readonly name?: string | null;
  readonly order?: number | null;
  /** Part of the listing's title line. */
  readonly title?: boolean | null;
  /** Rendered as a badge on the card. */
  readonly badge?: boolean | null;
  readonly translate?: string | null;
  /** The type's own config keys (`prefix`, `precision`, `unitType`, …). */
  readonly [key: string]: unknown;
}

/** The `(definition, value)` pair `@stapel/attributes-react` formats. */
export interface ListingFeatureView {
  readonly feature: FeatureDef;
  readonly value: FeatureValueDto | undefined;
}

/** Re-exported so a consumer types a feature config without also depending on
 * `@stapel/attributes-react` directly. */
export type { FeatureConfig, FeatureDef, FeatureValueDto };

/** Query parameters of both keyset-paginated card lists. */
export interface ListingPageParams {
  /** Opaque cursor from a previous answer. */
  readonly anchor?: string;
  readonly direction?: "next" | "prev" | "center";
  readonly limit?: number;
}

/**
 * The currency a composer starts a new listing in.
 *
 * RUB by owner verdict F6 (`tasks/darom-storefront-design.md`, the owner's
 * fork verdicts of 2026-08-22), and a default rather than a constant: `currency` is
 * a free `maxLength: 8` string on the wire (stapel-listings has no currency
 * enum — the vocabulary lives in stapel-currencies), so a deployment that
 * sells in something else passes its own through `createListingsRuntime`.
 */
export const DEFAULT_LISTING_CURRENCY = "RUB";
