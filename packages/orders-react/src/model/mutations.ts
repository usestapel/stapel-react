import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient, UseMutationResult } from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  AddressInput,
  Cart,
  ContactInput,
  Order,
} from "../api/types.js";
import { useOrdersApi } from "./context.js";
import { ordersQueryKeys } from "./queryKeys.js";

/**
 * Every cart write answers the whole cart, so the answer IS the new cache
 * entry; the invalidation after it is the spec's contract (`["orders",
 * "cart"]`) and keeps any other reader of the cart honest.
 */
function settleCart(queryClient: QueryClient, cart: Cart): void {
  queryClient.setQueryData(ordersQueryKeys.cart, cart);
  void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.cart });
}

/**
 * A refusal at add or checkout may carry the refreshed cart in
 * `params.cart` (`cart_price_changed`, `purchasable_unavailable`): write it
 * so the screen shows the numbers the next submit will be charged.
 */
function settleRefusal(queryClient: QueryClient, error: StapelApiError): void {
  const fresh = (error.params as { cart?: unknown } | undefined)?.cart;
  if (fresh !== undefined && fresh !== null && typeof fresh === "object") {
    queryClient.setQueryData(ordersQueryKeys.cart, fresh as Cart);
  }
  void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.cart });
}

export interface AddToCartVariables {
  readonly purchasableType: string;
  readonly purchasableKey: string;
  readonly quantity?: number;
}

/** `POST cart/lines/` — the same pair grows its line, capped by the server. */
export function useAddToCart(): UseMutationResult<
  Cart,
  StapelApiError,
  AddToCartVariables
> {
  const api = useOrdersApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars) =>
      api.addLine({
        purchasable_type: vars.purchasableType,
        purchasable_key: vars.purchasableKey,
        quantity: vars.quantity ?? 1,
      }),
    onSuccess: (cart) => settleCart(queryClient, cart),
    onError: (error) => settleRefusal(queryClient, error),
  });
}

/** `PATCH cart/lines/{id}/` — quantity `0` removes the line. */
export function useUpdateCartLine(): UseMutationResult<
  Cart,
  StapelApiError,
  { readonly lineId: number; readonly quantity: number }
> {
  const api = useOrdersApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars) => api.updateLine(vars.lineId, vars.quantity),
    onSuccess: (cart) => settleCart(queryClient, cart),
    onError: (error) => settleRefusal(queryClient, error),
  });
}

/** `DELETE cart/lines/{id}/`. */
export function useRemoveCartLine(): UseMutationResult<
  Cart,
  StapelApiError,
  number
> {
  const api = useOrdersApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lineId) => api.removeLine(lineId),
    onSuccess: (cart) => settleCart(queryClient, cart),
    onError: (error) => settleRefusal(queryClient, error),
  });
}

/** `DELETE cart/` — an empty cart comes back as a 200 with `lines: []`. */
export function useClearCart(): UseMutationResult<Cart, StapelApiError, void> {
  const api = useOrdersApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.clearCart(),
    onSuccess: (cart) => settleCart(queryClient, cart),
  });
}

export interface CheckoutVariables {
  readonly contact: ContactInput;
  readonly shippingAddress: AddressInput;
  readonly shippingMethod?: string;
  readonly comment?: string;
}

/** A v4 UUID; `crypto.randomUUID` where the platform has it. */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c !== undefined && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (c !== undefined && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type UseCheckoutResult = UseMutationResult<
  Order,
  StapelApiError,
  CheckoutVariables
> & {
  /** The key every submit of THIS checkout sends until one succeeds. */
  readonly idempotencyKey: string;
};

/**
 * `POST checkout/`. The idempotency key lives in component state from the
 * first render until a success: a double click, a retry after a network
 * fault, or a resubmit after `cart_price_changed` all send the SAME key, so
 * the server answers the same order instead of placing a second one. Only a
 * success rotates it (the next checkout is a new purchase).
 */
export function useCheckout(): UseCheckoutResult {
  const api = useOrdersApi();
  const queryClient = useQueryClient();
  const [idempotencyKey, setKey] = useState<string>(newIdempotencyKey);
  const rotate = useCallback(() => setKey(newIdempotencyKey()), []);
  const mutation = useMutation<Order, StapelApiError, CheckoutVariables>({
    mutationFn: (vars) =>
      api.checkout({
        idempotency_key: idempotencyKey,
        contact: vars.contact,
        shipping_address: vars.shippingAddress,
        ...(vars.shippingMethod !== undefined
          ? { shipping_method: vars.shippingMethod }
          : {}),
        ...(vars.comment !== undefined ? { comment: vars.comment } : {}),
      }),
    onSuccess: (order) => {
      rotate();
      queryClient.setQueryData(ordersQueryKeys.order(order.id), order);
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.cart });
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.orders });
    },
    onError: (error) => settleRefusal(queryClient, error),
  });
  return { ...mutation, idempotencyKey };
}

/** `POST orders/{id}/cancel/` — allowed while the order says `cancellable`. */
export function useCancelOrder(): UseMutationResult<
  Order,
  StapelApiError,
  number
> {
  const api = useOrdersApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId) => api.cancelOrder(orderId),
    onSuccess: (order) => {
      queryClient.setQueryData(ordersQueryKeys.order(order.id), order);
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.orders });
    },
  });
}
