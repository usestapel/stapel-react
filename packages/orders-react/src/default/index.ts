/**
 * `@stapel/orders-react/default` — the pair's antd skin. A separate entry
 * point, so a host that brings its own visuals never pulls `antd` into its
 * bundle; importing this subpath is the opt-in.
 *
 * ```tsx
 * import { CartPage, CheckoutPage } from "@stapel/orders-react/default";
 * // under the pair's <OrdersProvider> + core's <I18nProvider>
 * ```
 */
export { AddToCartButton } from "./AddToCartButton.js";
export type { AddToCartButtonSkinProps } from "./AddToCartButton.js";
export { CartBadge } from "./CartBadge.js";
export type { CartBadgeProps } from "./CartBadge.js";
export { CartPage } from "./CartPage.js";
export type { CartPageProps } from "./CartPage.js";
export { CheckoutPage } from "./CheckoutPage.js";
export type { CheckoutPageProps } from "./CheckoutPage.js";
export { OrderHistoryPane } from "./OrderHistoryPane.js";
export type { OrderHistoryPaneProps } from "./OrderHistoryPane.js";
export { OrderDetailPane } from "./OrderDetailPane.js";
export type { OrderDetailPaneProps } from "./OrderDetailPane.js";
export type { NavigateProp, ThemeModeProp } from "./types.js";
