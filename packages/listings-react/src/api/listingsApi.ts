import type { StapelClient } from "@stapel/core";
import type {
  DeleteResponse,
  FavoriteToggleResponse,
  ListingActionResponse,
  ListingDetail,
  ListingEngagementBatch,
  ListingDraft,
  ListingDraftPatch,
  ListingPageParams,
  ListingStatusInfo,
  MyCounters,
  MyListingsParams,
  PaginatedListingCards,
  PaginatedMyListingCards,
  PublishResponse,
} from "./types.js";
import type { ValidationBatchResult } from "@stapel/attributes-react";
import { engagementIds } from "./types.js";

/**
 * The pair's typed operation surface — one method per stapel-listings endpoint
 * a storefront may call, bound to the injected {@link StapelClient} (the
 * per-module override seam of frontend-standard §7.2). Paths are relative to
 * the runtime's `baseUrl` (`/listings/api/v1/`).
 *
 * ── The two operations that are on the contract and NOT here ───────────────
 *
 * `PUT /{pk}/` and `PATCH /{pk}/` are absent. That began as a safety decision:
 * until stapel-listings 0.6.2 both were the plain `ModelViewSet`
 * implementations under `IsAuthenticatedOrReadOnly` over
 * `Listing.objects.all()`, so any authenticated caller could write any
 * listing's draft fields through them — this pair filed the ask and declined
 * to be the client that exercised the hole. 0.6.2 put `views._get_own` in
 * front of both, so the hole is closed and the absence is now a plain scope
 * decision: `POST /{pk}/save-draft/` performs the SAME write (the same
 * `ListingDraftSerializer`, `partial=True`) and one write path is enough.
 * Both stay in the generated schema and therefore in `manifest.json`.
 *
 * These operations will be GENERATED from schema.json operationIds by gen-api
 * v2 (task `core-typed-ops`); until then they are hand-authored here (the ONE
 * legal home of path strings — `stapel/no-string-paths` §2.3 carve-out).
 */
export interface ListingsApi {
  readonly client: StapelClient;

  /**
   * One keyset page of PUBLISHED cards.
   *
   * Two things this is not, both worth stating because the storefront spec
   * assumed otherwise at one point:
   *
   *  - It is not "my listings". `get_queryset` answers `qs.published()` for
   *    `list` and takes no owner parameter, so this endpoint cannot be
   *    narrowed to the caller. See `headless/MyListings.tsx` for what the
   *    dashboard does about that.
   *  - It is not the storefront grid either. A marketplace's result page goes
   *    through `@stapel/search-react`, because `promoted` (DSA Art. 26) rides
   *    every search item under every sort and a card list that carried the
   *    marking on some pages and not others would be worse than one that
   *    never claimed it. This exists for a host with no search module and for
   *    the "more from this category" strip a detail page may want.
   */
  list(
    params?: ListingPageParams,
    options?: { readonly signal?: AbortSignal }
  ): Promise<PaginatedListingCards>;

  /**
   * One listing in full.
   *
   * Since 0.6.2 the queryset is `visible_to(user)` — the indexed statuses for
   * everyone plus one's OWN rows in any status — so a stranger's draft 404s
   * from the same code path an absent id does. The `publiclyVisible` report
   * `useListing` derives from `status` (`model/status.ts`) stays, and is now
   * addressed at the one reader who still reaches an unpublished listing
   * here: its owner, who needs to be told it is not on the shelf.
   */
  retrieve(
    id: number,
    options?: { readonly signal?: AbortSignal }
  ): Promise<ListingDetail>;

  /**
   * The AllowAny status probe: both axes plus `is_deleted` / `is_expired` /
   * `is_active` / `owner_id`.
   *
   * It reads `Listing.all_objects`, so it is the only operation that still
   * answers for a SOFT-DELETED listing — which is exactly what turns a bare
   * 404 on the detail into "this listing was removed".
   */
  status(
    id: number,
    options?: { readonly signal?: AbortSignal }
  ): Promise<ListingStatusInfo>;

  /** Counts by dashboard tab for the caller (`active` / `archived` /
   * `drafts`). Server-side definitions, not the pair's: `active` folds
   * PENDING in with PUBLISHED, `drafts` folds REJECTED in with DRAFT. */
  myCounters(options?: { readonly signal?: AbortSignal }): Promise<MyCounters>;

