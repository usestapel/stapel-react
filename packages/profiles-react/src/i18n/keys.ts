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
  /** Retry affordance beside a `failed` arm's alert (matchList/matchLoad). */
  actionRetry: "profiles.action.retry",
  /**
   * Dismiss a dialog — the accessible name of a modal's close button and of a
   * bottom sheet's grab handle. `@stapel/tokens-antd/skin`'s `SkinDialog`
   * requires the CALLER to supply it: the token bridge owns no i18n and must
   * not invent user-facing English.
   */
  actionClose: "profiles.action.close",
  // My profile (MyProfile headless)
  profileLoading: "profiles.profile.loading",
  profileSave: "profiles.profile.save",
  profileSaving: "profiles.profile.saving",
  profileSaved: "profiles.profile.saved",
  /** Why "Save" is off: the draft is the value already stored (a reason that
   * is the row itself, stated as text rather than left to a grey button). */
  profileNoChanges: "profiles.profile.no_changes",
  // Relationship (Relationship headless + default skin)
  relFollow: "profiles.relationship.follow",
  relFollowing: "profiles.relationship.following",
  relUnfollow: "profiles.relationship.unfollow",
  relBlock: "profiles.relationship.block",
  relBlocked: "profiles.relationship.blocked",
  relUnblock: "profiles.relationship.unblock",
  relSelf: "profiles.relationship.self",
  /** Block and unblock are the pair's two irreversible-feeling actions, so
   * both go through `SkinConfirm` and both name what they do. */
  relBlockConfirmTitle: "profiles.relationship.confirm_block.title",
  relBlockConfirmBody: "profiles.relationship.confirm_block.body",
  relUnblockConfirmTitle: "profiles.relationship.confirm_unblock.title",
  relUnblockConfirmBody: "profiles.relationship.confirm_unblock.body",
  /** Standing state, shown beside the controls — not a toast. */
  relBlockedNotice: "profiles.relationship.blocked_notice",
  // Why a relationship control is switched off (ActionBlock codes — the reason
  // renders BESIDE the control via GatedButton, never in a tooltip).
  relBlockedSelf: "profiles.relationship.blocked.self",
  relBlockedWhileBlocked: "profiles.relationship.blocked.blocked",
  relBlockedUnknown: "profiles.relationship.blocked.unknown",
  // Connection lists (ConnectionList headless + default skin)
  listFollowers: "profiles.list.followers",
  listFollowing: "profiles.list.following",
  listBlocked: "profiles.list.blocked",
  listEmpty: "profiles.list.empty",
  /** Count families — `tPlural`, never "N follower(s)". Declared here as the
   * FAMILY key; each locale spells its own CLDR categories underneath. */
  countFollowers: "profiles.list.count.followers",
  countFollowing: "profiles.list.count.following",
  countBlocked: "profiles.list.count.blocked",
  // Each list's empty state is its own sentence: "nobody follows you yet" and
  // "you have blocked nobody" are good news and neutral news, not one string.
  emptyFollowers: "profiles.list.empty.followers",
  emptyFollowersHint: "profiles.list.empty.followers_hint",
  emptyFollowing: "profiles.list.empty.following",
  emptyFollowingHint: "profiles.list.empty.following_hint",
  emptyBlocked: "profiles.list.empty.blocked",
  emptyBlockedHint: "profiles.list.empty.blocked_hint",
  // Identity row (PersonRow — the pair's one identity primitive; §83: a user
  // id must never reach the glass).
  personUnnamed: "profiles.person.unnamed",
  personYou: "profiles.person.you",
  /** POST /batch answered `missing` for this id — a normal state (the person
   * exists, the profile row does not), not a failure. */
  personMissing: "profiles.person.missing",
  // Connections page (ConnectionsPage default skin)
  connectionsTitle: "profiles.connections.title",
  connectionsSubtitle: "profiles.connections.subtitle",
  connectionsKindLabel: "profiles.connections.kind_label",
  // Public profile page (PublicProfilePage default skin)
  /** stapel-profiles 0.15.0: a registered person who never filled anything in
   * answers 200 with an empty-but-renderable profile. That is a state to
   * DESIGN, not a 404 to report. */
  publicUnwritten: "profiles.public.unwritten",
  publicLocation: "profiles.public.location",
  publicRating: "profiles.public.rating",
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
  /** Why Save is off: the display name is still blank (an ActionBlock code). */
  initialSetupNameRequired: "profiles.initialSetup.blocked.name_required",
  // Language settings (default skin — LanguageSettings)
  languageTitle: "profiles.language.title",
  languageSubtitle: "profiles.language.subtitle",
  fieldAppLanguage: "profiles.language.field.app_language",
  languageAuto: "profiles.language.field.auto",
  fieldUnderstands: "profiles.language.field.understands",
  /** The catalogue loaded and is genuinely empty — the ONE place allowed to
   * say there is nothing to pick. */
  languagesEmpty: "profiles.language.catalogue_empty",
  // Notification preferences matrix (default skin — NotificationPreferences)
  notifPrefsTitle: "profiles.notif_prefs.title",
  notifPrefsSubtitle: "profiles.notif_prefs.subtitle",
  notifCategoryMessages: "profiles.notif_prefs.category.messages",
  notifCategorySystem: "profiles.notif_prefs.category.system",
  notifChannelEmail: "profiles.notif_prefs.channel.email",
  notifChannelPush: "profiles.notif_prefs.channel.push",
  /** Accessible name for one matrix cell's switch — a `Switch` in a table
   * cell announces "switch, off" with no subject unless it carries the row
   * AND the column itself. `{category}` × `{channel}`. */
  notifToggleLabel: "profiles.notif_prefs.toggle_label",
  // Nav-manifest labels (`../nav/manifest.ts`) — read by a shell (e.g.
  // `@stapel/shell-react`'s `AppShell`) via `t(entry.labelKey)`.
  navSettings: "profiles.nav.settings",
  navLanguage: "profiles.nav.language",
  navNotifications: "profiles.nav.notifications",
  navConnections: "profiles.nav.connections",
  navPublicProfile: "profiles.nav.public_profile",
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
  "profiles.action.retry": "Try again",
  "profiles.action.close": "Close",
  "profiles.profile.loading": "Loading profile…",
  "profiles.profile.save": "Save changes",
  "profiles.profile.saving": "Saving…",
  "profiles.profile.saved": "Profile saved.",
  "profiles.profile.no_changes": "Nothing to save — this is the value already stored.",
  "profiles.relationship.follow": "Follow",
  "profiles.relationship.following": "Following",
  "profiles.relationship.unfollow": "Unfollow",
  "profiles.relationship.block": "Block",
  "profiles.relationship.blocked": "Blocked",
  "profiles.relationship.unblock": "Unblock",
  "profiles.relationship.self": "This is you",
  "profiles.relationship.confirm_block.title": "Block {name}?",
  "profiles.relationship.confirm_block.body":
    "They stop following you, and they cannot follow you again until you unblock them.",
  "profiles.relationship.confirm_unblock.title": "Unblock {name}?",
  "profiles.relationship.confirm_unblock.body":
    "They will be able to follow you again. Following is not restored automatically.",
  "profiles.relationship.blocked_notice": "You blocked this person.",
  "profiles.relationship.blocked.self": "This is your own profile.",
  "profiles.relationship.blocked.blocked": "Unblock this person before you can follow them.",
  "profiles.relationship.blocked.unknown":
    "We could not read your relationship with this person.",
  "profiles.list.followers": "Followers",
  "profiles.list.following": "Following",
  "profiles.list.blocked": "Blocked",
  "profiles.list.empty": "Nobody here yet.",
  "profiles.list.count.followers.one": "{count} follower",
  "profiles.list.count.followers.other": "{count} followers",
  "profiles.list.count.following.one": "{count} person you follow",
  "profiles.list.count.following.other": "{count} people you follow",
  "profiles.list.count.blocked.one": "{count} blocked person",
  "profiles.list.count.blocked.other": "{count} blocked people",
  "profiles.list.empty.followers": "No followers yet",
  "profiles.list.empty.followers_hint": "When somebody follows you, they appear here.",
  "profiles.list.empty.following": "You are not following anybody yet",
  "profiles.list.empty.following_hint": "Follow somebody from their profile to see them here.",
  "profiles.list.empty.blocked": "You have not blocked anybody",
  "profiles.list.empty.blocked_hint": "A blocked person cannot follow you or see your profile.",
  "profiles.person.unnamed": "Unnamed",
  "profiles.person.you": "You",
  "profiles.person.missing": "Profile not set up",
  "profiles.connections.title": "Connections",
  "profiles.connections.subtitle":
    "The people who follow you, the people you follow, and everybody you have blocked.",
  "profiles.connections.kind_label": "Which list to show",
  "profiles.public.unwritten": "This person has not set up their profile yet.",
  "profiles.public.location": "Location",
  "profiles.public.rating": "Rating",
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
  "profiles.initialSetup.blocked.name_required": "Enter a display name to continue.",
  "profiles.language.title": "Language",
  "profiles.language.subtitle": "Choose the language you'd like to see the app in.",
  "profiles.language.field.app_language": "App language",
  "profiles.language.field.auto": "Auto",
  "profiles.language.field.understands": "Languages you understand",
  "profiles.language.catalogue_empty": "No languages are available to choose from.",
  "profiles.notif_prefs.title": "Notifications",
  "profiles.notif_prefs.subtitle": "Choose which notifications reach you, and how.",
  "profiles.notif_prefs.category.messages": "Messages",
  "profiles.notif_prefs.category.system": "System",
  "profiles.notif_prefs.channel.email": "Email",
  "profiles.notif_prefs.channel.push": "Push",
  "profiles.notif_prefs.toggle_label": "{category} notifications via {channel}",
  "profiles.nav.settings": "Settings",
  "profiles.nav.language": "Language",
  "profiles.nav.notifications": "Notifications",
  "profiles.nav.connections": "Connections",
  "profiles.nav.public_profile": "Public profile",
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
