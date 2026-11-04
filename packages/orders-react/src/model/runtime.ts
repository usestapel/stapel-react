import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createOrdersApi } from "../api/ordersApi.js";
import type { OrdersApi } from "../api/ordersApi.js";

/**
 * The wired orders runtime — core's `ModuleRuntime` bound to this pair's
 * API (slim wave §21/S2: the plumbing lives once in `@stapel/core`'s
 * `createModuleRuntime`/`createModuleContext`; this module only binds the
 * module-prefixed names). The returned `client` is what the host injects
 * into core's `StapelConfigProvider` (as the default or the `"orders"`
 * module client), preserving the client-injection fork seam
 * (frontend-standard §7.2). Auth token/refresh and the verification-403 seam
 * are supplied by the host's auth runtime on the shared client — this pair
 * does not re-implement them.
 */
export type OrdersRuntime = ModuleRuntime<OrdersApi>;

export type CreateOrdersRuntimeOptions = CreateModuleRuntimeOptions;

export function createOrdersRuntime(
  options: CreateOrdersRuntimeOptions
): OrdersRuntime {
  return createModuleRuntime(createOrdersApi, options);
}
