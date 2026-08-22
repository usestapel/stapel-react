import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { ListingsApi } from "../api/listingsApi.js";
import type { ListingsRuntime } from "./runtime.js";

/**
 * The wired ListingsRuntime shared through React context by
 * `<ListingsProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<ListingsRuntime> =
  createModuleContext<ListingsRuntime>("Listings");

export const ListingsRuntimeContext: Context<ListingsRuntime | null> =
  kit.RuntimeContext;

export const useListingsRuntime: () => ListingsRuntime = kit.useRuntime;

export const useListingsApi: () => ListingsApi = kit.useApi;

export const useListingsAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<ListingsProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<ListingsRuntime>["Provider"] =
  kit.Provider;
