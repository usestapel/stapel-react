import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type {
  Blocked,
  Followers,
  Following,
  Language,
  MyProfile,
  ProfileFieldManifestEntry,
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

/**
 * The caller's own full profile (GET /me). Gated on
 * {@link useActiveSessionReady} (owner-diagnosed live incident,
 * 2026-07-17): a top-level "the caller's own …" hook with no natural
 * `enabled` condition of its own is exactly the shape that raced a
 * still-bootstrapping session and read a live one as "expired" — zero
 * manual `enabled` wiring needed at the call site by design.
 */
export function useMyProfile(): UseQueryResult<MyProfile, StapelApiError> {
  const api = useProfilesApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: profilesQueryKeys.me(),
    queryFn: () => api.getMyProfile(),
    enabled: sessionReady,
    // Cache-first / stale-while-revalidate — same contract as auth-react's
    // `useMe`: with `<StapelProvider meCacheQueryKeys={[profilesQueryKeys.me()]}>`
    // wired, the QueryClient is hydrated from localStorage before this
    // hook's first render (instant paint of the last-known profile);
    // `staleTime: 0` guarantees a background revalidation fires on every
    // mount regardless of how fresh the persisted snapshot looks.
    staleTime: 0,
  });
}

/**
 * Another user's public profile (GET /{user_id}). Disabled until `userId` is
 * given, so it is safe to call with an empty id while a route param resolves —
 * AND until the session is ready (a `userId` can be known synchronously,
 * e.g. from a URL param, before the session has finished bootstrapping).
 */
export function useProfile(
  userId: string
): UseQueryResult<PublicProfile, StapelApiError> {
  const api = useProfilesApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: profilesQueryKeys.profile(userId),
    queryFn: () => api.getProfile(userId),
    enabled: sessionReady && userId.length > 0,
  });
}

/** The caller↔target relationship status (GET /{user_id}/relationship). See
 * {@link useProfile} for the session-readiness gating. */
export function useRelationship(
  userId: string
): UseQueryResult<RelationshipInfo, StapelApiError> {
  const api = useProfilesApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: profilesQueryKeys.relationship(userId),
    queryFn: () => api.getRelationship(userId),
    enabled: sessionReady && userId.length > 0,
  });
}

/**
 * The caller's followers (GET /me/followers). `enabled` (default true) lets a
 * caller that shows one of several lists at a time keep the others dormant —
 * {@link ConnectionList} passes it so only the active list fetches. ALSO
 * gated on session readiness — see {@link useMyProfile}.
 */
export function useMyFollowers(
  enabled = true
): UseQueryResult<Followers, StapelApiError> {
  const api = useProfilesApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: profilesQueryKeys.followers(),
    queryFn: () => api.getMyFollowers(),
    enabled: sessionReady && enabled,
  });
}

/** The users the caller follows (GET /me/following). See {@link useMyFollowers}. */
export function useMyFollowing(
  enabled = true
): UseQueryResult<Following, StapelApiError> {
  const api = useProfilesApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: profilesQueryKeys.following(),
    queryFn: () => api.getMyFollowing(),
    enabled: sessionReady && enabled,
  });
}

/** The users the caller has blocked (GET /me/blocked). See {@link useMyFollowers}. */
export function useMyBlocked(
  enabled = true
): UseQueryResult<Blocked, StapelApiError> {
  const api = useProfilesApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: profilesQueryKeys.blocked(),
    queryFn: () => api.getMyBlocked(),
    enabled: sessionReady && enabled,
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

/**
 * The active profile field manifest (GET /field-manifest — §66 "Дополнение
 * владельца" tier 1, `docs/pending/profile-fields.md`): identity preset +
 * standard_fields + custom_fields, in declaration order. This is what
 * `<ProfileSettings/>`'s default skin renders FROM instead of a hardcoded
 * field list — a host's `STAPEL_PROFILES["FIELDS"]` selection changes the
 * default skin with zero frontend code changes. Public like {@link
 * useLanguages} — no session gate, a stable reference list independent of
 * `me`.
 */
export function useProfileFieldManifest(): UseQueryResult<
  readonly ProfileFieldManifestEntry[],
  StapelApiError
> {
  const api = useProfilesApi();
  return useQuery({
    queryKey: profilesQueryKeys.fieldManifest(),
    queryFn: () => api.getFieldManifest(),
  });
}
