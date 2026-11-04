/**
 * Namespaced TanStack Query keys — everything under the `"orders"` root so a
 * host can invalidate the whole module or one resource. Explicit tuple return
 * types satisfy `--isolatedDeclarations`.
 */
import type { OrderStatus } from "../api/types.js";

const ROOT = "orders" as const;

export const ordersQueryKeys: {
  readonly all: readonly ["orders"];
  readonly cart: readonly ["orders", "cart"];
  readonly orders: readonly ["orders", "list"];
  readonly list: (
    status: readonly OrderStatus[]
  ) => readonly ["orders", "list", readonly OrderStatus[]];
  readonly order: (orderId: number) => readonly ["orders", "order", number];
} = {
  all: [ROOT],
  cart: [ROOT, "cart"],
  orders: [ROOT, "list"],
  list: (status) => [ROOT, "list", [...status].sort()],
  order: (orderId) => [ROOT, "order", orderId],
};
