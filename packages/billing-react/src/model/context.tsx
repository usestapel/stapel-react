import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { BillingApi } from "../api/billingApi.js";
import type { BillingRuntime } from "./runtime.js";

/**
 * The wired BillingRuntime shared through React context by
 * `<BillingProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<BillingRuntime> =
  createModuleContext<BillingRuntime>("Billing");

export const BillingRuntimeContext: Context<BillingRuntime | null> =
  kit.RuntimeContext;

export const useBillingRuntime: () => BillingRuntime = kit.useRuntime;

export const useBillingApi: () => BillingApi = kit.useApi;

export const useBillingAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<BillingProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<BillingRuntime>["Provider"] =
  kit.Provider;
