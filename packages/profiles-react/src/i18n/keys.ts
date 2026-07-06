import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { profilesErrorBundleEn } from "./generated/errors.gen.js";

/**
 * profiles-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys. Point core's `loadLocale` at stapel-translate to override
 * per locale. UI keys live under the `profiles.` namespace.
 */
export const PROFILES_I18N_KEYS = {
  unknownError: "profiles.error.unknown",
  // My profile (MyProfile headless)
  profileLoading: "profiles.profile.loading",
  profileSave: "profiles.profile.save",
  profileSaving: "profiles.profile.saving",
  profileSaved: "profiles.profile.saved",
  // Relationship (Relationship headless)
  relFollow: "profiles.relationship.follow",
  relFollowing: "profiles.relationship.following",
  relUnfollow: "profiles.relationship.unfollow",
  relBlock: "profiles.relationship.block",
  relBlocked: "profiles.relationship.blocked",
  relUnblock: "profiles.relationship.unblock",
  relSelf: "profiles.relationship.self",
  // Connection lists (ConnectionList headless)
  listFollowers: "profiles.list.followers",
  listFollowing: "profiles.list.following",
  listBlocked: "profiles.list.blocked",
  listEmpty: "profiles.list.empty",
} as const;

export type ProfilesI18nKey =
  (typeof PROFILES_I18N_KEYS)[keyof typeof PROFILES_I18N_KEYS];

/**
 * English fallback bundle for profiles-react UI keys + backend error codes.
 * The generated `profilesErrorBundleEn` (from stapel-profiles's error registry,
 * `pnpm gen:errors`) is spread FIRST so every backend `error.*` key has a
 * fallback — a `StapelApiError.code` never renders as a raw key. Hand-polished
 * copy below then OVERRIDES the generated English for the keys users see most.
 */
export const profilesI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...profilesErrorBundleEn,

  // profiles-react UI
  "profiles.error.unknown": "Something went wrong. Please try again.",
  "profiles.profile.loading": "Loading profile…",
  "profiles.profile.save": "Save changes",
  "profiles.profile.saving": "Saving…",
  "profiles.profile.saved": "Profile saved.",
  "profiles.relationship.follow": "Follow",
  "profiles.relationship.following": "Following",
  "profiles.relationship.unfollow": "Unfollow",
  "profiles.relationship.block": "Block",
  "profiles.relationship.blocked": "Blocked",
  "profiles.relationship.unblock": "Unblock",
  "profiles.relationship.self": "This is you",
  "profiles.list.followers": "Followers",
  "profiles.list.following": "Following",
  "profiles.list.blocked": "Blocked",
  "profiles.list.empty": "Nobody here yet.",
};

/**
 * Register profiles-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerProfilesI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, profilesI18nBundleEn);
}
