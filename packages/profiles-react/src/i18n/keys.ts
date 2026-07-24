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
  // Profile settings (default skin — ProfileSettings)
  settingsTitle: "profiles.settings.title",
  settingsSubtitle: "profiles.settings.subtitle",
  avatarChange: "profiles.settings.avatar.change",
  avatarUploading: "profiles.settings.avatar.uploading",
  avatarUploadError: "profiles.settings.avatar.upload_error",
  // Hard-core Profile fields (stapel-profiles ≥0.7.0 — display_name/theme are
  // model columns again, never field-manifest entries, so their labels are
  // pair-owned keys rather than backend docstrings).
  fieldDisplayName: "profiles.settings.field.display_name",
  fieldTheme: "profiles.settings.field.theme",
  themeLight: "profiles.settings.theme.light",
  themeDark: "profiles.settings.theme.dark",
  themeSystem: "profiles.settings.theme.system",
  // Initial setup (InitialSetupPrompt headless / InitialSetupModal default
  // skin — workspaces-org-program §B5, texts ported from ironmemo's
  // onboarding-modal). Field labels reuse the settings-canon keys above
  // (fieldDisplayName, fieldTheme + themes, fieldAppLanguage) so first-run
  // and settings read identically.
  initialSetupTitle: "profiles.initialSetup.title",
  initialSetupSubtitle: "profiles.initialSetup.subtitle",
  initialSetupNamePlaceholder: "profiles.initialSetup.name_placeholder",
  initialSetupSave: "profiles.initialSetup.save",
  initialSetupSaving: "profiles.initialSetup.saving",
  initialSetupSkip: "profiles.initialSetup.skip",
  // Language settings (default skin — LanguageSettings)
  languageTitle: "profiles.language.title",
  languageSubtitle: "profiles.language.subtitle",
  fieldAppLanguage: "profiles.language.field.app_language",
  languageAuto: "profiles.language.field.auto",
  fieldUnderstands: "profiles.language.field.understands",
  // Notification preferences matrix (default skin — NotificationPreferences)
  notifPrefsTitle: "profiles.notif_prefs.title",
  notifPrefsSubtitle: "profiles.notif_prefs.subtitle",
  notifCategoryMessages: "profiles.notif_prefs.category.messages",
  notifCategorySystem: "profiles.notif_prefs.category.system",
  notifChannelEmail: "profiles.notif_prefs.channel.email",
  notifChannelPush: "profiles.notif_prefs.channel.push",
  // Nav-manifest label (`../nav/manifest.ts`) — read by a shell (e.g.
  // `@stapel/shell-react`'s `AppShell`) via `t(entry.labelKey)`.
  navSettings: "profiles.nav.settings",
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
  "profiles.settings.title": "Profile",
  "profiles.settings.subtitle": "Your name, avatar, and general preferences.",
  "profiles.settings.avatar.change": "Change avatar",
  "profiles.settings.avatar.uploading": "Uploading…",
  "profiles.settings.avatar.upload_error": "Couldn't upload that image. Please try again.",
  "profiles.settings.field.display_name": "Display name",
  "profiles.settings.field.theme": "Theme",
  "profiles.settings.theme.light": "Light",
  "profiles.settings.theme.dark": "Dark",
  "profiles.settings.theme.system": "System",
  "profiles.initialSetup.title": "Welcome — let's set up your profile",
  "profiles.initialSetup.subtitle":
    "Tell us a bit about yourself. You can change these later in profile settings.",
  "profiles.initialSetup.name_placeholder": "Your name",
  "profiles.initialSetup.save": "Continue",
  "profiles.initialSetup.saving": "Saving…",
  "profiles.initialSetup.skip": "Maybe later",
  "profiles.language.title": "Language",
  "profiles.language.subtitle": "Choose the language you'd like to see the app in.",
  "profiles.language.field.app_language": "App language",
  "profiles.language.field.auto": "Auto",
  "profiles.language.field.understands": "Languages you understand",
  "profiles.notif_prefs.title": "Notifications",
  "profiles.notif_prefs.subtitle": "Choose which notifications reach you, and how.",
  "profiles.notif_prefs.category.messages": "Messages",
  "profiles.notif_prefs.category.system": "System",
  "profiles.notif_prefs.channel.email": "Email",
  "profiles.notif_prefs.channel.push": "Push",
  "profiles.nav.settings": "Settings",
};

/**
 * Register profiles-react's key bundle into a core i18n engine (call once at
 * startup). Registers under the given locale (default `"en"`); a later
 * `loadLocale` from stapel-translate can layer localized overrides.
 *
 * MERGE-PRIORITY CONVENTION (pair checklist rule; i18n-shipping.md §3 — every
 * `@stapel/*-react` pair follows it): registration order IS override
 * priority, later wins per key. Within a locale, layers register bottom-up:
 *
 *   1. generated en floor  (`ProfilesErrorBundleEn` — coverage by construction),
 *   2. the pair's polish / UI copy (this bundle spreads 1 then overrides),
 *   3. the pair's locale bundle from the `./i18n/<locale>` subpath
 *      (e.g. `registerProfilesI18nRu` — registers the en floor UNDER the
 *      locale texts so a missing key degrades to English, never a raw key),
 *   4. the HOST's own bundle — always registered LAST, so a host overrides any
 *      pair text without a fork.
 *
 * Dynamic overrides (stapel-translate `loadLocale`) layer on top at runtime.
 */
export function registerProfilesI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, profilesI18nBundleEn);
}
