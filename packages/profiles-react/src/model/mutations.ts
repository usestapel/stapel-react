import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  MyProfile,
  ProfileUpdate,
  RelationshipAction,
} from "../api/types.js";
import { useProfilesApi } from "./context.js";
import { profilesQueryKeys } from "./queryKeys.js";

/**
 * Write hooks (frontend-standard §2 — "мутации с инвалидацией"). Each mutation
 * invalidates exactly the server state it can move: a profile edit refreshes the
 * caller's own profile; a relationship action refreshes the caller↔target
 * relationship, the target's public projection (its `relationship_status` /
 * follower counts), and the caller's own follower/following/blocked lists.
 *
 * Options are built as typed `UseMutationOptions` objects (not call-site
 * generics) so `void` stays in type-reference position, which
 * `no-invalid-void-type` permits.
 */

/**
 * Apply a `ProfileUpdate` patch to a cached `MyProfile` the way the backend
 * would — used ONLY for the optimistic cache write in {@link useUpdateMyProfile}
 * (frontend-guidelines "Интеракции настроек": pickers apply reactively, so the
 * cache must reflect the pick before the round trip lands). Every patch field
 * shares its shape with `MyProfile` except `app_language`, which the wire PATCHes
 * as a bare code (`string | null`) but the profile reads back as the full
 * `{code, name, flag}` object — so that one field is special-cased here rather
 * than spread, the rest fall through untouched.
 */
function applyOptimisticProfilePatch(
  previous: MyProfile,
  patch: ProfileUpdate
): MyProfile {
  const { app_language, ...rest } = patch;
  // `ProfileUpdate` fields are `T | null | undefined` (a PATCH can clear a
  // field); `MyProfile`'s matching fields are non-nullable `T` for every key
  // that matters to the reactive pickers this optimistic write serves
  // (currency_code/measurement_units/theme/understands/display_name never
  // read back null). Only `undefined` means "not part of this patch" —
  // filter it out before spreading rather than widening `MyProfile`'s own
  // (correct, backend-driven) types to accommodate a cache-write helper.
  const defined = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined)
  ) as Partial<MyProfile>;
  const next: MyProfile = { ...previous, ...defined };
  if (app_language !== undefined) {
    next.app_language =
      app_language === null
        ? null
        : { ...(previous.app_language ?? { name: app_language, flag: null }), code: app_language };
  }
  return next;
}

/**
 * Partially update the caller's own profile — refreshes `me`. Optimistic: the
 * cache is updated the instant the patch is issued (reactive pickers never
 * wait on the network to reflect a pick) and rolled back to the pre-patch
 * snapshot if the request fails, so a rejected pick visibly snaps back.
 */
export function useUpdateMyProfile(): UseMutationResult<
  MyProfile,
  StapelApiError,
  ProfileUpdate
> {
  const api = useProfilesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    MyProfile,
    StapelApiError,
    ProfileUpdate,
    MyProfile | undefined
  > = {
    mutationFn: (patch) => api.updateMyProfile(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: profilesQueryKeys.me() });
      const previous = queryClient.getQueryData<MyProfile>(profilesQueryKeys.me());
      if (previous) {
        queryClient.setQueryData(
          profilesQueryKeys.me(),
          applyOptimisticProfilePatch(previous, patch)
        );
      }
      return previous;
    },
    onError: (_err, _patch, previous) => {
      if (previous) queryClient.setQueryData(profilesQueryKeys.me(), previous);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(profilesQueryKeys.me(), updated);
    },
  };
  return useMutation(options);
}

/** Shared invalidation for the four relationship actions (keyed by target id). */
function useRelationshipAction(
  action: (api: ReturnType<typeof useProfilesApi>, userId: string) => Promise<RelationshipAction>
): UseMutationResult<RelationshipAction, StapelApiError, string> {
  const api = useProfilesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<RelationshipAction, StapelApiError, string> =
    {
      mutationFn: (userId) => action(api, userId),
      onSuccess: (_data, userId) => {
        void queryClient.invalidateQueries({
          queryKey: profilesQueryKeys.relationship(userId),
        });
        void queryClient.invalidateQueries({
          queryKey: profilesQueryKeys.profile(userId),
        });
        void queryClient.invalidateQueries({
          queryKey: profilesQueryKeys.following(),
        });
        void queryClient.invalidateQueries({
          queryKey: profilesQueryKeys.followers(),
        });
        void queryClient.invalidateQueries({
          queryKey: profilesQueryKeys.blocked(),
        });
      },
    };
  return useMutation(options);
}

/** Follow a user by id. */
export function useFollow(): UseMutationResult<
  RelationshipAction,
  StapelApiError,
  string
> {
  return useRelationshipAction((api, userId) => api.follow(userId));
}

/** Unfollow a user by id. */
export function useUnfollow(): UseMutationResult<
  RelationshipAction,
  StapelApiError,
  string
> {
  return useRelationshipAction((api, userId) => api.unfollow(userId));
}

/** Block a user by id. */
export function useBlock(): UseMutationResult<
  RelationshipAction,
  StapelApiError,
  string
> {
  return useRelationshipAction((api, userId) => api.block(userId));
}

/** Unblock a user by id. */
export function useUnblock(): UseMutationResult<
  RelationshipAction,
  StapelApiError,
  string
> {
  return useRelationshipAction((api, userId) => api.unblock(userId));
}
