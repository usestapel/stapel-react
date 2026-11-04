/**
 * The pair's fixed test ids. A page names the pair; it never chooses these.
 *
 * They are constants and not props on purpose: a generated project's flows
 * and a recipe's UI criteria address `add-to-cart`, `cart-line` and
 * `checkout-submit` by these exact strings, so a host that could rename one
 * would silently detach every check written against the pair.
 */
export const ORDERS_TESTIDS = {
  /** The add-to-cart control; rendered by every `AddToCartButton`. */
  addToCart: "add-to-cart",
  /** "Go to cart", offered after a successful add. */
  goToCart: "go-to-cart",
  /** The cart badge in the top bar. */
  cartBadge: "cart-badge",
  /** `CartPage` root. */
  pageCart: "page-cart",
  /** One per cart line. */
  cartLine: "cart-line",
  /** The cart total. */
  cartTotal: "cart-total",
  /** The empty-cart state. */
  cartEmpty: "cart-empty",
  /** The link from the cart to checkout. */
  checkoutLink: "checkout-link",
  /** `CheckoutPage` root. */
  pageCheckout: "page-checkout",
  /** Places the order. */
  checkoutSubmit: "checkout-submit",
  /** `OrderHistoryPane` root. */
  pageOrders: "page-orders",
  /** One per order in the history. */
  orderRow: "order-row",
  /** Loads the next page of the history. */
  ordersLoadMore: "orders-load-more",
  /** `OrderDetailPane` root. */
  pageOrder: "page-order",
  /** Cancels the order (only while it is cancellable). */
  orderCancel: "order-cancel",
} as const;

export type OrdersTestId = (typeof ORDERS_TESTIDS)[keyof typeof ORDERS_TESTIDS];

/** The add-to-cart test id on its own — the one most callers need. */
export const ADD_TO_CART_TESTID: "add-to-cart" = ORDERS_TESTIDS.addToCart;
