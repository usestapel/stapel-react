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
  /** The offer on the Followers list, where the target already follows the
   * caller — a different offer from a cold "Follow", and the word for it. */
  relFollowBack: "profiles.relationship.follow_back",
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
  /**
   * The tenure line (`<MemberSince/>`) — `{date}` is a MONTH AND A YEAR
   * already formatted at the app's locale, never an ISO string.
   *
   * The Russian text states the fact as "registration date: <month year>"
   * rather than with a preposition: `Intl` writes the month in the nominative
   * case and every Russian "since <month>" phrasing governs the genitive, so
   * the SENTENCE moves rather than the formatter (see
   * `default/MemberSince.tsx`).
   */
  publicMemberSince: "profiles.public.member_since",
  /**
   * The heading over the trading capacity — the answer to "am I buying from a
   * person or from a shop", which is a different question from who they are.
   */
  publicSellerType: "profiles.public.seller_type",
  /**
   * The following count in the THIRD person. `countFollowing` is the caller's
   * own-list copy ("31 people you follow") and it was being rendered on other
   * people's profiles, where it stated a fact about the visitor that was not
   * true. Followers needs no twin: "128 followers" is already about whoever
   * the page is about.
   */
  publicCountFollowing: "profiles.public.count.following",
  /**
   * The two shipped values of `seller_type`, as words.
   *
   * The wire value is the SELF-DECLARED capacity (`private` / `business`) and
   * it is not a caption: "business" over a seller card in a Russian storefront
   * is an English word for a Russian shop. `sellerTypeLabelKey` maps the value
   * to one of these; a deployment that registers a third value gets no key and
   * the raw value stays on screen, which is the honest bottom of every label
   * ladder in this fleet.
   */
  sellerTypePrivate: "profiles.seller_type.private",
  sellerTypeBusiness: "profiles.seller_type.business",
  // Seller page sections (SellerPage default skin + model/sellerTabs)
  /**
   * The three sections of a public seller page. They are SECTION names, not
   * sentences: each sits on a tab a phone has to fit three of, so the words
   * stay one each in every locale.
   *
   * `overview` is the introduction. The Russian word for it is the reference's
   * — "the main one", not "the home page" — while English says "Overview" and
   * Spanish "Resumen", because "Home" inside somebody's profile reads as the
   * site's own home in both.
   */
  sellerTabOverview: "profiles.seller.tab.overview",
  sellerTabListings: "profiles.seller.tab.listings",
  sellerTabReviews: "profiles.seller.tab.reviews",
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
  /** The accessible name of a read-only row's edit control — what activating
   * it DOES, not the field label the row above already says. */
  profileEditField: "profiles.settings.field.edit",
  fieldTheme: "profiles.settings.field.theme",
  themeLight: "profiles.settings.theme.light",
  themeDark: "profiles.settings.theme.dark",
  themeSystem: "profiles.settings.theme.system",
  // Initial setup (InitialSetupPrompt headless / InitialSetupModal default
  // skin — workspaces-org-program §B5, texts ported from a client's
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
  // Contacts — the seller's phone numbers (stapel-profiles ≥0.20.0).
  // The OWNER's screen (<ContactsManager/>) and the VIEWER's button
  // (<RevealPhoneButton/>) are two different audiences: one is managing
  // their own numbers, the other is asking for somebody else's.
  contactsTitle: "profiles.contacts.title",
  contactsSubtitle: "profiles.contacts.subtitle",
  contactsEmpty: "profiles.contacts.empty",
  contactsEmptyHint: "profiles.contacts.empty_hint",
  /** The owner's own number is masked at rest; this reveals it to the person
   * whose number it is, on their own screen, on demand. */
  contactsShowNumber: "profiles.contacts.show_number",
  contactsHideNumber: "profiles.contacts.hide_number",
  contactsVerified: "profiles.contacts.verified",
  contactsUnverified: "profiles.contacts.unverified",
  /** Why an unverified number is not a published number — the state, stated,
   * rather than a number that silently reaches nobody. */
  contactsUnverifiedHint: "profiles.contacts.unverified_hint",
  contactsPolicyLabel: "profiles.contacts.policy_label",
  /**
   * The policy vocabulary, keyed BY POLICY ID: the server sends the ids it
   * accepts (`policies`) and the picker looks each one up here. A deployment
   * that registers a policy this pair has no word for shows the raw id, which
   * is the honest bottom of every label ladder in this fleet.
   */
  contactsPolicyMembers: "profiles.contacts.policy.members",
  contactsPolicyVerified: "profiles.contacts.policy.verified",
  contactsPolicyNobody: "profiles.contacts.policy.nobody",
  contactsEnabledLabel: "profiles.contacts.enabled_label",
  contactsLabelField: "profiles.contacts.label_field",
  contactsLabelPlaceholder: "profiles.contacts.label_placeholder",
  contactsNumberField: "profiles.contacts.number_field",
  contactsNumberPlaceholder: "profiles.contacts.number_placeholder",
  contactsAdd: "profiles.contacts.add",
  contactsAdding: "profiles.contacts.adding",
  contactsDelete: "profiles.contacts.delete",
  contactsDeleteConfirmTitle: "profiles.contacts.confirm_delete.title",
  contactsDeleteConfirmBody: "profiles.contacts.confirm_delete.body",
  /** The hand-over counters, one line: this number, this often. */
  contactsRevealsTotal: "profiles.contacts.reveals.total",
  contactsReveals24h: "profiles.contacts.reveals.last_24h",
  contactsReveals7d: "profiles.contacts.reveals.last_7d",
  // Verification (request → code → confirm), the owner's half.
  contactsVerify: "profiles.contacts.verify",
  contactsVerifySending: "profiles.contacts.verify.sending",
  contactsVerifySent: "profiles.contacts.verify.sent",
  /** How long the code stays good, when the provider says. `{seconds}`. */
  contactsVerifyExpires: "profiles.contacts.verify.expires_in",
  contactsCodeField: "profiles.contacts.verify.code_field",
  contactsCodePlaceholder: "profiles.contacts.verify.code_placeholder",
  contactsCodeConfirm: "profiles.contacts.verify.confirm",
  contactsCodeConfirming: "profiles.contacts.verify.confirming",
  contactsCodeResend: "profiles.contacts.verify.resend",
  contactsCodeCancel: "profiles.contacts.verify.cancel",
  /** How many tries are left after a wrong code — the backend says, and the
   * screen repeats it rather than letting the person find out by running out.
   * `{count}` (a plural family). */
  contactsAttemptsLeft: "profiles.contacts.verify.attempts_left",
  // The VIEWER's button (<RevealPhoneButton/>).
  contactsRevealShow: "profiles.contacts.reveal.show",
  contactsRevealLoading: "profiles.contacts.reveal.loading",
  /** The seller's answer was an empty list — they have no number this viewer
   * may be handed, and the wire deliberately does not say which of the two
   * reasons it is. */
  contactsRevealNone: "profiles.contacts.reveal.none",
  /** Over the hourly budget. `{count}` MINUTES (a plural family) — the wire
   * says seconds and a person reads minutes. */
  contactsRevealBudget: "profiles.contacts.reveal.budget",
  /** No account (signed out OR a guest): the sentence beside the door the
   * host renders. */
  contactsRevealRegister: "profiles.contacts.reveal.register",
  contactsRevealCopy: "profiles.contacts.reveal.copy",
  contactsRevealCopied: "profiles.contacts.reveal.copied",
  /** The accessible name of a revealed number's `tel:` link — "Call {label}"
   * reads better in a screen reader than the digits twice. */
  contactsRevealCall: "profiles.contacts.reveal.call",
  // Nav-manifest labels (`../nav/manifest.ts`) — read by a shell (e.g.
  // `@stapel/shell-react`'s `AppShell`) via `t(entry.labelKey)`.
  navSettings: "profiles.nav.settings",
  navLanguage: "profiles.nav.language",
  navNotifications: "profiles.nav.notifications",
  navContacts: "profiles.nav.contacts",
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
  "profiles.relationship.follow_back": "Follow back",
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
  "profiles.public.member_since": "Member since {date}",
  "profiles.public.seller_type": "Seller",
  "profiles.public.count.following.one": "Follows {count} person",
  "profiles.public.count.following.other": "Follows {count} people",
  "profiles.seller_type.private": "Private individual",
  "profiles.seller_type.business": "Company",
  "profiles.seller.tab.overview": "Overview",
  "profiles.seller.tab.listings": "Listings",
  "profiles.seller.tab.reviews": "Reviews",
  "profiles.settings.title": "Profile",
  "profiles.settings.subtitle": "Your name, avatar, and general preferences.",
  "profiles.settings.avatar.change": "Change avatar",
  "profiles.settings.avatar.uploading": "Uploading…",
  "profiles.settings.avatar.upload_error": "Couldn't upload that image. Please try again.",
  "profiles.settings.field.display_name": "Display name",
  "profiles.settings.field.edit": "Edit {field}",
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
  "profiles.contacts.title": "Phone numbers",
  "profiles.contacts.subtitle":
    "Numbers buyers can ask for. You decide who may be handed each one, and you can see how often it happened.",
  "profiles.contacts.empty": "You have not added a number yet",
  "profiles.contacts.empty_hint":
    "Add a number and confirm it by SMS — until it is confirmed, nobody is handed it.",
  "profiles.contacts.show_number": "Show the number",
  "profiles.contacts.hide_number": "Hide the number",
  "profiles.contacts.verified": "Confirmed",
  "profiles.contacts.unverified": "Not confirmed",
  "profiles.contacts.unverified_hint":
    "Confirm this number by SMS — until then it is handed to nobody.",
  "profiles.contacts.policy_label": "Who may be handed it",
  "profiles.contacts.policy.members": "Anybody with an account",
  "profiles.contacts.policy.verified": "Confirmed accounts only",
  "profiles.contacts.policy.nobody": "Nobody",
  "profiles.contacts.enabled_label": "Switched on",
  "profiles.contacts.label_field": "Label",
  "profiles.contacts.label_placeholder": "Work",
  "profiles.contacts.number_field": "Phone number",
  "profiles.contacts.number_placeholder": "+15550100",
  "profiles.contacts.add": "Add number",
  "profiles.contacts.adding": "Adding…",
  "profiles.contacts.delete": "Delete",
  "profiles.contacts.confirm_delete.title": "Delete this number?",
  "profiles.contacts.confirm_delete.body":
    "It stops being handed to anybody, and the record of who asked for it goes with it.",
  "profiles.contacts.reveals.total": "Handed over {count} times in total",
  "profiles.contacts.reveals.last_24h": "{count} in the last 24 hours",
  "profiles.contacts.reveals.last_7d": "{count} in the last 7 days",
  "profiles.contacts.verify": "Confirm by SMS",
  "profiles.contacts.verify.sending": "Sending…",
  "profiles.contacts.verify.sent": "We sent a code to this number.",
  "profiles.contacts.verify.expires_in": "The code is good for {seconds} seconds.",
  "profiles.contacts.verify.code_field": "Code from the SMS",
  "profiles.contacts.verify.code_placeholder": "123456",
  "profiles.contacts.verify.confirm": "Confirm",
  "profiles.contacts.verify.confirming": "Confirming…",
  "profiles.contacts.verify.resend": "Send the code again",
  "profiles.contacts.verify.cancel": "Not now",
  "profiles.contacts.verify.attempts_left.one": "{count} attempt left.",
  "profiles.contacts.verify.attempts_left.other": "{count} attempts left.",
  "profiles.contacts.reveal.show": "Show phone number",
  "profiles.contacts.reveal.loading": "Asking…",
  "profiles.contacts.reveal.none": "This seller has no phone number to show.",
  "profiles.contacts.reveal.budget.one":
    "Too many phone lookups. Try again in {count} minute.",
  "profiles.contacts.reveal.budget.other":
    "Too many phone lookups. Try again in {count} minutes.",
  "profiles.contacts.reveal.register":
    "Register an account to see a seller's phone number.",
  "profiles.contacts.reveal.copy": "Copy",
  "profiles.contacts.reveal.copied": "Copied",
  "profiles.contacts.reveal.call": "Call {label}",
  "profiles.nav.settings": "Settings",
  "profiles.nav.language": "Language",
  "profiles.nav.notifications": "Notifications",
  "profiles.nav.contacts": "Phone numbers",
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
