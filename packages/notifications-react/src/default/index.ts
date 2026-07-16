/**
 * `@stapel/notifications-react/default` — the pilot default skin for this
 * pair's settings surfaces (mirrors auth-react's `/default` split, §54): a
 * separate entry point so consumers who bring their own visuals never pull
 * `antd` into their bundle; importing this subpath is the opt-in.
 *
 * ```tsx
 * import { PushNotificationToggle, NotificationFeedList } from "@stapel/notifications-react/default";
 * // under this pair's <NotificationsProvider> + core <I18nProvider>:
 * <PushNotificationToggle getToken={() => resolveMyPushToken()} />
 * ```
 */
export { PushNotificationToggle } from "./PushNotificationToggle.js";
export type { PushNotificationToggleProps } from "./PushNotificationToggle.js";
export { NotificationFeedList } from "./NotificationFeedList.js";
export type { NotificationFeedListProps } from "./NotificationFeedList.js";
