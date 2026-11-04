import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type { Cart, Order, OrderPage, OrderStatus } from "../api/types.js";
import { useOrdersApi } from "./context.js";
import { ordersQueryKeys } from "./queryKeys.js";

/** One screenful of order history. */
export const ORDERS_PAGE = 20;

/**
 * The caller's cart. Waits for the session to settle: a guest session IS an
 * identity here (the cart is keyed on it), so a read racing the bootstrap
 * would cache somebody else's — or nobody's — cart.
 */
export function useCart(
  options: { readonly enabled?: boolean } = {}
): UseQueryResult<Cart, StapelApiError> {
  const api = useOrdersApi();
  const ready = useActiveSessionReady();
  return useQuery({
    queryKey: ordersQueryKeys.cart,
    queryFn: ({ signal }) => api.cart({ signal }),
    enabled: ready && options.enabled !== false,
  });
}

export interface UseOrdersOptions {
  readonly status?: readonly OrderStatus[];
  readonly limit?: number;
  readonly enabled?: boolean;
}

export type OrdersQueryResult = UseInfiniteQueryResult<
  InfiniteData<OrderPage, number | undefined>,
  StapelApiError
>;

/**
 * The caller's orders, newest first, as a load-more window over core's
 * `AnchorPagination` envelope. `has_next` is the authority; `next_anchor` is
 * read only when it says yes (the last page leaves it `null`).
 */
export function useOrders(options: UseOrdersOptions = {}): OrdersQueryResult {
  const api = useOrdersApi();
  const ready = useActiveSessionReady();
  const status = options.status ?? [];
  const limit = options.limit ?? ORDERS_PAGE;
  return useInfiniteQuery({
    queryKey: ordersQueryKeys.list(status),
    queryFn: ({ pageParam, signal }) =>
      api.orders(
        {
          status,
          limit,
          ...(pageParam !== undefined ? { anchor: pageParam } : {}),
        },
        { signal }
      ),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last: OrderPage) =>
      last.has_next && last.next_anchor !== null && last.next_anchor !== undefined
        ? Number(last.next_anchor)
        : undefined,
    enabled: ready && options.enabled !== false,
  });
}

/**
 * Flatten the loaded pages. `undefined` means "not loaded", never `[]` — an
 * empty array is a claim that the person has no orders.
 */
export function ordersFromPages(
  data: InfiniteData<OrderPage, number | undefined> | undefined
): readonly Order[] | undefined {
  if (data === undefined) return undefined;
  return data.pages.flatMap((page) => page.items);
}

/** One order. A foreign id answers 404 exactly like an absent one. */
export function useOrder(
  orderId: number | undefined
): UseQueryResult<Order, StapelApiError> {
  const api = useOrdersApi();
  const ready = useActiveSessionReady();
  const valid = orderId !== undefined && Number.isInteger(orderId) && orderId > 0;
  return useQuery({
    queryKey: ordersQueryKeys.order(valid ? orderId : 0),
    queryFn: ({ signal }) => api.order(orderId as number, { signal }),
    enabled: ready && valid,
  });
}
