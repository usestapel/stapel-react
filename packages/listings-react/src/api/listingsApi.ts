import type { StapelClient } from "@stapel/core";
import type {
  DeleteResponse,
  FavoriteToggleResponse,
  ListingActionResponse,
  ListingDetail,
  ListingDraft,
  ListingDraftPatch,
  ListingPageParams,
  ListingStatusInfo,
  MyCounters,
  PaginatedListingCards,
  PublishResponse,
} from "./types.js";
import type { ValidationBatchResult } from "@stapel/attributes-react";

/**
 * The pair's typed operation surface — one method per stapel-listings endpoint
 * a storefront may call, bound to the injected {@link StapelClient} (the
 * per-module override seam of frontend-standard §7.2). Paths are relative to
 * the runtime's `baseUrl` (`/listings/api/v1/`).
 *
 * ── The two operations that are on the contract and NOT here ───────────────
 *
 * `PUT /{pk}/` and `PATCH /{pk}/` are absent, and this is the one place in
 * the pair where an absence is a safety decision rather than a scope one.
 * Every OWNER operation in this module routes through `views._get_own`, which
 * answers `error.403.listing_not_owner` when the caller is not the owner —
 * every one except these two. `update`/`partial_update` are the plain
 * `ModelViewSet` implementations under the viewset's default
 * `IsAuthenticatedOrReadOnly`, and `get_queryset` hands them
 * `Listing.objects.all()`: any authenticated caller can write any listing's
 * draft fields through them. `POST /{pk}/save-draft/` performs the SAME write
 * (the same `ListingDraftSerializer`, `partial=True`) with the ownership
 * check, so the pair uses it and nothing is lost. Both stay in the generated
 * schema and therefore in `manifest.json` — the contract is not hidden, this
 * pair simply declines to be the client that exercises it. Upstream ask,
 * recorded in MODULE.md: put `_get_own` in front of `update`/`partial_update`
 * (or drop them from the router).
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
   * `IsAuthenticatedOrReadOnly` + a queryset with no `published()` filter:
   * this answers for a DRAFT and for a BLOCKED listing too, to anyone who
   * knows the id. The pair does not pretend otherwise — `useListing` reports
   * `publiclyVisible` off `status` so a skin can say "this listing is not
   * published" instead of drawing a live-looking page (see `model/status.ts`,
   * and MODULE.md's upstream note).
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

  /** One keyset page of the caller's favourites. */
  myFavorites(
    params?: ListingPageParams,
    options?: { readonly signal?: AbortSignal }
  ): Promise<PaginatedListingCards>;

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

    myFavorites: (params, options) =>
      client.get(`${COLLECTION}my/favorites/`, {
        query: pageQuery(params),
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
