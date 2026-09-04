import type { StapelClient } from "@stapel/core";
import { fetchCategoryFeatures } from "./featuresRaw.js";
import type { CategoriesRawTransport } from "./featuresRaw.js";
import type {
  Category,
  CategoryFeaturesResult,
  CategoryListParams,
  CategoryPage,
  CategoryTreeNode,
  CategoryTreeParams,
  MaxRevision,
} from "./types.js";

/** Options `createCategoriesApi` needs beyond the JSON client, forwarded from
 * the runtime — see `api/featuresRaw.ts` for why `features()` needs its own
 * transport at all. */
export interface CategoriesApiOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  readonly defaultHeaders?: Record<string, string>;
}

/**
 * The pair's typed operation surface — one method per stapel-categories
 * endpoint a storefront may call, bound to the injected {@link StapelClient}
 * (the per-module override seam of frontend-standard §7.2). Paths are relative
 * to the runtime's `baseUrl` (`/categories/api/v1/`).
 *
 * ── Five reads, and the eighteen operations that are NOT here ──────────────
 *
 * The contract has 23 paths. Every one of them is on `ReadOnlyOrStaff`, which
 * means SAFE methods are open to anonymous callers and everything else needs
 * `is_staff` — so the split below is not a taste call, it is the permission
 * boundary drawn on the surface:
 *
 *  - **Public reads, and this pair's whole surface**: the category list (the
 *    delta-sync source), `children`, `carousel`, `{id}/features`, and
 *    `revision`.
 *  - **Staff writes**: create / update / delete, `bulk_add`,
 *    `bulk-commands`, `undelete`, `convert-type`, and the four
 *    `feature-editor*` operations. These are the catalogue admin, which the
 *    storefront wave leaves to Django admin (spec §4.3) — a pair that exposed
 *    them would invite a public screen to call something only staff may.
 *  - **`POST {id}/validate-dto/` is a WRITE in DRF's eyes**, so despite
 *    reading like a public helper it answers 403 to a visitor. The listing
 *    compose flow validates against the same rules with
 *    `@stapel/attributes-react`'s client-side mirror plus the server's verdict
 *    on publish; asking this endpoint would fail for exactly the people who
 *    need it.
 *  - **`GET {id}/validate-configs/`** is a catalogue-health read for an
 *    operator, not a storefront read.
 *  - **`GET translation-keys/`** is `IsServiceRequest` (service-to-service):
 *    it is the extraction feed for translators, and it returns KEYS with
 *    admin refs — never resolved labels. See `catalog/labels.ts`.
 *  - **`GET data.json/`** requires a `?revision=` cache-buster and hands back
 *    the whole table in one response. It is a legitimate alternative to the
 *    paged walk, but it is a *second* sync protocol, and the module documents
 *    the paged one. One protocol, tested, beats two, half-tested.
 *  - The parallel `/features/` collection (list, retrieve, create, …) is the
 *    feature tree in its own right — an admin axis. A storefront reads
 *    features THROUGH a category, which is the only place inheritance and
 *    order are resolved.
 *
 * Nothing is hidden: `manifest.json` lists the whole contract.
 *
 * These operations will be GENERATED from schema.json operationIds by gen-api
 * v2 (task `core-typed-ops`); until then they are hand-authored here (the ONE
 * legal home of path strings — `stapel/no-string-paths` §2.3 carve-out).
 */
export interface CategoriesApi {
  readonly client: StapelClient;

  /**
   * One page of the revision-paginated category list — the source the whole
   * tree is assembled from, and the only endpoint that reports deletions.
   *
   * Rows are ordered by `revision`, NOT by tree position: this is a sync feed,
   * not a menu. `revisions.global_max` is the cursor to store;
   * `revisions.deleted_ids` is the authoritative tombstone list for a delta
   * (see `catalog/sync.ts` for why it beats scanning `deleted: true` rows).
   */
  list(
    params?: CategoryListParams,
    options?: { readonly signal?: AbortSignal }
  ): Promise<CategoryPage>;

  /**
   * One category row by id.
   *
   * The cheapest question in the contract, and the one that makes a
   * SERVER-DRIVEN tree walk possible at all: `tn_ancestors_pks` on the answer
   * is the whole chain from a root down to this row, so a deep link can be
   * turned into a ladder of `children` reads without transferring a catalogue.
   *
   * It takes an ID, not a slug — `lookup_field` is never overridden and the
   * list endpoint has no slug filter, which is why a slug still costs the
   * whole tree (see MODULE.md's upstream asks).
   */
  retrieve(
    id: number,
    options?: { readonly signal?: AbortSignal }
  ): Promise<Category>;

  /**
   * Non-deleted direct children of one category, `tn_priority` descending.
   *
   * Redundant with the synced tree by construction, and deliberately kept: a
   * host that wants one branch without paying for the catalogue (an SSR
   * category page, a lazily-expanded admin-ish picker) has an endpoint for it,
   * and it is the one place the server does the `deleted` filtering.
   */
  children(
    id: number,
    options?: { readonly signal?: AbortSignal }
  ): Promise<readonly Category[]>;

