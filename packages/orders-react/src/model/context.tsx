import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { OrdersApi } from "../api/ordersApi.js";
import type { OrdersRuntime } from "./runtime.js";

/**
 * The wired OrdersRuntime shared through React context by
 * `<OrdersProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<OrdersRuntime> =
  createModuleContext<OrdersRuntime>("Orders");

export const OrdersRuntimeContext: Context<OrdersRuntime | null> =
  kit.RuntimeContext;

export const useOrdersRuntime: () => OrdersRuntime = kit.useRuntime;

export const useOrdersApi: () => OrdersApi = kit.useApi;

export const useOrdersAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<OrdersProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<OrdersRuntime>["Provider"] =
  kit.Provider;
