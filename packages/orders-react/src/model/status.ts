import type { OrderStatus } from "../api/types.js";
import { ORDERS_I18N_KEYS } from "../i18n/keys.js";

const STATUS_KEYS: Readonly<Record<OrderStatus, string>> = {
  new: ORDERS_I18N_KEYS.statusNew,
  confirmed: ORDERS_I18N_KEYS.statusConfirmed,
  shipped: ORDERS_I18N_KEYS.statusShipped,
  completed: ORDERS_I18N_KEYS.statusCompleted,
  cancelled: ORDERS_I18N_KEYS.statusCancelled,
  needs_review: ORDERS_I18N_KEYS.statusNeedsReview,
};

/**
 * The i18n key for an order status. A status this build does not know gets
 * its own "unknown status" label instead of being shown as one it resembles.
 */
export function orderStatusKey(status: string): string {
  return (STATUS_KEYS as Record<string, string>)[status] ?? ORDERS_I18N_KEYS.statusUnknown;
}

/** The visual family of a status, as the skin's `StatusTag` reads it. */
export type OrderStatusFamily = "success" | "warning" | "error" | "info" | "neutral";

const STATUS_FAMILY: Readonly<Record<OrderStatus, OrderStatusFamily>> = {
  new: "info",
  confirmed: "info",
  shipped: "info",
  completed: "success",
  cancelled: "neutral",
  needs_review: "warning",
};

export function orderStatusFamily(status: string): OrderStatusFamily {
  return (STATUS_FAMILY as Record<string, OrderStatusFamily>)[status] ?? "neutral";
}
