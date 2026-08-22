import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { SearchApi } from "../api/searchApi.js";
import type { SearchRuntime } from "./runtime.js";

/**
 * The wired SearchRuntime shared through React context by
 * `<SearchProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<SearchRuntime> =
  createModuleContext<SearchRuntime>("Search");

export const SearchRuntimeContext: Context<SearchRuntime | null> =
  kit.RuntimeContext;

export const useSearchRuntime: () => SearchRuntime = kit.useRuntime;

export const useSearchApi: () => SearchApi = kit.useApi;

export const useSearchAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<SearchProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<SearchRuntime>["Provider"] =
  kit.Provider;
