import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type {
  Cart,
  CartLineAddBody,
  CheckoutBody,
  Order,
  OrderListParams,
  OrderPage,
  OrderTransitionRequest,
} from "./types.js";

/**
 * Cookie-authenticated browser clients send `X-Requested-With` on every
 * mutation (the CSRF rule auth-react and reviews-react follow). Header-token
 * clients ignore it.
 */
const CSRF_HEADERS: Record<string, string> = {
  "X-Requested-With": "XMLHttpRequest",
};

type Signal = { readonly signal?: AbortSignal };

function reading(
  options?: Signal
): Omit<StapelRequestOptions, "method" | "body"> {
  return options?.signal !== undefined ? { signal: options.signal } : {};
}

function mutating(): Omit<StapelRequestOptions, "method" | "body"> {
  return { headers: { ...CSRF_HEADERS } };
}

/**
 * The pair's typed operation surface — one method per stapel-orders endpoint,
 * bound to the injected {@link StapelClient}. Paths are relative to the
 * runtime's `baseUrl` (`/orders/api/v1/`).
 *
 * Every cart write answers the WHOLE cart (`CartResponse`), so the model
 * layer writes that answer into the cache instead of refetching. An empty
 * cart is a 200 with `lines: []`, never a 404.
 */
export interface OrdersApi {
  readonly client: StapelClient;
  /** `GET cart/` — the caller's cart; reading it never asks the product owner. */
  cart(options?: Signal): Promise<Cart>;
  /** `POST cart/lines/` — the same pair grows its line (capped server-side). */
  addLine(body: CartLineAddBody): Promise<Cart>;
  /** `PATCH cart/lines/{id}/` — `0` removes the line. */
  updateLine(lineId: number, quantity: number): Promise<Cart>;
  /** `DELETE cart/lines/{id}/`. */
  removeLine(lineId: number): Promise<Cart>;
  /** `DELETE cart/`. */
  clearCart(): Promise<Cart>;
  /** `POST checkout/` — 201 a new order, 200 the same order on a replayed key. */
  checkout(body: CheckoutBody): Promise<Order>;
  /** `GET orders/` — the caller's orders, newest first, anchor-paginated. */
  orders(params?: OrderListParams, options?: Signal): Promise<OrderPage>;
  /** `GET orders/{id}/` — a foreign id 404s exactly like an absent one. */
  order(orderId: number, options?: Signal): Promise<Order>;
  /** `POST orders/{id}/cancel/` — owner cancel while the order allows it. */
  cancelOrder(orderId: number): Promise<Order>;
  /** `POST orders/{id}/transition/` — staff only. */
  transitionOrder(orderId: number, body: OrderTransitionRequest): Promise<Order>;
}

export function createOrdersApi(client: StapelClient): OrdersApi {
  return {
    client,
    cart: (options) => client.get<Cart>("cart/", reading(options)),
    addLine: (body) => client.post<Cart>("cart/lines/", body, mutating()),
    updateLine: (lineId, quantity) =>
      client.patch<Cart>(`cart/lines/${lineId}/`, { quantity }, mutating()),
    removeLine: (lineId) =>
      client.delete<Cart>(`cart/lines/${lineId}/`, mutating()),
    clearCart: () => client.delete<Cart>("cart/", mutating()),
    checkout: (body) => client.post<Order>("checkout/", body, mutating()),
    orders: (params = {}, options) =>
      client.get<OrderPage>("orders/", {
        ...reading(options),
        query: {
          ...(params.status !== undefined && params.status.length > 0
            ? { status: [...params.status] }
            : {}),
          ...(params.anchor !== undefined
            ? { anchor: params.anchor, direction: "next" }
            : {}),
          ...(params.limit !== undefined ? { limit: params.limit } : {}),
        },
      }),
    order: (orderId, options) =>
      client.get<Order>(`orders/${orderId}/`, reading(options)),
    cancelOrder: (orderId) =>
      client.post<Order>(`orders/${orderId}/cancel/`, undefined, mutating()),
    transitionOrder: (orderId, body) =>
      client.post<Order>(`orders/${orderId}/transition/`, body, mutating()),
  };
}
