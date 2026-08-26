/**
 * Wire enum → i18n key, in one table per axis.
 *
 * Every one of these has the same fallback shape, and the fallback is the
 * point: the delivery-type registry is extensible and the delivery status
 * could gain a value in a backend minor, so a `switch` with no default would
 * render a raw wire token (`ws`, `retrying`) at a person the first time either
 * one moved. Instead an unrecognised value renders the "unknown ({x})" copy,
 * which is honest and still tells an operator what the server said.
 */
import {
  DELIVERY_CUSTOM,
  DELIVERY_NOTIFICATION,
  DELIVERY_WEBHOOK,
  DELIVERY_WS,
} from "../model/deliveryTypes.js";
import { WEBHOOKS_I18N_KEYS } from "../i18n/keys.js";

/** Copy for a delivery type. A host-registered type renders its own name. */
export function deliveryLabelKey(name: string): string {
  switch (name) {
    case DELIVERY_WEBHOOK:
      return WEBHOOKS_I18N_KEYS.deliveryWebhook;
    case DELIVERY_NOTIFICATION:
      return WEBHOOKS_I18N_KEYS.deliveryNotification;
    case DELIVERY_WS:
      return WEBHOOKS_I18N_KEYS.deliveryWs;
    case DELIVERY_CUSTOM:
      return WEBHOOKS_I18N_KEYS.deliveryCustom;
    default:
      // The registry name itself — all this package knows about a type a
      // deployment added at runtime.
      return WEBHOOKS_I18N_KEYS.deliveryUnknown;
  }
}

/** Copy for one target field of a built-in delivery type. */
export function targetFieldLabelKey(field: string): string {
  switch (field) {
    case "url":
      return WEBHOOKS_I18N_KEYS.formUrl;
    case "notification_type":
      return WEBHOOKS_I18N_KEYS.formNotificationType;
    case "stream":
      return WEBHOOKS_I18N_KEYS.formStream;
    case "path":
      return WEBHOOKS_I18N_KEYS.formPath;
    case "user_id":
    case "email":
    case "phone":
    case "telegram_chat_id":
      return WEBHOOKS_I18N_KEYS.formRecipient;
    default:
      return WEBHOOKS_I18N_KEYS.formTargetField;
  }
}

/** Copy for a delivery status. */
export function deliveryStatusKey(status: string): string {
  switch (status) {
    case "pending":
      return WEBHOOKS_I18N_KEYS.logStatusPending;
    case "retrying":
      return WEBHOOKS_I18N_KEYS.logStatusRetrying;
    case "succeeded":
      return WEBHOOKS_I18N_KEYS.logStatusSucceeded;
    case "dead":
      return WEBHOOKS_I18N_KEYS.logStatusDead;
    default:
      return WEBHOOKS_I18N_KEYS.logStatusUnknown;
  }
}

/**
 * The antd `Tag` colour token for a status. Semantic names, never hex: the
 * palette is the theme's, and "dead" must be the same red as every other
 * failure in the host's app.
 */
export function deliveryStatusColor(status: string): string {
  switch (status) {
    case "succeeded":
      return "success";
    case "dead":
      return "error";
    case "retrying":
      return "warning";
    default:
      return "processing";
  }
}
