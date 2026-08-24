import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { useCurrenciesApi } from "./context.js";
import { currenciesQueryKeys } from "./queryKeys.js";
import { catalogOf } from "./money.js";
import type { CurrencyCatalog } from "./money.js";
import type { Currency } from "../api/types.js";

export interface CurrenciesBag {
  /** The catalogue as a list, in the server's order (by code). */
  readonly state: LoadState<readonly Currency[]>;
  /** The same rows keyed UPPER-CASE — what the Money layer looks rates up in. */
  readonly catalog: CurrencyCatalog;
  refetch: () => void;
}

/**
 * The pair's one read: the whole active catalogue in a single request.
 *
 * Cached for an hour. Rates move when a background job refreshes them, and the
 * catalogue carries no `updated_at` to key on (BACKEND-GAP C-2) — so a shorter
 * stale time would mean one more request per mounted price row for an answer
 * that had not changed. A host that refreshes rates on a tighter schedule
 * invalidates `currenciesQueryKeys.all`.
 */
export function useCurrencies(): CurrenciesBag {
  const api = useCurrenciesApi();
  const query = useQuery({
    queryKey: currenciesQueryKeys.list(),
    queryFn: ({ signal }) => api.list({ signal }),
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });
  const state = loadStateFromQuery<readonly Currency[]>(query);
  const catalog = useMemo(
    () => (state.status === "ready" ? catalogOf(state.data) : catalogOf([])),
    [state]
  );
  return {
    state,
    catalog,
    refetch: () => {
      void query.refetch();
    },
  };
}

/**
 * One currency by code. Not what a price row uses — {@link useCurrencies}
 * already has every row — but the honest call for a screen that genuinely
 * knows one code (a deep link to a rate, an admin lookup) and the surface the
 * case-insensitive retrieve route exists for.
 */
export function useCurrency(code: string): {
  readonly state: LoadState<Currency>;
  refetch: () => void;
} {
  const api = useCurrenciesApi();
  const query = useQuery({
    queryKey: currenciesQueryKeys.one(code),
    queryFn: ({ signal }) => api.retrieve(code, { signal }),
    staleTime: 60 * 60 * 1000,
  });
  return {
    state: mapLoad(loadStateFromQuery<Currency>(query), (row) => row),
    refetch: () => {
      void query.refetch();
    },
  };
}
