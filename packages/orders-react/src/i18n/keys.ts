import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { ordersErrorBundleEn } from "./generated/errors.gen.js";

/**
 * orders-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys. Point core's `loadLocale` at stapel-translate to override
 * per locale. Add UI keys under the `orders.` namespace as you build flows.
 */
export const ORDERS_I18N_KEYS = {
  unknownError: "orders.error.unknown",
  navCart: "orders.nav.cart",
  navCheckout: "orders.nav.checkout",
  navMine: "orders.nav.mine",
  navDetail: "orders.nav.detail",
  addLabel: "orders.add.label",
  addAdding: "orders.add.adding",
  addInCart: "orders.add.in_cart",
  addGoToCart: "orders.add.go_to_cart",
  badgeLabel: "orders.badge.label",
  cartTitle: "orders.cart.title",
  cartEmpty: "orders.cart.empty",
  cartTotal: "orders.cart.total",
  cartQuantity: "orders.cart.quantity",
  cartRemove: "orders.cart.remove",
  cartCheckout: "orders.cart.checkout",
  checkoutTitle: "orders.checkout.title",
  checkoutContact: "orders.checkout.contact",
  checkoutAddress: "orders.checkout.address_section",
  fieldName: "orders.checkout.field.name",
  fieldPhone: "orders.checkout.field.phone",
  fieldEmail: "orders.checkout.field.email",
  fieldLine1: "orders.checkout.field.line1",
  fieldCity: "orders.checkout.field.city",
  fieldCountry: "orders.checkout.field.country",
  fieldComment: "orders.checkout.field.comment",
  fieldRequired: "orders.checkout.field.required",
  fieldCountryFormat: "orders.checkout.field.country_format",
  checkoutSubmit: "orders.checkout.submit",
  checkoutPriceChanged: "orders.checkout.price_changed",
  historyTitle: "orders.history.title",
  historyEmpty: "orders.history.empty",
  historyLoadMore: "orders.history.load_more",
  orderTitle: "orders.order.title",
  orderCancel: "orders.order.cancel",
  orderTotal: "orders.order.total",
  orderPlaced: "orders.order.placed",
  orderDelivery: "orders.order.delivery",
  statusNew: "orders.status.new",
  statusConfirmed: "orders.status.confirmed",
  statusShipped: "orders.status.shipped",
  statusCompleted: "orders.status.completed",
  statusCancelled: "orders.status.cancelled",
  statusNeedsReview: "orders.status.needs_review",
  statusUnknown: "orders.status.unknown",
} as const;

export type OrdersI18nKey =
  (typeof ORDERS_I18N_KEYS)[keyof typeof ORDERS_I18N_KEYS];

/**
 * English fallback bundle for orders-react UI keys + backend error codes.
 * The generated `ordersErrorBundleEn` (from stapel-orders's error registry,
 * `pnpm gen:errors`) is spread FIRST so every backend `error.*` key has a
 * fallback — a `StapelApiError.code` never renders as a raw key. Hand-polished
 * copy below then OVERRIDES the generated English for the keys users see most.
 */
export const ordersI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...ordersErrorBundleEn,

  // orders-react UI and the default skin (see i18n/ru.ts, i18n/es.ts)
  "orders.error.unknown": "Something went wrong. Please try again.",
  "orders.nav.cart": "Cart",
  "orders.nav.checkout": "Checkout",
  "orders.nav.mine": "My orders",
  "orders.nav.detail": "Order",
  "orders.add.label": "Add to cart",
  "orders.add.adding": "Adding…",
  "orders.add.in_cart": "In cart: {count}",
  "orders.add.go_to_cart": "Go to cart",
  "orders.badge.label": "Cart, {count} items",
  "orders.cart.title": "Cart",
  "orders.cart.empty": "Your cart is empty.",
  "orders.cart.total": "Total",
  "orders.cart.quantity": "Quantity",
  "orders.cart.remove": "Remove",
  "orders.cart.checkout": "Checkout",
  "orders.checkout.title": "Checkout",
  "orders.checkout.contact": "Contact",
  "orders.checkout.address_section": "Delivery address",
  "orders.checkout.field.name": "Name",
  "orders.checkout.field.phone": "Phone",
  "orders.checkout.field.email": "Email (optional)",
  "orders.checkout.field.line1": "Address",
  "orders.checkout.field.city": "City",
  "orders.checkout.field.country": "Country code",
  "orders.checkout.field.comment": "Comment (optional)",
  "orders.checkout.field.required": "Required",
  "orders.checkout.field.country_format": "Two letters, e.g. US",
  "orders.checkout.submit": "Place order",
  "orders.checkout.price_changed": "Prices changed since you added these items. Check the new total and place the order again.",
  "orders.history.title": "My orders",
  "orders.history.empty": "You have no orders yet.",
  "orders.history.load_more": "Load more",
  "orders.order.title": "Order {number}",
  "orders.order.cancel": "Cancel order",
  "orders.order.total": "Total",
  "orders.order.placed": "Placed",
  "orders.order.delivery": "Delivery",
  "orders.status.new": "New",
  "orders.status.confirmed": "Confirmed",
  "orders.status.shipped": "Shipped",
  "orders.status.completed": "Completed",
  "orders.status.cancelled": "Cancelled",
  "orders.status.needs_review": "Under review",
  "orders.status.unknown": "Unknown status",
};

/**
 * Register orders-react's key bundle into a core i18n engine (call once at
 * startup). A later `loadLocale` from stapel-translate can layer localized
 * overrides on top.
 */
export function registerOrdersI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, ordersI18nBundleEn);
}
