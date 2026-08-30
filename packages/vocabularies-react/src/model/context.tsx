import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { VocabulariesApi } from "../api/vocabulariesApi.js";
import type { VocabulariesRuntime } from "./runtime.js";

/**
 * The wired VocabulariesRuntime shared through React context by
 * `<VocabulariesProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<VocabulariesRuntime> =
  createModuleContext<VocabulariesRuntime>("Vocabularies");

export const VocabulariesRuntimeContext: Context<VocabulariesRuntime | null> =
  kit.RuntimeContext;

export const useVocabulariesRuntime: () => VocabulariesRuntime = kit.useRuntime;

export const useVocabulariesApi: () => VocabulariesApi = kit.useApi;

export const useVocabulariesAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<VocabulariesProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<VocabulariesRuntime>["Provider"] =
  kit.Provider;
