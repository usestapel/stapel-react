import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { TranslateApi } from "../api/translateApi.js";
import type { TranslateRuntime } from "./runtime.js";

/**
 * The wired TranslateRuntime shared through React context by
 * `<TranslateProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<TranslateRuntime> =
  createModuleContext<TranslateRuntime>("Translate");

export const TranslateRuntimeContext: Context<TranslateRuntime | null> =
  kit.RuntimeContext;

export const useTranslateRuntime: () => TranslateRuntime = kit.useRuntime;

export const useTranslateApi: () => TranslateApi = kit.useApi;

export const useTranslateAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<TranslateProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<TranslateRuntime>["Provider"] =
  kit.Provider;
