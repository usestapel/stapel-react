import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type { ValidationBatchResult } from "@stapel/attributes-react";
import type {
  ListingDetail,
  ListingDraft,
  ListingEngagementBatch,
  ListingPageParams,
  ListingStatusInfo,
  MyCounters,
  PaginatedListingCards,
} from "../api/types.js";
import { engagementIds } from "../api/types.js";
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
 * The draft twin, read back (`GET /{pk}/draft/`, stapel-listings 0.21.1) —
 * what `useListingComposer` seeds a reopened listing from.
 *
 * `retry: false` for the same reason as {@link useListing}: a 404 here is
 * either "no draft was ever saved" or "this build predates the route", and
 * three retries only delay the moment the composer can fall back to the
 * detail seed. It is a separate query from `useListing` (own cache key),
 * because a host that only reads the detail must not pay for this round
 * trip, and a write to one must not evict the other.
 */
export function useListingDraft(
  id: number | undefined,
  options?: { readonly enabled?: boolean }
): UseQueryResult<ListingDraft, StapelApiError> {
  const api = useListingsApi();
  return useQuery({
    queryKey: listingsQueryKeys.draft(id ?? -1),
    queryFn: ({ signal }) => api.draft(id as number, { signal }),
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

/**
 * The per-viewer ENGAGEMENT overlay for one page of ids, in one request.
 *
 * `AllowAny` upstream, so it joins the ungated regime described at the top of
 * this file: a signed-out grid asks exactly the same question and is told
 * `null` for both per-viewer flags. Gating it on the session substrate would
 * make a shop window wait for a login bootstrap in order to decorate itself.
 *
 * ── Every failure mode here is a NO-OP, on purpose ────────────────────────
 *
 * `retry: false`, no error surface, and `enabled` false for an empty page.
 * This read decorates a grid that has already rendered from somewhere else:
 * if it 500s, times out, or is never wired at all, the cards must draw
 * exactly as they drew before it existed. Retrying a decoration three times
 * spends a person's connection on a flag, and an error banner over a working
 * results page trades the thing they came for against the thing they did not
 * ask about. `useEngagementOverlay` therefore reads only `data`, and the
 * failure is available to a host that wants it and rendered by nobody.
 *
 * `placeholderData: keepPreviousData` for the paging case: a grid whose cards
 * un-dim for a moment on every page change is reporting a state change that
 * did not happen. The previous answer is still true about the previous ids,
 * and `withEngagement` only ever reads the entries whose ids it asked for.
 */
export function useListingEngagement(
  ids: readonly number[],
  options?: { readonly enabled?: boolean }
): UseQueryResult<ListingEngagementBatch, StapelApiError> {
  const api = useListingsApi();
  const wanted = engagementIds(ids);
  return useQuery({
    queryKey: listingsQueryKeys.engagement(wanted),
    queryFn: ({ signal }) => api.engagement(wanted, { signal }),
    enabled: (options?.enabled ?? true) && wanted.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
