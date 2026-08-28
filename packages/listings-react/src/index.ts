/**
 * `@stapel/listings-react` — the headless React pair for stapel-listings
 * (frontend-standard §2). Business + state only, zero visual opinion; the
 * antd skin lives behind the `./default` subpath, so a host that renders its
 * own shop window carries none of it.
 *
 * ── The one-liner ──────────────────────────────────────────────────────────
 *
 * ```tsx
 * const runtime = createListingsRuntime({
 *   baseUrl: "/listings/api/v1/",
 *   resolveImage: (ref) => myCdn.describe(ref),
 * });
 * <ListingsProvider runtime={runtime}>
 *   <ListingDetailPane id={id} />
 * </ListingsProvider>
 * ```
 *
 * ── The four properties this pair exists to guarantee ──────────────────────
 *
 * 1. **Two axes, both on screen, neither standing in for the other.**
 *    `status` decides visibility and nothing else does; `moderation_status`
 *    decides nothing about it. Since stapel-listings 0.5.0 they genuinely
 *    diverge — an edit to a LIVE listing keeps `status: published` and moves
 *    only the moderation axis — so "published, changes under review" is a
 *    sentence this pair can say, and a dashboard that computed either field
 *    from the other could not. `model/status.ts` produces both halves from
 *    both fields, once, and the 9 × 4 table is asserted.
 * 2. **A refusal lands on the control that caused it.** `publish` answers an
 *    invalid draft with a BARE `ValidationBatchResult` (not an error
 *    envelope), and the engine's rows carry `{feature, slug}` and never
 *    `field`. `model/validation.ts` splits the two kinds of 400 apart and
 *    `featureErrorsBySlug` adds the routing key, so "this box is wrong" never
 *    degrades into "something is wrong".
 * 3. **Every switched-off control states its reason.** Signing in, waiting
 *    for photos, a type this build cannot draw, a lifecycle move the server
 *    would refuse — each is an `ActionAvailability` with a named block, never
 *    a grey button and never a hidden one.
 * 4. **An absence is never rendered as a zero.** A soft-deleted listing says
 *    it was removed rather than 404-ing like a typo; a stored feature this
 *    build cannot read is counted rather than dropped; an empty dashboard tab
 *    says WHICH emptiness it is; and a moderation takedown — the one status
 *    `my/counters` counts in no tab at all — is shown outside the tabs rather
 *    than falling out of the screen (`headless/MyListings.tsx`).
 *
 * ── The seams, and why they are not imports ────────────────────────────────
 *
 * `@stapel/cdn-react` and `@stapel/categories-react` are L2 pairs, and L2
 * pairs never import each other. The gallery therefore arrives as a
 * structural {@link ListingImagesBag} (satisfied by cdn's upload bag: its
 * `refs` IS `images_draft` and its `settled` is the submit gate), the
 * category schema arrives as a plain `FeatureDef[]`, and a stored image
 * reference is resolved by a host-supplied {@link ListingImageResolver} —
 * because no contract in this fleet resolves a stranger's CDN reference, and
 * a pair that invented a URL convention would be writing a contract nobody
 * agreed to. `@stapel/attributes-react` IS a dependency; it is L0.
 *
 * Layers: api → model → flows → headless → i18n. Generated surfaces (the
 * typed schema, the error map, the manifest, the nav manifest, llms.txt) are
 * produced by the monorepo `gen:*` drivers from stapel-listings' own `docs/`
 * artifacts and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createListingsApi } from "./api/listingsApi.js";
export type { ListingsApi } from "./api/listingsApi.js";
export {
  DEFAULT_LISTING_CURRENCY,
  LISTING_STATUSES,
  MODERATION_STATUSES,
} from "./api/types.js";
export type {
  DeleteResponse,
  FavoriteToggleResponse,
  FeatureConfig,
  FeatureDef,
  FeatureValueDto,
  ListingActionResponse,
  ListingCard,
  ListingDetail as ListingDetailData,
  ListingDraft,
  ListingDraftPatch,
  ListingFeatureDao,
  ListingFeatureDaoUnion,
  ListingFeatureType,
  ListingFeatureView,
  ListingLifecycleStatus,
  ListingModerationStatus,
  ListingPageParams,
  ListingStatusInfo,
  MyCounters,
  MyListingCard,
  MyListingsParams,
  PaginatedListingCards,
  PaginatedMyListingCards,
  PublishResponse,
  Schemas,
} from "./api/types.js";

// ── model: the two axes ──────────────────────────────────────────────────────
export {
  MY_LISTINGS_TABS,
  MY_LISTINGS_TAB_STATUSES,
  MY_LISTINGS_UNTABBED_STATUSES,
  isPubliclyVisible,
  lifecycleCaption,
  listingStatusView,
  moderationNotice,
  tabOf,
} from "./model/status.js";
export type {
  LifecycleCaption,
  ListingStatusTone,
  ListingStatusView,
  ModerationNotice,
  MyListingsTab,
} from "./model/status.js";
export { LISTING_TRANSITIONS, canDelete, canTransition } from "./model/transitions.js";

// ── model: the owner's own rows ──────────────────────────────────────────────
export { defaultMyListingsSource } from "./model/mineSource.js";
export type { MyListingsSource } from "./model/mineSource.js";
export {
  myListingImages,
  myListingPrice,
  myListingTitle,
  showsDraft,
} from "./model/mine.js";

// ── model: the draft twin ────────────────────────────────────────────────────
export {
  EMPTY_LOCATION,
  createDraftBody,
  draftPatchFromValues,
  draftValuesFromDetail,
  draftValuesFromWire,
  droppedFeatureSlugs,
  emptyDraftValues,
  retainKnownFeatureValues,
} from "./model/draft.js";
export type {
  EmptyDraftOptions,
  ListingDraftValues,
  ListingLocation,
} from "./model/draft.js";

// ── model: the stored feature projection ─────────────────────────────────────
export {
  asFeatureDaoList,
  featureFromDao,
  featuresDtoFromDaoList,
  featuresFromDaoList,
  unreadableFeatureCount,
} from "./model/features.js";

// ── model: validation, the mirror and the publish-400 split ──────────────────
export {
  CATEGORY_FIELD,
  DEFAULT_DRAFT_LIMITS,
  DESCRIPTION_FIELD,
  IMAGES_FIELD,
  PRICE_FIELD,
  TITLE_FIELD,
  failedResults,
  isBatchValid,
  listingFieldErrors,
  mirrorDraft,
  mirrorListingFields,
  publishRefusal,
} from "./model/validation.js";
export type { ListingDraftLimits, PublishRefusal } from "./model/validation.js";

// ── model: runtime wiring, query keys, context, hooks ────────────────────────
export { createListingsRuntime } from "./model/runtime.js";
export type {
  CreateListingsRuntimeOptions,
  ListingImageResolver,
  ListingsRuntime,
} from "./model/runtime.js";
export {
  ListingsRuntimeContext,
  useListingsAnalytics,
  useListingsApi,
  useListingsRuntime,
} from "./model/context.js";
export { listingsQueryKeys, pageKey } from "./model/queryKeys.js";
export type { ListingPageKey } from "./model/queryKeys.js";
export {
  useListing,
  useListingCards,
  useListingStatus,
  useMyCounters,
  useMyFavorites,
  useValidateDraft,
} from "./model/queries.js";
export {
  useArchiveListing,
  useCompleteListing,
  useCreateDraft,
  useDeleteListing,
  useFavoriteListing,
  usePublishListing,
  useSaveDraft,
} from "./model/mutations.js";
export type { FavoriteInput, SaveDraftInput } from "./model/mutations.js";

// ── flows (zero-flow shim — stapel-listings annotates none) ──────────────────
export { LISTINGS_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  FlowEndpoint,
  ListingsFlowId,
  ListingsFlowSpec,
} from "./flows/registry.js";

// ── headless (renderless components + their bags) ────────────────────────────
export { ListingsProvider } from "./headless/ListingsProvider.js";
export {
  useMandateGate,
  useElevatableMandateGate,
  LISTINGS_ELEVATION_ACTIONS,
} from "./headless/useMandateGate.js";
export { ListingDetail, useListingDetail } from "./headless/ListingDetail.js";
export type {
  ListingDetailBag,
  UseListingDetailOptions,
} from "./headless/ListingDetail.js";
export { ListingComposer, useListingComposer } from "./headless/ListingComposer.js";
export type {
  ComposeStage,
  ListingComposerBag,
  ListingImagesBag,
  PublishOutcome,
  UseListingComposerOptions,
} from "./headless/ListingComposer.js";
export { MyListings, useMyListings } from "./headless/MyListings.js";
export type {
  MyListingsBag,
  UseMyListingsOptions,
} from "./headless/MyListings.js";
export { Favorites, useFavorites, useFavoriteToggle } from "./headless/Favorites.js";
export type {
  FavoriteToggleBag,
  FavoritesBag,
  UseFavoritesOptions,
} from "./headless/Favorites.js";
export { useListingActions } from "./headless/ListingActions.js";
export type { ListingActionsBag } from "./headless/ListingActions.js";

// ── nav manifest (the pair's public surface declaration) ─────────────────────
export { ACCOUNT_ROOT_ID, navEntries } from "./nav/manifest.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  LISTINGS_I18N_KEYS,
  listingsI18nBundleEn,
  registerListingsI18n,
} from "./i18n/keys.js";
export type { ListingsI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  LISTINGS_ERRORS,
  LISTINGS_ERROR_CODES,
  LISTING_CANNOT_DELETE_ACTIVE,
  LISTING_INVALID_TRANSITION,
  LISTING_NOT_OWNER,
  LISTING_PUBLISH_VALIDATION_FAILED,
  explainListingsError,
  listingsErrorBundleEn,
} from "./i18n/errorsMap.js";
export type {
  ListingsErrorCode,
  ListingsErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
