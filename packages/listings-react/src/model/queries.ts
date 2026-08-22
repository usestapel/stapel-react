import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type { ValidationBatchResult } from "@stapel/attributes-react";
import type {
  ListingDetail,
  ListingPageParams,
  ListingStatusInfo,
  MyCounters,
  PaginatedListingCards,
} from "../api/types.js";
import { useListingsApi } from "./context.js";
import { listingsQueryKeys, pageKey } from "./queryKeys.js";

/**
 * Read hooks over the listings API (frontend-standard §2). Keys are
 * namespaced (see `listingsQueryKeys`).
 *
 * ── Two gating regimes in one module, and the line between them ────────────
 *
 * `useListing` / `useListingStatus` / `useListingCards` call
 * `IsAuthenticatedOrReadOnly` and `AllowAny` endpoints: a visitor reads them
 * with no session at all, so gating on `useActiveSessionReady` would make a
 * shop window wait for a login bootstrap it has no stake in. Core's own doc
 * comment carves out exactly this case.
 *
 * `useMyCounters` / `useMyFavorites` / `useValidateDraft` are
 * `IsAuthenticated` and DO gate: firing them before the session substrate has
 * settled produces a 401 that means "we asked too early", which is
 * indistinguishable on screen from "you are signed out".
 */

/**
 * One listing in full.
 *
 * `retry: false` on purpose. The failures here are verdicts about the
 * request: a 404 for a listing that is gone, a 403 for one that is not
 * yours. Retrying a 404 three times only delays the moment the page can say
 * which it was — and for a soft-deleted listing, `useListingStatus` is the
 * read that can actually explain it (see `headless/ListingDetail.tsx`).
 */
export function useListing(
  id: number | undefined,
  options?: { readonly enabled?: boolean }
): UseQueryResult<ListingDetail, StapelApiError> {
  const api = useListingsApi();
  return useQuery({
    queryKey: listingsQueryKeys.detail(id ?? -1),
    queryFn: ({ signal }) => api.retrieve(id as number, { signal }),
    enabled: (options?.enabled ?? true) && id !== undefined,
    retry: false,
  });
}

/**
 * The status probe — both axes plus `is_deleted`, for ANY listing id.
 *
 * The one read that survives a soft delete (`Listing.all_objects`), which is
 * why a detail page runs it beside the detail rather than only after a
 * failure: "this listing was removed" is a sentence, and a bare 404 is not.
 */
export function useListingStatus(
  id: number | undefined,
  options?: { readonly enabled?: boolean }
): UseQueryResult<ListingStatusInfo, StapelApiError> {
  const api = useListingsApi();
  return useQuery({
    queryKey: listingsQueryKeys.status(id ?? -1),
    queryFn: ({ signal }) => api.status(id as number, { signal }),
    enabled: (options?.enabled ?? true) && id !== undefined,
    retry: false,
  });
}

/**
 * A keyset page of PUBLISHED cards.
 *
 * `keepPreviousData`: paging a grid that blanks between pages reads as a
 * failure, and the previous page is still a true answer about the previous
 * cursor. The FIRST load has nothing to keep and is `loading`; a failure is
 * still `failed` rather than stale rows pretending to be current.
 */
export function useListingCards(
  params?: ListingPageParams,
  options?: { readonly enabled?: boolean }
): UseQueryResult<PaginatedListingCards, StapelApiError> {
  const api = useListingsApi();
  return useQuery({
    queryKey: listingsQueryKeys.list(pageKey(params)),
    queryFn: ({ signal }) => api.list(params, { signal }),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** The dashboard's three counts. Session-gated. */
export function useMyCounters(options?: {
  readonly enabled?: boolean;
}): UseQueryResult<MyCounters, StapelApiError> {
  const api = useListingsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: listingsQueryKeys.myCounters(),
    queryFn: ({ signal }) => api.myCounters({ signal }),
    enabled: (options?.enabled ?? true) && sessionReady,
    retry: false,
  });
}

/** A keyset page of the caller's favourites. Session-gated. */
export function useMyFavorites(
  params?: ListingPageParams,
  options?: { readonly enabled?: boolean }
): UseQueryResult<PaginatedListingCards, StapelApiError> {
  const api = useListingsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: listingsQueryKeys.myFavorites(pageKey(params)),
    queryFn: ({ signal }) => api.myFavorites(params, { signal }),
    enabled: (options?.enabled ?? true) && sessionReady,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/**
 * What publishing WOULD say, without publishing.
 *
 * Disabled by default: it is a round trip per call and the composer's own
 * mirror answers the same question for free most of the time. A composer
 * turns it on when the person asks ("check my listing") and after a save, so
 * the SERVER's opinion of the saved draft is what the button reports —
 * `staleTime: 0` because the draft is exactly the thing that just moved.
 */
export function useValidateDraft(
  id: number | undefined,
  options?: { readonly enabled?: boolean }
): UseQueryResult<ValidationBatchResult, StapelApiError> {
  const api = useListingsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: listingsQueryKeys.validateDraft(id ?? -1),
    queryFn: ({ signal }) => api.validateDraft(id as number, { signal }),
    enabled: (options?.enabled ?? false) && id !== undefined && sessionReady,
    staleTime: 0,
    retry: false,
  });
}
