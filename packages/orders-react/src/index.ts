/**
 * `@stapel/orders-react` — the headless React flow pair for stapel-orders
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * Cart, checkout and order history over stapel-orders' opaque purchasables:
 * a page names `(purchasableType, purchasableKey)` and the pair owns the
 * request. Layers: api → model → flows → headless → i18n. Generated surfaces (flows registry, error map, manifest, llms.txt)
 * are produced by the monorepo `gen:*` drivers and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createOrdersApi } from "./api/ordersApi.js";
export type { OrdersApi } from "./api/ordersApi.js";
export type {
  Schemas,
  Cart,
  CartLine,
  CartLineAddRequest,
  CartLineUpdateRequest,
  CheckoutRequest,
  ContactSnapshot,
  AddressSnapshot,
  Order,
  OrderLine,
  OrderPage,
  OrderStatus,
  PaymentStatus,
  OrderTransitionRequest,
  OrderListParams,
  ContactInput,
  AddressInput,
  CartLineAddBody,
  CheckoutBody,
} from "./api/types.js";

// ── flows ────────────────────────────────────────────────────────────────────
// The flow-machine primitive lives in `@stapel/core` (one reviewed copy for
// every pair — frontend-core-architecture §4b). Re-exported for ergonomics.
export { createFlowMachine, useFlow, isErrorCode } from "@stapel/core";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
  FlowError,
} from "@stapel/core";
export { toFlowError } from "./flows/errors.js";
export { ORDERS_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  OrdersFlowId,
  OrdersFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createOrdersRuntime } from "./model/runtime.js";
export type {
  OrdersRuntime,
  CreateOrdersRuntimeOptions,
} from "./model/runtime.js";
export {
  OrdersRuntimeContext,
  useOrdersRuntime,
  useOrdersApi,
  useOrdersAnalytics,
} from "./model/context.js";
export { ordersQueryKeys } from "./model/queryKeys.js";
export {
  useCart,
  useHasCartSession,
  useOrders,
  useOrder,
  ordersFromPages,
  ORDERS_PAGE,
} from "./model/queries.js";
export type { UseOrdersOptions, OrdersQueryResult } from "./model/queries.js";
export {
  useAddToCart,
  useUpdateCartLine,
  useRemoveCartLine,
  useClearCart,
  useCheckout,
  useCancelOrder,
  newIdempotencyKey,
} from "./model/mutations.js";
export type {
  AddToCartVariables,
  CheckoutVariables,
  UseCheckoutResult,
} from "./model/mutations.js";
export { orderStatusKey, orderStatusFamily } from "./model/status.js";
export { ORDERS_ELEVATION_ACTIONS } from "./model/elevation.js";
export type { OrderStatusFamily } from "./model/status.js";

// ── testids (fixed by the pair, never a prop) ────────────────────────────────
export { ORDERS_TESTIDS, ADD_TO_CART_TESTID } from "./testids.js";
export type { OrdersTestId } from "./testids.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { OrdersProvider } from "./headless/OrdersProvider.js";
export {
  AddToCartButton,
  useAddToCartButton,
} from "./headless/AddToCartButton.js";
export type {
  AddToCartProps,
  AddToCartBag,
  AddToCartButtonProps,
} from "./headless/AddToCartButton.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  ORDERS_I18N_KEYS,
  ordersI18nBundleEn,
  registerOrdersI18n,
} from "./i18n/keys.js";
export type { OrdersI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  ORDERS_ERRORS,
  ORDERS_ERROR_CODES,
  ordersErrorBundleEn,
  explainOrdersError,
} from "./i18n/errorsMap.js";
export type {
  OrdersErrorCode,
  OrdersErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
