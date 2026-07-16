/**
 * `@stapel/profiles-react` — the headless React flow pair for stapel-profiles
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * Scaffolded by `stapel-new-react-lib`. Layers: api → model → flows → headless
 * → i18n. Generated surfaces (flows registry, error map, manifest, llms.txt)
 * are produced by the monorepo `gen:*` drivers and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createProfilesApi } from "./api/profilesApi.js";
export type { ProfilesApi } from "./api/profilesApi.js";
export type { Schemas } from "./api/types.js";

// ── flows ────────────────────────────────────────────────────────────────────
// The flow-machine primitive lives in `@stapel/core` (one reviewed copy for
// every pair — frontend-core-architecture §4b). Re-exported for ergonomics.
export { createFlowMachine, useFlow, isErrorCode } from "@stapel/core";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
  FlowError,
} from "@stapel/core";
export { toFlowError } from "./flows/errors.js";
export { PROFILES_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  ProfilesFlowId,
  ProfilesFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createProfilesRuntime } from "./model/runtime.js";
export type {
  ProfilesRuntime,
  CreateProfilesRuntimeOptions,
} from "./model/runtime.js";
export {
  ProfilesRuntimeContext,
  useProfilesRuntime,
  useProfilesApi,
  useProfilesAnalytics,
} from "./model/context.js";
export { profilesQueryKeys } from "./model/queryKeys.js";

// ── model (read hooks) ───────────────────────────────────────────────────────
export {
  useMyProfile,
  useProfile,
  useRelationship,
  useMyFollowers,
  useMyFollowing,
  useMyBlocked,
  useLanguages,
} from "./model/queries.js";

// ── model (write hooks) ──────────────────────────────────────────────────────
export {
  useUpdateMyProfile,
  useFollow,
  useUnfollow,
  useBlock,
  useUnblock,
} from "./model/mutations.js";

// ── api (wire type aliases) ──────────────────────────────────────────────────
export type {
  MyProfile as MyProfileData,
  ProfileUpdate,
  PublicProfile,
  RelationshipInfo,
  RelationshipAction,
  RelationshipStatus,
  Followers,
  Following,
  Blocked,
  Language,
} from "./api/types.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { ProfilesProvider } from "./headless/ProfilesProvider.js";
export { MyProfile } from "./headless/MyProfile.js";
export type { MyProfileBag } from "./headless/MyProfile.js";
export { Relationship } from "./headless/Relationship.js";
export type { RelationshipBag } from "./headless/Relationship.js";
export { ConnectionList } from "./headless/ConnectionList.js";
export type {
  ConnectionListBag,
  ConnectionKind,
} from "./headless/ConnectionList.js";
export { useAvatarUpload } from "./headless/AvatarUpload.js";
export type { AvatarUploadBag } from "./headless/AvatarUpload.js";
export { NotificationPreferences } from "./headless/NotificationPreferences.js";
export type {
  NotificationPrefsBag,
  NotificationCategory,
  NotificationChannel,
} from "./headless/NotificationPreferences.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  PROFILES_I18N_KEYS,
  profilesI18nBundleEn,
  registerProfilesI18n,
} from "./i18n/keys.js";
export type { ProfilesI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  PROFILES_ERRORS,
  PROFILES_ERROR_CODES,
  profilesErrorBundleEn,
  explainProfilesError,
} from "./i18n/errorsMap.js";
export type {
  ProfilesErrorCode,
  ProfilesErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
