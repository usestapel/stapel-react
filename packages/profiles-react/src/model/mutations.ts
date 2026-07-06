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

/** Partially update the caller's own profile — refreshes `me`. */
export function useUpdateMyProfile(): UseMutationResult<
  MyProfile,
  StapelApiError,
  ProfileUpdate
> {
  const api = useProfilesApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<MyProfile, StapelApiError, ProfileUpdate> = {
    mutationFn: (patch) => api.updateMyProfile(patch),
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
