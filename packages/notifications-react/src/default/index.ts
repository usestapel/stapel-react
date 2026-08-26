/**
 * `@stapel/notifications-react/default` — this pair's default skin: the
 * notifications PAGE, the feed list, and the push-notification settings
 * surfaces. A separate entry point so consumers who bring their own visuals
 * never pull `antd` into their bundle; importing this subpath is the opt-in
 * (§54, and the same split `auth-react` uses).
 *
 * ```tsx
 * import { NotificationsPage, PushSettingsPane } from "@stapel/notifications-react/default";
 * // under this pair's <NotificationsProvider> + core <I18nProvider>:
 * <NotificationsPage />
 * <PushSettingsPane getToken={mintPushToken} currentToken={readSubscription} />
 * ```
 *
 * Every visual decision these components do NOT take themselves — light/dark,
 * the 44px phone control floor, the dialog-is-a-sheet rule, the designed
 * loading/failed/empty arms, a blocked control's reason — comes from
 * `@stapel/tokens-antd/skin`. This package used to carry its own `theme.tsx`
 * and its own `ErrorAlert.tsx`; both are gone.
 */
export { NotificationsPage } from "./NotificationsPage.js";
export type { NotificationsPageProps } from "./NotificationsPage.js";
export { NotificationFeedList } from "./NotificationFeedList.js";
export type { NotificationFeedListProps } from "./NotificationFeedList.js";
export { NotificationBell } from "./NotificationBell.js";
export type { NotificationBellProps } from "./NotificationBell.js";
export { PushSettingsPane } from "./PushSettingsPane.js";
export type { PushSettingsPaneProps } from "./PushSettingsPane.js";
export { PushNotificationToggle } from "./PushNotificationToggle.js";
export type { PushNotificationToggleProps } from "./PushNotificationToggle.js";
export { PushDeviceList } from "./PushDeviceList.js";
export type { PushDeviceListProps } from "./PushDeviceList.js";
