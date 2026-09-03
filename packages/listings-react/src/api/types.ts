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

/**
 * The engagement fields, named off the GENERATED row so a rename upstream
 * breaks the build here rather than going quiet on a grid.
 *
 * These were hand-written mirrors while this pair's contract pin sat at
 * `>=0.12 <0.13` and the emitted schema could not see stapel-listings
 * 0.16/0.17. The pin has landed, so the mirrors are gone and the names come
 * from `Schemas["ListingCard"]`. What is kept is the OPTIONALITY, and that is
 * not laziness:
 *
 * **A generated type is a promise about the contract, not about the bytes a
 * particular deployment sends.** The schema says every card carries `viewed`
 * and `view_count`; a storefront pointed at a server still running 0.15 gets
 * rows without them, and the two surfaces this feature exists for — a feed
 * and a SERP — are served by the SEARCH index, whose stored document carries
 * neither by construction. `Partial` is what keeps `model/engagement.ts`
 * allowed to ask, and every reader there answers "absent" with the same
 * silence it answers `null` with.
 */
export type ListingEngagementFields = Partial<
  Pick<Schemas["ListingCard"], "viewed" | "view_count">
>;

/** A generated row with its engagement fields relaxed to optional — see
 * {@link ListingEngagementFields} for why every row type below is spelled
 * this way rather than taken from `Schemas` whole. */
type WithOptionalEngagement<Row extends ListingEngagementFields> = Omit<
  Row,
  keyof ListingEngagementFields
> &
  ListingEngagementFields;

/**
 * The per-viewer overlay for ONE listing, as the batch read answers it.
 *
 * Note what is REQUIRED here and optional on the row: the overlay always
 * carries all three keys, because it is the answer to a question that was
 * actually asked. A row that carries none of them was serialized by a build
 * that had never heard of them.
 */
export type ListingEngagement = Schemas["ListingEngagement"];

/**
 * `GET /listings/engagement/?ids=…` 200 — `{listing id: overlay}`.
 *
 * The keys are the ids as STRINGS (a DRF `DictField`), and an id with no
 * listing is simply absent rather than present-and-empty. Both facts are why
 * `model/engagement.ts` looks entries up through one function instead of
 * indexing the object at call sites.
 */
export type ListingEngagementBatch = Schemas["ListingEngagementBatch"];

/**
 * The most ids one overlay call may carry — `ENGAGEMENT_BATCH_LIMIT`
 * upstream, which silently TRUNCATES anything longer ("one page of cards, not
 * a crawl of the board").
 *
 * Mirrored here so the truncation happens where it can be seen and named
 * rather than in a response that quietly came back short. A page of more than
 * a hundred cards is not a page; a caller that has one should ask per screen.
 */
export const LISTINGS_ENGAGEMENT_BATCH_LIMIT = 100;

/**
 * Normalize the ids on a page into the exact list the request sends.
 *
 * Sorted, de-duplicated, non-integer values dropped, capped at
 * {@link LISTINGS_ENGAGEMENT_BATCH_LIMIT}. Sorting is what makes the cache
 * key honest: the answer is a MAP keyed by id, so two renders that ask for
 * the same ids in different orders are asking the identical question and must
 * not buy two cache entries and two requests. De-duplication is the same
 * argument for a grid that shows one listing twice (a promoted slot above the
 * organic result it also occupies).
 *
 * `queryKeys.engagement` and `api.engagement` are both built from THIS, so
 * the key cannot drift from the request it stands for.
 */
export function engagementIds(ids: readonly number[]): readonly number[] {
  const seen = new Set<number>();
  for (const id of ids) {
    if (Number.isInteger(id)) seen.add(id);
  }
  return [...seen].sort((a, b) => a - b).slice(0, LISTINGS_ENGAGEMENT_BATCH_LIMIT);
}

/** `GET /listings/{pk}/` 200 — everything a detail page reads. */
export type ListingDetail = WithOptionalEngagement<Schemas["ListingDetail"]>;

