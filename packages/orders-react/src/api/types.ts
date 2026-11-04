/**
 * Wire types for the stapel-orders HTTP contract — derived from the generated
 * OpenAPI surface (`./generated/schema.js`, produced by `pnpm gen:api` from
 * stapel-orders' own `docs/schema.json`), never hand-maintained.
 *
 * Money is a decimal STRING on the wire (`"12.50"`) and stays one here: the
 * pair never does arithmetic on prices, it renders what the server summed.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

export type Cart = Schemas["CartResponse"];
export type CartLine = Schemas["CartLine"];
export type CartLineAddRequest = Schemas["CartLineAddRequest"];
/** drf-spectacular prefixes every PATCH body `Patched`; the name is pinned
 * by the backend's own contract test. */
export type CartLineUpdateRequest = Schemas["PatchedCartLineUpdateRequest"];
export type CheckoutRequest = Schemas["CheckoutRequest"];
export type ContactSnapshot = Schemas["ContactSnapshot"];
export type AddressSnapshot = Schemas["AddressSnapshot"];
export type Order = Schemas["OrderResponse"];
export type OrderLine = Schemas["OrderLine"];
export type OrderPage = Schemas["OrderPage"];
export type OrderStatus = Schemas["OrderStatusEnum"];
export type PaymentStatus = Schemas["PaymentStatusEnum"];
export type OrderTransitionRequest = Schemas["OrderTransitionRequest"];

/** What `GET orders/` takes. `anchor` is the previous page's `next_anchor`
 * (an order id); `status` repeats. */
export interface OrderListParams {
  readonly status?: readonly OrderStatus[];
  readonly anchor?: number;
  readonly limit?: number;
}

// ── Request-side corrections ────────────────────────────────────────────────
// openapi-typescript marks a property with a `default` as required, which is
// right for a response (the server always fills it) and wrong for a request
// body (the server fills it BECAUSE the client may omit it). The bodies the
// pair sends therefore make exactly the defaulted properties optional.

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** `ContactSnapshot` as sent: `email` may be omitted. */
export type ContactInput = Optional<ContactSnapshot, "email">;
/** `AddressSnapshot` as sent: `line2`, `region`, `postal_code` may be omitted. */
export type AddressInput = Optional<AddressSnapshot, "line2" | "region" | "postal_code">;
/** `CartLineAddRequest` as sent: `quantity` defaults to 1. */
export type CartLineAddBody = Optional<CartLineAddRequest, "quantity">;
/** `CheckoutRequest` as sent. */
export type CheckoutBody = Omit<
  CheckoutRequest,
  "contact" | "shipping_address" | "shipping_method" | "comment"
> & {
  readonly contact: ContactInput;
  readonly shipping_address: AddressInput;
  readonly shipping_method?: string;
  readonly comment?: string;
};
