import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient, UseMutationResult } from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  DeleteResponse,
  FavoriteToggleResponse,
  ListingActionResponse,
  ListingDraft,
  ListingDraftPatch,
  PublishResponse,
} from "../api/types.js";
import { useListingsApi } from "./context.js";
import { listingsQueryKeys } from "./queryKeys.js";

/**
 * Every write in the module, each one saying what it invalidates and why.
 *
 * ── The listing id is a VARIABLE, not a hook argument ──────────────────────
 *
 * Every mutation here takes its id in the mutation's variables rather than in
 * the hook's closure, and that is a correctness decision rather than a style
 * one. The composer creates the draft row and saves into it IN THE SAME user
 * gesture: an id-bound hook would still be holding the id from the render
 * before the create, so the save would go to the wrong path (or to none). A
 * variable is read at call time, which is the only time the id is known.
 *
 * ── The invalidation rule ──────────────────────────────────────────────────
 *
 * A write that can move `status` or `moderation_status` invalidates the
 * DETAIL, the STATUS probe, the COUNTERS and the owner's ROWS — the counters
 * because their three tabs are defined by status sets (`views.my_counters`),
 * so a publish silently moves a row from "drafts" to "active" and a dashboard
 * that did not refetch would show the old number beside the new row; the rows
 * for the same reason, since stapel-listings 0.7.0 gave them a route and they
 * are narrowed by exactly those status sets. Invalidating one and not the
 * other is the shape of the bug where the badge says 2 and the tab shows 3.
 *
 * Nothing here is optimistic except the favourite toggle, and that exception
 * is argued at its own hook.
 */

/** Everything a status-moving write must freshen. */
function invalidateListing(queryClient: QueryClient, id: number): void {
  void queryClient.invalidateQueries({ queryKey: listingsQueryKeys.detail(id) });
  void queryClient.invalidateQueries({ queryKey: listingsQueryKeys.status(id) });
  void queryClient.invalidateQueries({
    queryKey: listingsQueryKeys.myCounters(),
  });
  void queryClient.invalidateQueries({
    queryKey: listingsQueryKeys.validateDraft(id),
  });
  void queryClient.invalidateQueries({ queryKey: listingsQueryKeys.allMine() });
}

/** Start a draft. The server forces `owner` and `status=draft`. */
export function useCreateDraft(): UseMutationResult<
  ListingDraft,
  StapelApiError,
  ListingDraftPatch
> {
  const api = useListingsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ListingDraftPatch) => api.createDraft(body),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: listingsQueryKeys.myCounters(),
      });
      void queryClient.invalidateQueries({
        queryKey: listingsQueryKeys.allMine(),
      });
    },
  });
}

/** What a `save-draft` write carries. */
export interface SaveDraftInput {
  readonly id: number;
  readonly body: ListingDraftPatch;
}

/**
 * Persist draft fields. Always partial — send what the form holds.
 *
 * The validate-draft entry is invalidated rather than written: the saved row
 * comes back, but it carries no verdict, and a stale verdict beside fresh
 * content is the one combination a composer must never show.
 */
export function useSaveDraft(): UseMutationResult<
  ListingDraft,
  StapelApiError,
  SaveDraftInput
> {
  const api = useListingsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveDraftInput) => api.saveDraft(input.id, input.body),
    retry: false,
    onSuccess: (_data, input) => {
      invalidateListing(queryClient, input.id);
    },
  });
}

/**
 * Promote the draft.
 *
 * `retry: false` — the 400 here is a VERDICT about the content (a bare
 * `ValidationBatchResult` body, see `model/validation.ts`), and repeating a
 * verdict three times only delays the moment the composer can lay it on the
 * controls.
 */
export function usePublishListing(): UseMutationResult<
  PublishResponse,
  StapelApiError,
  number
> {
  const api = useListingsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.publish(id),
    retry: false,
    onSuccess: (_data, id) => {
      invalidateListing(queryClient, id);
    },
  });
}

/** Move to ARCHIVED. 409 `error.409.invalid_listing_transition` carries
 * `params.from_status`, which is what turns the refusal into a sentence. */
export function useArchiveListing(): UseMutationResult<
  ListingActionResponse,
  StapelApiError,
  number
> {
  const api = useListingsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.archive(id),
    retry: false,
    onSuccess: (_data, id) => {
      invalidateListing(queryClient, id);
    },
  });
}

/** Mark SOLD. Same 409 contract as {@link useArchiveListing}. */
export function useCompleteListing(): UseMutationResult<
  ListingActionResponse,
  StapelApiError,
  number
> {
  const api = useListingsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.complete(id),
    retry: false,
    onSuccess: (_data, id) => {
      invalidateListing(queryClient, id);
    },
  });
}

/** Soft-delete. Refused with `error.409.listing_cannot_delete_active` while
 * the listing is PUBLISHED or PENDING. */
export function useDeleteListing(): UseMutationResult<
  DeleteResponse,
  StapelApiError,
  number
> {
  const api = useListingsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.remove(id),
    retry: false,
    onSuccess: (_data, id) => {
      invalidateListing(queryClient, id);
      void queryClient.invalidateQueries({ queryKey: listingsQueryKeys.all });
    },
  });
}

/** What a favourite toggle carries: the id and the state it should END in. */
export interface FavoriteInput {
  readonly id: number;
  readonly favorited: boolean;
}

/**
 * Favourite / un-favourite, as ONE mutation over the intended next state.
 *
 * Two endpoints, one intent — and modelling it as two hooks would let a
 * caller call the wrong one for the state it is in. The server is idempotent
 * on both sides (`get_or_create` / `filter().delete()`), so a double-click
 * cannot desynchronise anything.
 *
 * This is the pair's ONE write whose next state the client may predict, and
 * the reason is that the truth is a single boolean the caller already holds.
 * Everything else here moves a LIFECYCLE whose next state is the server's to
 * decide — guessing `pending` versus `published` after a publish would be
 * inventing the very verdict the pair exists to report faithfully.
 *
 * The invalidation reaches the favourites LIST as well as the row: a heart
 * turned off on the favourites page must remove the card, not leave a hollow
 * one behind.
 */
export function useFavoriteListing(): UseMutationResult<
  FavoriteToggleResponse,
  StapelApiError,
  FavoriteInput
> {
  const api = useListingsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FavoriteInput) =>
      input.favorited ? api.favorite(input.id) : api.unfavorite(input.id),
    retry: false,
    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({
        queryKey: listingsQueryKeys.detail(input.id),
      });
      void queryClient.invalidateQueries({
        queryKey: listingsQueryKeys.allFavorites(),
      });
      void queryClient.invalidateQueries({
        queryKey: listingsQueryKeys.allLists(),
      });
    },
  });
}
