import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import { searchQueryParams } from "../api/searchApi.js";
import type {
  RankingResponse,
  SearchQueryState,
  SearchResponse,
  SuggestResponse,
} from "../api/types.js";
import { SUGGEST_MAX_LIMIT, SUGGEST_MIN_CHARS } from "../state/limits.js";
import { useSearchApi } from "./context.js";
import { searchQueryKeys } from "./queryKeys.js";

/**
 * Read hooks over the search API (frontend-standard §2). Keys are namespaced
 * (see `searchQueryKeys`).
 *
 * NOT SESSION-GATED, and that is the documented exception rather than an
 * omission. Sibling pairs gate every read on `useActiveSessionReady` because
 * their endpoints need a principal; these three are `AllowAny`, and core's own
 * doc comment carves out exactly this case ("or be unconditionally safe
 * pre-session, e.g. a public GET"). Gating them would make a storefront's
 * catalogue wait for a login bootstrap that a visitor who will never sign in
 * has no stake in — a blank shop front for the length of a token refresh.
 */

/**
 * One keyset page of results for a search state.
 *
 * `placeholderData: keepPreviousData`, and it is not a nicety. Facets are
 * DRILL-DOWN: the whole point of the panel is that choosing a value leaves its
 * siblings with the counts you would get by switching to them. A panel that
 * blanks to a spinner between every click cannot show that — the person sees
 * the numbers vanish and reappear, which reads exactly like the naive facets
 * this contract avoids. The previous answer therefore stays on screen while
 * the next one is in flight, with `isFetching` telling a skin to dim it.
 *
 * The load discipline is intact: the FIRST load has nothing to keep and is
 * `loading`, and a failure still lands as `failed` rather than leaving stale
 * rows pretending to be current.
 *
 * `retry: false`: the refusals here are VERDICTS about the request, not blips
 * — an unknown sort, a malformed range, a cursor past `MAX_RESULT_WINDOW`.
 * Retrying a 400 three times only delays the moment the page can say which
 * one it was. A real outage answers 503 and is retried by the person, through
 * the bag's `refetch` (the spec's §7.4 negative leg: "we could not ask" plus a
 * retry, never "nothing found").
 */
export function useSearchQuery(
  state: SearchQueryState,
  options?: { readonly enabled?: boolean }
): UseQueryResult<SearchResponse, StapelApiError> {
  const api = useSearchApi();
  const params = searchQueryParams(state);
  return useQuery({
    queryKey: searchQueryKeys.query(params),
    queryFn: ({ signal }) => api.query(state, { signal }),
    enabled: (options?.enabled ?? true) && state.type.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/**
 * Title prefixes from the index, for the search box's typeahead.
 *
 * Not from a query log: stapel-search keeps none, which is a privacy decision
 * before it is a product one (`services.suggest`). So the list is what exists
 * in the catalogue, and choosing one is always a search that has results.
 *
 * `enabled` is the debounce's partner, not its replacement: the CALLER holds a
 * debounced prefix (see `useSearchBox`) and this hook refuses to ask about a
 * prefix too short to mean anything. `placeholderData: keepPreviousData` keeps
 * the previous list under the cursor while the next one is in flight — a menu
 * that empties and refills on every keystroke is a menu nobody can click.
 *
 * `staleTime` is a minute: the index changes when something is published, not
 * between two letters of one word.
 */
export function useSuggest(params: {
  readonly type: string;
  readonly q: string;
  readonly limit?: number;
  readonly enabled?: boolean;
}): UseQueryResult<SuggestResponse, StapelApiError> {
  const api = useSearchApi();
  const q = params.q.trim();
  const limit = params.limit;
  return useQuery({
    queryKey: searchQueryKeys.suggest(params.type, q, limit),
    queryFn: ({ signal }) =>
      api.suggest(
        {
          type: params.type,
          q,
          ...(limit !== undefined ? { limit: Math.min(limit, SUGGEST_MAX_LIMIT) } : {}),
        },
        { signal }
      ),
    enabled:
      (params.enabled ?? true) &&
      params.type.length > 0 &&
      q.length >= SUGGEST_MIN_CHARS,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * The P2B Art. 5 ranking disclosure.
 *
 * `staleTime: Infinity`: the scorer registry changes when somebody deploys,
 * not while a person reads the page it explains.
 */
export function useRankingDisclosure(
  type?: string,
  options?: { readonly enabled?: boolean }
): UseQueryResult<RankingResponse, StapelApiError> {
  const api = useSearchApi();
  return useQuery({
    queryKey: searchQueryKeys.ranking(type),
    queryFn: ({ signal }) => api.ranking(type, { signal }),
    enabled: options?.enabled ?? true,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}
