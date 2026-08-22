import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { CdnApi } from "../api/cdnApi.js";
import type { CdnRuntime } from "./runtime.js";

/**
 * The wired {@link CdnRuntime} shared through React context by
 * `<CdnProvider>`. Hooks in `model/` and `headless/` read the singletons from
 * here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`); this module binds it under the pair's public names.
 */
const kit: ModuleContextKit<CdnRuntime> = createModuleContext<CdnRuntime>("Cdn");

export const CdnRuntimeContext: Context<CdnRuntime | null> = kit.RuntimeContext;

export const useCdnRuntime: () => CdnRuntime = kit.useRuntime;

export const useCdnApi: () => CdnApi = kit.useApi;

export const useCdnAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<CdnProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<CdnRuntime>["Provider"] =
  kit.Provider;
