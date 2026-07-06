import { createContext, useContext } from "react";
import type { Context } from "react";
import type { Analytics } from "@stapel/core";
import type { BillingApi } from "../api/billingApi.js";
import type { BillingRuntime } from "./runtime.js";

/**
 * The wired BillingRuntime shared through React context by
 * `<BillingProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here.
 */
export const BillingRuntimeContext: Context<BillingRuntime | null> =
  createContext<BillingRuntime | null>(null);

export function useBillingRuntime(): BillingRuntime {
  const runtime = useContext(BillingRuntimeContext);
  if (runtime === null) {
    throw new Error("Billing hooks must be used within a <BillingProvider>");
  }
  return runtime;
}

export function useBillingApi(): BillingApi {
  return useBillingRuntime().api;
}

export function useBillingAnalytics(): Analytics | null {
  return useBillingRuntime().analytics;
}
