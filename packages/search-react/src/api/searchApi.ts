import type { StapelClient } from "@stapel/core";
import type {
  RankingResponse,
  SearchQueryState,
  SearchResponse,
  SuggestAnswer,
  SuggestParams,
} from "./types.js";

/**
 * The pair's typed operation surface — one method per stapel-search endpoint a
 * storefront may call, bound to the injected {@link StapelClient} (the
 * per-module override seam of frontend-standard §7.2). Paths are relative to
 * the runtime's `baseUrl` (`/search/api/v1/`).
 *
 * ── The three PUBLIC reads, and the two that are not here ─────────────────
 *
 * `query`, `suggest` and `ranking` are `AllowAny` (`stapel_anonymous_access =
 * ANONYMOUS_ALLOWED`): a storefront calls them with no session at all, which
 * is what lets a catalogue render for a visitor who will never sign in.
 *
 * `GET /health` and `POST /reindex` are NOT on this interface. Both are
 * `IsNotAnonymousUser` + an in-view `can_manage` check that answers
 * `error.403.search_forbidden` — they are index-operator endpoints, not
 * storefront ones, and a pair that exposed them would invite a public screen
 * to call something only an operator may. They stay in the generated schema
 * (and therefore in `manifest.json`, which lists the whole contract), so
 * nothing is hidden; they are simply not this pair's surface.
 *
 * These operations will be GENERATED from schema.json operationIds by gen-api
 * v2 (task `core-typed-ops`); until then they are hand-authored here (the ONE
 * legal home of path strings — `stapel/no-string-paths` §2.3 carve-out).
 */
export interface SearchApi {
  readonly client: StapelClient;

  /**
   * One keyset page of results, with the facet counts for the current
   * candidate set.
   *
   * Refusals a skin must tell apart, all 400 with the offending value in
   * `params`: `error.400.search_unknown_doc_type`, `…_unknown_sort`,
   * `…_sort_needs_center`, `…_bad_geo`, `…_bad_range`, `…_bad_cursor`,
   * `…_query_too_long`, `…_too_many_facets`, `…_too_many_ranges`, and
   * `…_window_exceeded` — which is "narrow the search", NOT "nothing found".
   * A dead engine answers 503 `error.503.search_backend_unavailable`; the
   * views turn EVERY backend exception into that, so a 500 never reaches a
   * client and "we could not ask" is always distinguishable from "no hits".
   */
  query(
    state: SearchQueryState,
    options?: { readonly signal?: AbortSignal }
  ): Promise<SearchResponse>;

  /**
   * What to offer under the search box: CATEGORIES first, then title-prefix
   * terms (stapel-search 0.7.0).
   *
   * Neither half comes from a query log — the module keeps none, which is a
   * privacy decision before it is a product one — so every suggestion is a
   * destination or a search that has results.
   *
   * Typed as {@link SuggestAnswer} rather than as the generated
   * `SuggestResponse`: a build regenerated against a pre-0.7.0 schema would
   * otherwise hide the categories half from the compiler. See that type for
   * why every member but `backend` is optional.
   */
  suggest(
    params: SuggestParams,
    options?: { readonly signal?: AbortSignal }
  ): Promise<SuggestAnswer>;

  /**
   * The P2B Art. 5 ranking disclosure for a doc type: which parameters rank
   * results, their weights, and — per parameter — whether the configured
   * engine can actually evaluate it (`active` / `inactive_reason`). A
   * disclosure that listed a parameter the engine ignores would be a
   * disclosure of the wrong ranking.
   */
  ranking(
    type?: string,
    options?: { readonly signal?: AbortSignal }
  ): Promise<RankingResponse>;
}

/**
 * The wire query object for one search state.
 *
 * Exported because it is also what the query KEY is built from: the key and
 * the request are then the same value by construction, and a filter that
 * changes the URL but not the key (the classic stale-page bug) cannot happen.
 *
 * `f.<slug>` is an ARRAY — repeated keys are the OR, and `@stapel/core`'s
 * client repeats an array-valued key rather than collapsing it (core 0.15.0).
 */
export function searchQueryParams(
  state: SearchQueryState
): Record<
  string,
  string | number | boolean | undefined | readonly (string | number | boolean)[]
> {
  const query: Record<
    string,
    | string
    | number
    | boolean
    | undefined
    | readonly (string | number | boolean)[]
  > = { type: state.type };

  if (state.q.length > 0) query["q"] = state.q;
  if (state.lang !== undefined) query["lang"] = state.lang;
  if (state.category !== undefined) query["category"] = state.category;
  if (state.owner !== undefined) query["owner"] = state.owner;

  for (const [slug, values] of Object.entries(state.filters)) {
    if (values.length > 0) query[`f.${slug}`] = values;
  }
  for (const [slug, range] of Object.entries(state.ranges)) {
    if (range.from === undefined && range.to === undefined) continue;
    query[`r.${slug}`] = `${range.from ?? ""}..${range.to ?? ""}`;
  }

  if (state.geo !== undefined) {
    if (state.geo.kind === "bbox") {
      const { minLat, minLon, maxLat, maxLon } = state.geo;
      query["bbox"] = `${minLat},${minLon},${maxLat},${maxLon}`;
    } else {
      query["lat"] = state.geo.lat;
      query["lon"] = state.geo.lon;
      if (state.geo.radiusKm !== undefined) {
        query["radius_km"] = state.geo.radiusKm;
      }
    }
  }

  if (state.sort !== undefined) query["sort"] = state.sort;
  if (state.facets !== undefined) {
    query["facets"] = Array.isArray(state.facets)
      ? state.facets.join(",")
      : (state.facets as string);
  }
  if (state.anchor !== undefined) query["anchor"] = state.anchor;
  if (state.direction !== undefined) query["direction"] = state.direction;
  if (state.limit !== undefined) query["limit"] = state.limit;

  return query;
}

export function createSearchApi(client: StapelClient): SearchApi {
  return {
    client,

    query: (state, options) =>
      client.get("/query", {
        query: searchQueryParams(state),
        ...(options?.signal !== undefined ? { signal: options.signal } : {}),
      }),

    suggest: (params, options) =>
      client.get("/suggest", {
        query: {
          type: params.type,
          ...(params.q !== undefined ? { q: params.q } : {}),
          ...(params.limit !== undefined ? { limit: params.limit } : {}),
        },
        ...(options?.signal !== undefined ? { signal: options.signal } : {}),
      }),

    ranking: (type, options) =>
      client.get("/ranking", {
        query: type !== undefined ? { type } : {},
        ...(options?.signal !== undefined ? { signal: options.signal } : {}),
      }),
  };
}