  /**
   * One keyset page of the caller's OWN listings, in every status.
   *
   * The route `list` is not and cannot be made into: `list` answers
   * `published()` and takes no owner parameter, so before stapel-listings
   * 0.7.0 a seller's own DRAFTS were unreachable by any call this contract
   * offered — the gap `model/mineSource.ts` used to name on screen. Owner
   * scope is a property of the ROUTE (`owned_by(request.user)`), not of a
   * parameter a caller supplies, so there is no way to point it at anyone
   * else.
   *
   * `params.status` narrows to a set of lifecycle statuses; omit it for all
   * nine. Rows are {@link MyListingCard} — the public card plus
   * `moderation_status` and the `*_draft` twins.
   */
  myListings(
    params?: MyListingsParams,
    options?: { readonly signal?: AbortSignal }
  ): Promise<PaginatedMyListingCards>;

  /** One keyset page of the caller's favourites. */
  myFavorites(
    params?: ListingPageParams,
    options?: { readonly signal?: AbortSignal }
  ): Promise<PaginatedListingCards>;

  /**
   * The per-viewer OVERLAY for a whole page of cards, in one call.
   *
   * `{listing id: {view_count, viewed, is_favorited}}`, with an id that has
   * no listing simply absent. This is the endpoint that makes the engagement
   * flags visible on the two surfaces that matter: a storefront's feed and
   * its SERP are served by the SEARCH index, whose stored card cannot hold a
   * flag that differs per reader or a counter that moves faster than a
   * re-index, so the grid draws the card from search and asks HERE for the
   * three things that are about the person looking.
   *
   * `AllowAny` upstream, deliberately: `view_count` is public and both
   * per-viewer flags answer `null` for a guest, so a storefront makes the
   * same request signed in or not and a guest's grid is not a second code
   * path.
   *
   * Ids are normalized by `engagementIds` before they get here — sorted,
   * de-duplicated and capped at `LISTINGS_ENGAGEMENT_BATCH_LIMIT`, because
   * the server TRUNCATES a longer list rather than refusing it and a short
   * answer to a long question is the kind of absence this pair does not
   * render.
   */
  engagement(
    ids: readonly number[],
    options?: { readonly signal?: AbortSignal }
  ): Promise<ListingEngagementBatch>;

  /**
   * Start a draft. `category_id` is the only required member: the server
   * forces `owner=request.user` and `status=draft` in `perform_create`, so a
   * body that tried to set either is writing a field it does not own.
   */
  createDraft(body: ListingDraftPatch): Promise<ListingDraft>;

  /**
   * Persist draft fields. Always partial — send what moved.
   *
   * Refuses with the DRF field-error envelope (`error.400.field.*`) on a
   * declarative violation (`title_draft` over 255, a negative price, a
   * `stock_quantity` that contradicts `countable`).
   */
  saveDraft(id: number, body: ListingDraftPatch): Promise<ListingDraft>;

  /**
   * Ask what publishing WOULD say, without publishing. Same validator as
   * `publish` (`services.publish.validate_draft`), so the two cannot disagree
   * — including on an unknown feature slug, which 0.6.0's M-7 convergence
   * made a per-feature refusal (`error.400.listing_feature_not_allowed`)
   * rather than an opaque failure at publish time.
   */
  validateDraft(
    id: number,
    options?: { readonly signal?: AbortSignal }
  ): Promise<ValidationBatchResult>;

  /**
   * Promote the draft.
   *
   * TWO distinct 400s, and a caller must tell them apart:
   *  - an INVALID DRAFT answers with a bare {@link ValidationBatchResult}
   *    body — no `localizable_error`, no envelope — which core wraps as
   *    `stapel.http.400` with the batch on `StapelApiError.body`;
   *  - a promotion that then fails (`REQUIRE_IMAGE_ON_PUBLISH` with no photo)
   *    answers the ordinary envelope `error.400.publish_validation_failed`.
   * `model/validation.ts` owns that split so no screen re-derives it.
   *
   * On success the returned `status` is `pending` for a first publication and
   * stays `published` for an edit to a LIVE listing — the 0.5.0
   * re-moderation semantics the whole dashboard is built around.
   */
  publish(id: number): Promise<PublishResponse>;