  /**
   * The carousel strip: `active` AND `carousel_enabled`, `tn_priority`
   * descending, cached server-side and sent with
   * `Cache-Control: public, max-age` — so this one is safe to call on every
   * landing render.
   */
  carousel(options?: {
    readonly signal?: AbortSignal;
  }): Promise<readonly Category[]>;

  /**
   * A category's resolved feature schema: its own features plus every ancestor's,
   * deduplicated by SLUG (an `inherit` override is a new row sharing the
   * parent's slug, and the version nearest this category wins), ordered by the
   * category's own `CategoryFeature.order` first.
   *
   * This is what the listing compose form draws with
   * `@stapel/attributes-react` and what labels a search facet. `config`
   * arrives verbatim — defaults are the reader's job, and attributes-react
   * owns them.
   *
   * Since stapel-categories 0.20.1 a `chips` parent with no features of its
   * own answers the EFFECTIVE schema instead — the intersection of its
   * children's, `divergent: true` beside a feature they disagree on — and
   * says which schema it sent via `X-Effective-From`. That header rides
   * outside `StapelClient`'s reach, so this one read goes over the raw
   * carve-out in `api/featuresRaw.ts` rather than `client.get`.
   */
  features(
    id: number,
    options?: { readonly signal?: AbortSignal }
  ): Promise<CategoryFeaturesResult>;

  /**
   * The table's current maximum revision, without transferring any rows.
   *
   * The cheap freshness probe: a stored snapshot whose cursor already equals
   * this needs no delta request at all.
   */
  revision(options?: {
    readonly signal?: AbortSignal;
  }): Promise<MaxRevision>;

  /**
   * The first `depth` levels of the tree, NESTED, active rows only, ordered —
   * the one read a mega-menu makes, and the only endpoint that answers a whole
   * subtree in one round trip.
   *
   * It is not a cheaper `list()`: it carries four fields per node and no sync
   * bookkeeping at all, so it can neither seed nor advance the catalogue
   * snapshot. A menu wants three levels of names and pictures; the delta sync
   * wants every row and its revision. Two questions, two reads.
   */
  tree(
    params?: CategoryTreeParams,
    options?: { readonly signal?: AbortSignal }
  ): Promise<readonly CategoryTreeNode[]>;
}

/**
 * The wire query object for one list request.
 *
 * Exported because the query KEY is built from it, so the key and the request
 * are the same value by construction.
 *
 * `include_deleted` is sent ONLY when the caller asked for a value, and the
 * server's own default is `true`. Sending it always would be harmless; leaving
 * it out when unasked keeps the cache key of a plain read from depending on
 * this pair's opinion about a server default.
 */
export function categoryListParams(
  params: CategoryListParams = {}
): Record<string, string | number | boolean | undefined> {
  const query: Record<string, string | number | boolean | undefined> = {};
  if (params.minRevision !== undefined) query["min_revision"] = params.minRevision;
  if (params.maxRevision !== undefined) query["max_revision"] = params.maxRevision;
  if (params.includeDeleted !== undefined) {
    query["include_deleted"] = params.includeDeleted;
  }
  if (params.page !== undefined) query["page"] = params.page;
  if (params.pageSize !== undefined) query["page_size"] = params.pageSize;
  return query;
}

export function createCategoriesApi(
  client: StapelClient,
  options: CategoriesApiOptions = {}
): CategoriesApi {
  const rawTransport: CategoriesRawTransport = {
    baseUrl: client.baseUrl,
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
    ...(options.credentials !== undefined
      ? { credentials: options.credentials }
      : {}),
    ...(options.defaultHeaders !== undefined
      ? { headers: options.defaultHeaders }
      : {}),
  };
  return {
    client,

    list: (params, options) =>
      client.get("/categories/", {
        query: categoryListParams(params),
        ...(options?.signal !== undefined ? { signal: options.signal } : {}),
      }),

    retrieve: (id, options) =>
      client.get(`/categories/${String(id)}/`, {
        ...(options?.signal !== undefined ? { signal: options.signal } : {}),
      }),

    children: (id, options) =>
      client.get(`/categories/${String(id)}/children/`, {
        ...(options?.signal !== undefined ? { signal: options.signal } : {}),
      }),

    carousel: (options) =>
      client.get("/categories/carousel/", {
        ...(options?.signal !== undefined ? { signal: options.signal } : {}),
      }),

    features: (id, options) => fetchCategoryFeatures(rawTransport, id, options),

    revision: (options) =>
      client.get("/categories/revision/", {
        ...(options?.signal !== undefined ? { signal: options.signal } : {}),
      }),

    // Mounted beside the router, not on the category viewset: the path is
    // `<baseUrl>tree/`, per the browse-stages contract §4.
    tree: (params, options) =>
      client.get("/tree/", {
        query:
          params?.depth === undefined ? {} : { depth: params.depth },
        ...(options?.signal !== undefined ? { signal: options.signal } : {}),
      }),
  };
}