/**
 * One row of a card list (`GET /listings/`, `GET /listings/my/favorites/`) —
 * and the PROP every card component in this pair takes, which is why its
 * engagement fields are optional where the schema makes them required.
 *
 * The schema is right about this module's own responses: `GET /listings/`
 * carries `viewed` and `view_count` on every row. But the card components are
 * handed rows from elsewhere, and the most important elsewhere is the SEARCH
 * index — `@stapel/search-react` fills `renderCard` with a stored document
 * that cannot hold a per-reader flag by construction. Requiring the fields on
 * the prop would make the pair's primary consumer unable to satisfy its own
 * type, for data no one can supply; it is precisely the case
 * `<ListingEngagementScope>` exists to answer. A deployment running a server
 * older than 0.16 is the same shape of fact.
 *
 * `geo_precision_km` is relaxed for the same reason and by the same argument.
 * stapel-listings 0.21.0 puts it on every card this module serves — how wide
 * an area `lat`/`lon` describe, so a reader draws a circle instead of pinning
 * a private seller's front door with a marker — and the SEARCH document does
 * not carry it, because stapel-search coarsens its own card independently
 * (`CARD_COORD_PRECISION`, the same ~1.1km). Requiring it on the prop would
 * make the pair's primary consumer unable to satisfy its own type for a
 * number nobody in that path holds. A reader that needs the precision must
 * treat its absence as UNSTATED and never as `0`: `0` means the exact point,
 * which is the one reading that could publish an address.
 */
type WithOptionalPrecision<Row extends { geo_precision_km?: number }> = Omit<
  Row,
  "geo_precision_km"
> &
  Partial<Pick<Schemas["ListingCard"], "geo_precision_km">>;

export type ListingCard = WithOptionalPrecision<
  WithOptionalEngagement<Schemas["ListingCard"]>
>;

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

/** The keyset envelope both public card lists come back in
 * (`IDAnchorPagination`). */
export type PaginatedListingCards = Omit<
  Schemas["PaginatedListingCardList"],
  "items"
> & {
  items: ListingCard[];
};

/**
 * One row of `GET /listings/my/listings/` — the OWNER's card.
 *
 * A superset of {@link ListingCard}, and the two additions are the two things
 * only an owner is owed (stapel-listings 0.7.0, `MyListingCardSerializer`):
 *
 *  - `moderation_status`, the second axis. `model/status.ts` argues at length
 *    that a dashboard cannot derive "your edit is being screened" from
 *    `status` — a re-published LIVE listing keeps `status: "published"` and
 *    moves only this field. The public card omits it, so before 0.7.0 the
 *    dashboard row passed `"approved"` as an honest stand-in and simply could
 *    not show the row that most needed showing.
 *  - the `*_draft` twins. `title`/`price`/`images` are the PUBLISHED fields
 *    and are empty on a listing that has never been published, so a drafts
 *    tab keyed off them is a column of blank rows. `myListingTitle` /
 *    `myListingPrice` (`model/mine.ts`) are the one place the fallback lives.
 */
export type MyListingCard = WithOptionalPrecision<
  WithOptionalEngagement<Schemas["MyListingCard"]>
>;

/** The keyset envelope `GET /listings/my/listings/` comes back in — the same
 * `IDAnchorPagination` shape as {@link PaginatedListingCards}, over the owner
 * row. */
export type PaginatedMyListingCards = Omit<
  Schemas["PaginatedMyListingCardList"],
  "items"
> & {
  items: MyListingCard[];
};

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

/**
 * One move the OWNER of a listing may make from where it is now — the third
 * axis, and the one stapel-listings 0.20.0 added because the first two cannot
 * answer it.
 *
 * `status` says where the listing IS and `moderation_status` says what is
 * being waited on. Neither says *what can I do about it*, and a dashboard
 * that works it out for itself is re-implementing `models.OWNER_TRANSITIONS`
 * from the outside — which is how a cabinet ends up drawing "Mark sold" on a
 * listing that is already sold, and drawing no way back at all.
 *
 * The values are lifecycle states (the DESTINATION of a move), so this is
 * `ListingLifecycleStatus` narrowed by the server rather than a second
 * vocabulary.
 */
export type ListingOwnerTransition = Schemas["AvailableTransitionsEnum"];

/** The four content-moderation states, as `models.ModerationStatus` declares
 * them. Independent of the lifecycle: see `model/status.ts`. */