  /** Move to ARCHIVED. `error.409.invalid_listing_transition` with
   * `params.from_status` when the lifecycle does not allow it. */
  archive(id: number): Promise<ListingActionResponse>;

  /** Mark SOLD. Same 409 contract as {@link archive}. */
  complete(id: number): Promise<ListingActionResponse>;

  /** Favourite a listing. Idempotent server-side (`get_or_create`). */
  favorite(id: number): Promise<FavoriteToggleResponse>;

  /** Un-favourite. Idempotent: deleting nothing still answers 200. */
  unfavorite(id: number): Promise<FavoriteToggleResponse>;

  /**
   * Soft-delete. Ownership-checked (unlike PUT/PATCH — see the header) and
   * refused with `error.409.listing_cannot_delete_active` while the listing
   * is PUBLISHED or PENDING: archive it first.
   */
  remove(id: number): Promise<DeleteResponse>;
}

function pageQuery(
  params: ListingPageParams | undefined
): Record<string, string | number | undefined> {
  return {
    ...(params?.anchor !== undefined ? { anchor: params.anchor } : {}),
    ...(params?.direction !== undefined ? { direction: params.direction } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
  };
}

/**
 * The `?status=` half of a `my/listings` query.
 *
 * One comma-separated value rather than a repeated parameter: both spellings
 * are accepted upstream, and this one survives every `query` serializer a
 * host's `StapelClient` might carry without depending on how it encodes an
 * array. An empty set sends nothing at all — the route's own "every status".
 */
function statusQuery(
  statuses: readonly string[] | undefined
): Record<string, string> {
  return statuses !== undefined && statuses.length > 0
    ? { status: statuses.join(",") }
    : {};
}

function signal(
  options: { readonly signal?: AbortSignal } | undefined
): { signal?: AbortSignal } {
  return options?.signal !== undefined ? { signal: options.signal } : {};
}

/** The collection root and the one place a listing id becomes a path. */
const COLLECTION = "/listings/";
function listingPath(id: number): string {
  return `${COLLECTION}${String(id)}/`;
}

export function createListingsApi(client: StapelClient): ListingsApi {
  return {
    client,

    list: (params, options) =>
      client.get(COLLECTION, { query: pageQuery(params), ...signal(options) }),

    retrieve: (id, options) => client.get(listingPath(id), signal(options)),

    status: (id, options) =>
      client.get(`${listingPath(id)}status/`, signal(options)),

    myCounters: (options) =>
      client.get(`${COLLECTION}my/counters/`, signal(options)),

    myListings: (params, options) =>
      client.get(`${COLLECTION}my/listings/`, {
        query: { ...pageQuery(params), ...statusQuery(params?.status) },
        ...signal(options),
      }),

    myFavorites: (params, options) =>
      client.get(`${COLLECTION}my/favorites/`, {
        query: pageQuery(params),
        ...signal(options),
      }),

    // One comma-separated value rather than a repeated parameter, for the
    // reason `statusQuery` gives: both spellings are accepted upstream
    // (`getlist("ids")` then splits on commas), and this one survives every
    // `query` serializer a host's own StapelClient might carry.
    engagement: (ids, options) =>
      client.get(`${COLLECTION}engagement/`, {
        query: { ids: engagementIds(ids).join(",") },
        ...signal(options),
      }),

    createDraft: (body) => client.post(COLLECTION, body),

    saveDraft: (id, body) => client.post(`${listingPath(id)}save-draft/`, body),

    validateDraft: (id, options) =>
      client.get(`${listingPath(id)}validate-draft/`, signal(options)),

    publish: (id) => client.post(`${listingPath(id)}publish/`),

    archive: (id) => client.post(`${listingPath(id)}archive/`),

    complete: (id) => client.post(`${listingPath(id)}complete/`),

    favorite: (id) => client.post(`${listingPath(id)}favorite/`),

    unfavorite: (id) => client.post(`${listingPath(id)}unfavorite/`),

    remove: (id) => client.delete(listingPath(id)),
  };
}
