import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  Blocked,
  Followers,
  Following,
  Language,
  MyProfile,
  PublicProfile,
  RelationshipInfo,
} from "../api/types.js";
import { useProfilesApi } from "./context.js";
import { profilesQueryKeys } from "./queryKeys.js";

/**
 * Read hooks over the profiles API. Staleness follows core's query defaults;
 * override per call site via a page that needs fresher data. Keys are
 * namespaced (see `profilesQueryKeys`).
 */

/** The caller's own full profile (GET /me). */
export function useMyProfile(): UseQueryResult<MyProfile, StapelApiError> {
  const api = useProfilesApi();
  return useQuery({
    queryKey: profilesQueryKeys.me(),
    queryFn: () => api.getMyProfile(),
  });
}

/**
 * Another user's public profile (GET /{user_id}). Disabled until `userId` is
 * given, so it is safe to call with an empty id while a route param resolves.
 */
export function useProfile(
  userId: string
): UseQueryResult<PublicProfile, StapelApiError> {
  const api = useProfilesApi();
  return useQuery({
    queryKey: profilesQueryKeys.profile(userId),
    queryFn: () => api.getProfile(userId),
    enabled: userId.length > 0,
  });
}

/** The caller↔target relationship status (GET /{user_id}/relationship). */
export function useRelationship(
  userId: string
): UseQueryResult<RelationshipInfo, StapelApiError> {
  const api = useProfilesApi();
  return useQuery({
    queryKey: profilesQueryKeys.relationship(userId),
    queryFn: () => api.getRelationship(userId),
    enabled: userId.length > 0,
  });
}

/**
 * The caller's followers (GET /me/followers). `enabled` (default true) lets a
 * caller that shows one of several lists at a time keep the others dormant —
 * {@link ConnectionList} passes it so only the active list fetches.
 */
export function useMyFollowers(
  enabled = true
): UseQueryResult<Followers, StapelApiError> {
  const api = useProfilesApi();
  return useQuery({
    queryKey: profilesQueryKeys.followers(),
    queryFn: () => api.getMyFollowers(),
    enabled,
  });
}

/** The users the caller follows (GET /me/following). See {@link useMyFollowers}. */
export function useMyFollowing(
  enabled = true
): UseQueryResult<Following, StapelApiError> {
  const api = useProfilesApi();
  return useQuery({
    queryKey: profilesQueryKeys.following(),
    queryFn: () => api.getMyFollowing(),
    enabled,
  });
}

/** The users the caller has blocked (GET /me/blocked). See {@link useMyFollowers}. */
export function useMyBlocked(
  enabled = true
): UseQueryResult<Blocked, StapelApiError> {
  const api = useProfilesApi();
  return useQuery({
    queryKey: profilesQueryKeys.blocked(),
    queryFn: () => api.getMyBlocked(),
    enabled,
  });
}

/** The supported UI languages (GET /languages/) — a stable reference list. */
export function useLanguages(): UseQueryResult<
  readonly Language[],
  StapelApiError
> {
  const api = useProfilesApi();
  return useQuery({
    queryKey: profilesQueryKeys.languages(),
    queryFn: () => api.listLanguages(),
  });
}
