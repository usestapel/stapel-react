/**
 * `@stapel/profiles-react/default` — this pair's default skin (§54/§83: every
 * headless primitive carries an AntD implementation, and the default skins ARE
 * the product). A separate entry point so consumers who bring their own
 * visuals never pull `antd` into their bundle; importing this subpath is the
 * opt-in.
 *
 * ```tsx
 * import { ProfileSettings, ConnectionsPage, PublicProfilePage } from "@stapel/profiles-react/default";
 * // under this pair's <ProfilesProvider> + core <I18nProvider>:
 * <ProfileSettings />
 * ```
 *
 * Two halves, both now covered:
 *
 *  - **settings** — `ProfileSettings` (which composes `LanguageSettings` and
 *    `NotificationPreferences`), plus `InitialSetupModal` for first run.
 *  - **the social graph** — `ConnectionsPage` / `ConnectionList` over the
 *    followers/following/blocked reads, `PublicProfilePage` over
 *    `GET /{user_id}`, and `Relationship` over the four relationship actions.
 *    Every one of them draws people through `PersonRow`, the pair's one
 *    identity primitive: a user id never reaches the glass.
 */
export { ProfileSettings, SETTINGS_AVATAR } from "./ProfileSettings.js";
export type { ProfileSettingsProps } from "./ProfileSettings.js";
export { LanguageSettings, SETTINGS_MAX_WIDTH } from "./LanguageSettings.js";
export type { LanguageSettingsProps } from "./LanguageSettings.js";
export {
  NotificationPreferences,
  NOTIFICATION_CHANNEL_MIN_WIDTH,
} from "./NotificationPreferences.js";
export type { NotificationPreferencesProps } from "./NotificationPreferences.js";
export { InitialSetupModal } from "./InitialSetupModal.js";
export type { InitialSetupModalProps } from "./InitialSetupModal.js";
export {
  PersonRow,
  personMonogram,
  PERSON_ROW_AVATAR,
  PERSON_HEADER_AVATAR,
} from "./PersonRow.js";
export type { PersonRowProps } from "./PersonRow.js";
export { Relationship } from "./Relationship.js";
export type { RelationshipProps } from "./Relationship.js";
export { ConnectionList, CONNECTION_ROW_MIN_WIDTH } from "./ConnectionList.js";
export type { ConnectionListProps } from "./ConnectionList.js";
export { ConnectionsPage, CONNECTIONS_MAX_WIDTH } from "./ConnectionsPage.js";
export type { ConnectionsPageProps } from "./ConnectionsPage.js";
export { PublicProfilePage, PUBLIC_PROFILE_MAX_WIDTH } from "./PublicProfilePage.js";
export type { PublicProfilePageProps } from "./PublicProfilePage.js";
