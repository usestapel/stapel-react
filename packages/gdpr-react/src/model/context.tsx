import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { GdprApi } from "../api/gdprApi.js";
import type { GdprRuntime } from "./runtime.js";

/**
 * The wired GdprRuntime shared through React context by `<GdprProvider>`.
 * Hooks in `model/` and `headless/` read the singletons from here. One
 * reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<GdprRuntime> =
  createModuleContext<GdprRuntime>("Gdpr");

export const GdprRuntimeContext: Context<GdprRuntime | null> =
  kit.RuntimeContext;

export const useGdprRuntime: () => GdprRuntime = kit.useRuntime;

export const useGdprApi: () => GdprApi = kit.useApi;

export const useGdprAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<GdprProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<GdprRuntime>["Provider"] =
  kit.Provider;
