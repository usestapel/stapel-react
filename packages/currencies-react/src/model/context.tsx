import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { CurrenciesApi } from "../api/currenciesApi.js";
import type { CurrenciesRuntime } from "./runtime.js";

/**
 * The wired CurrenciesRuntime shared through React context by
 * `<CurrenciesProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<CurrenciesRuntime> =
  createModuleContext<CurrenciesRuntime>("Currencies");

export const CurrenciesRuntimeContext: Context<CurrenciesRuntime | null> =
  kit.RuntimeContext;

export const useCurrenciesRuntime: () => CurrenciesRuntime = kit.useRuntime;

export const useCurrenciesApi: () => CurrenciesApi = kit.useApi;

export const useCurrenciesAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<CurrenciesProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<CurrenciesRuntime>["Provider"] =
  kit.Provider;