export const MODERATION_STATUSES: readonly ListingModerationStatus[] = [
  // NOBODY HAS ASKED YET, and it is the DEFAULT (stapel-listings 0.20.0).
  // Before it, a draft was born `pending` and every dashboard row announced a
  // moderation decision that no case existed behind — one live stand held 167
  // of them. The distinction lives in the data because every reader asks the
  // same question and would each otherwise re-derive "…unless it was never
  // submitted" from a second column.
  "not_submitted",
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
  /**
   * The write-time LABEL SNAPSHOT: the copy each entry of `value` had when the
   * listing was stored, positionally aligned with it, one entry per value.
   * `ref_select`/`ref_hierarchical_select` have always carried it (their codes
   * name vocabulary terms no display package can reach) and `select` carries
   * it from the release that snapshots option copy — so it is OPTIONAL, and a
   * row stored before that one has no key at all. `model/features.ts` reads
   * it, and says what a row without it falls back to.
   */
  readonly labels?: readonly string[];
  /** Display name or translation key; falls back to the slug. */
  readonly name?: string | null;
  readonly order?: number | null;
  /** Part of the listing's title line. */
  readonly title?: boolean | null;
  /** Rendered as a badge on the card. */
  readonly badge?: boolean | null;
  readonly translate?: string | null;
  /**
   * Which audience may READ the stored value (stapel-attributes 0.8.1).
   * Stamped into the DAO at write time and absent on a public row, so an
   * existing row is byte-identical. `owner`/`staff` mark an identifier of one
   * physical unit — a VIN, an IMEI, a serial — which stapel-listings 0.12.0
   * withholds from a reader who is not entitled to it.
   */
  readonly visibility?: string | null;
  /**
   * `true` on a **stub**: the row survived redaction as its own identity with
   * no value at all (`RedactedFeatureDao`). It is kept in place and in order
   * so the public spec table has the same rows as the seller's own — a buyer
   * can see the field exists rather than not knowing it was ever asked.
   */
  readonly redacted?: boolean;
  /**
   * On a stub: whether the seller actually filled the withheld value in.
   * A FACT this system observed, and the only one it has — see
   * {@link ListingFeatureDao.verification}.
   */
  readonly present?: boolean;
  /**
   * On a stub: the result of an outside check of the value, passed through
   * redaction verbatim. **Absent for everything in the fleet today** — no
   * product runs a VIN or an IMEI check — which is exactly why `present`
   * alone may never be rendered as "verified". stapel-attributes deliberately
   * leaves the `status` vocabulary to whichever product runs the check.
   */
  readonly verification?: Readonly<Record<string, unknown>>;
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

/** Query parameters of every keyset-paginated card list. */
export interface ListingPageParams {
  /** Opaque cursor from a previous answer. */
  readonly anchor?: string;
  readonly direction?: "next" | "prev" | "center";
  readonly limit?: number;
}

/**
 * `GET /listings/my/listings/` — a page, plus the statuses to narrow to.
 *
 * `status` is a SET because a dashboard tab is one (`active` is
 * `published` + `pending`, `drafts` is `draft` + `rejected` — the groupings
 * are the server's, copied in `model/status.ts` so a tab's rows and its count
 * cannot describe different sets). An empty or absent array means every
 * status, which is what the route answers with no parameter at all.
 *
 * On the wire it goes as one comma-separated value; stapel-listings accepts
 * that and the repeated-parameter spelling interchangeably
 * (`views.parse_status_filter`). An unknown value is a `400`
 * `error.400.listing_invalid_status_filter`, not an empty page — so a status
 * this pair does not know about cannot silently look like "you have none".
 */
export interface MyListingsParams extends ListingPageParams {
  readonly status?: readonly ListingLifecycleStatus[];
}

/**
 * The currency a composer starts a new listing in.
 *
 * RUB by owner verdict F6 (storefront spec, the owner's
 * fork verdicts of 2026-08-22), and a default rather than a constant: `currency` is
 * a free `maxLength: 8` string on the wire (stapel-listings has no currency
 * enum — the vocabulary lives in stapel-currencies), so a deployment that
 * sells in something else passes its own through `createListingsRuntime`.
 */
export const DEFAULT_LISTING_CURRENCY = "RUB";
