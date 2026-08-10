import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { DocsApi } from "../api/docsApi.js";
import type { DocsRuntime } from "./runtime.js";

/**
 * The wired DocsRuntime shared through React context by `<DocsProvider>`.
 * Hooks in `model/` and `headless/` read the singletons from here. One
 * reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<DocsRuntime> = createModuleContext<DocsRuntime>("Docs");

export const DocsRuntimeContext: Context<DocsRuntime | null> = kit.RuntimeContext;

export const useDocsRuntime: () => DocsRuntime = kit.useRuntime;

export const useDocsApi: () => DocsApi = kit.useApi;

export const useDocsAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<DocsProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<DocsRuntime>["Provider"] =
  kit.Provider;
