import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { AlertsApi } from "../api/alertsApi.js";
import type { AlertsRuntime } from "./runtime.js";

/**
 * The wired AlertsRuntime shared through React context by `<AlertsProvider>`.
 * Hooks in `model/` and the screens in `default/` read the singletons from
 * here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<AlertsRuntime> =
  createModuleContext<AlertsRuntime>("Alerts");

export const AlertsRuntimeContext: Context<AlertsRuntime | null> =
  kit.RuntimeContext;

export const useAlertsRuntime: () => AlertsRuntime = kit.useRuntime;

export const useAlertsApi: () => AlertsApi = kit.useApi;

export const useAlertsAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<AlertsProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<AlertsRuntime>["Provider"] =
  kit.Provider;
