import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { FormsApi } from "../api/formsApi.js";
import type { FormsRuntime } from "./runtime.js";

/**
 * The wired FormsRuntime shared through React context by
 * `<FormsProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<FormsRuntime> =
  createModuleContext<FormsRuntime>("Forms");

export const FormsRuntimeContext: Context<FormsRuntime | null> =
  kit.RuntimeContext;

export const useFormsRuntime: () => FormsRuntime = kit.useRuntime;

export const useFormsApi: () => FormsApi = kit.useApi;

export const useFormsAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<FormsProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<FormsRuntime>["Provider"] =
  kit.Provider;
