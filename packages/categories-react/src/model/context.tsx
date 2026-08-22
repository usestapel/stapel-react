import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { CategoriesApi } from "../api/categoriesApi.js";
import type { CategoriesRuntime } from "./runtime.js";

/**
 * The wired CategoriesRuntime shared through React context by
 * `<CategoriesProvider>`. Hooks in `model/` and `headless/` read the
 * singletons from here. One reviewed copy of this plumbing lives in
 * `@stapel/core` (`createModuleContext`, slim wave §21/S2); this module binds
 * it under the pair's public names.
 */
const kit: ModuleContextKit<CategoriesRuntime> =
  createModuleContext<CategoriesRuntime>("Categories");

export const CategoriesRuntimeContext: Context<CategoriesRuntime | null> =
  kit.RuntimeContext;

export const useCategoriesRuntime: () => CategoriesRuntime = kit.useRuntime;

export const useCategoriesApi: () => CategoriesApi = kit.useApi;

export const useCategoriesAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<CategoriesProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<CategoriesRuntime>["Provider"] =
  kit.Provider;
