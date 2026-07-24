/**
 * `@stapel/profiles-react/default` — the pilot default skin for this pair's
 * settings surfaces (mirrors auth-react's `/default` split, §54): a separate
 * entry point so consumers who bring their own visuals never pull `antd` into
 * their bundle; importing this subpath is the opt-in.
 *
 * ```tsx
 * import { ProfileSettings, LanguageSettings, NotificationPreferences } from "@stapel/profiles-react/default";
 * // under this pair's <ProfilesProvider> + core <I18nProvider>:
 * <ProfileSettings />
 * ```
 */
export { ProfileSettings } from "./ProfileSettings.js";
export type { ProfileSettingsProps } from "./ProfileSettings.js";
export { LanguageSettings } from "./LanguageSettings.js";
export type { LanguageSettingsProps } from "./LanguageSettings.js";
export { NotificationPreferences } from "./NotificationPreferences.js";
export type { NotificationPreferencesProps } from "./NotificationPreferences.js";
export { InitialSetupModal } from "./InitialSetupModal.js";
export type { InitialSetupModalProps } from "./InitialSetupModal.js";
