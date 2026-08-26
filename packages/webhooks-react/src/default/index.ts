/**
 * `@stapel/webhooks-react/default` — the pair's default AntD skin (§54: a pair
 * ships a FEATURE, not only a bag). A separate entry point, so a host that
 * brings its own visuals never pulls `antd` or the token bridge into its
 * bundle; importing this subpath is the opt-in.
 *
 * ```tsx
 * import { WebhooksSettingsPane } from "@stapel/webhooks-react/default";
 * // under the pair's <WebhooksProvider> + core's <I18nProvider>:
 * <WebhooksSettingsPane />
 * ```
 *
 * The page is `WebhooksSettingsPane`; everything under it is exported too,
 * because a host that builds its own settings layout should be able to mount
 * the delivery log next to its own chrome rather than re-implementing it.
 */
export { WebhooksSettingsPane } from "./WebhooksSettingsPane.js";
export type { WebhooksSettingsPaneProps } from "./WebhooksSettingsPane.js";
export { SubscriptionsPane } from "./SubscriptionsPane.js";
export type { SubscriptionsPaneProps } from "./SubscriptionsPane.js";
export { SubscriptionSheet } from "./SubscriptionSheet.js";
export type { SubscriptionSheetProps } from "./SubscriptionSheet.js";
export { SecretReveal } from "./SecretReveal.js";
export type { SecretRevealProps } from "./SecretReveal.js";
export { SecretRotation } from "./SecretRotation.js";
export type { SecretRotationProps } from "./SecretRotation.js";
export { DeliveriesPane } from "./DeliveriesPane.js";
export type { DeliveriesPaneProps } from "./DeliveriesPane.js";
export { DeliveryDetailSheet } from "./DeliveryDetailSheet.js";
export type { DeliveryDetailSheetProps } from "./DeliveryDetailSheet.js";
export { MandateNotice } from "./MandateNotice.js";
export type { MandateNoticeProps } from "./MandateNotice.js";
export {
  deliveryLabelKey,
  deliveryStatusKey,
  deliveryStatusColor,
  targetFieldLabelKey,
} from "./labels.js";
export {
  CODE_BLOCK_STYLE,
  DIALOG_ACTION_BAR_STYLE,
  SETTINGS_MAX_WIDTH,
} from "./layout.js";
export type { ThemeModeProp } from "./types.js";
