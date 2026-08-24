import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { WebhooksApi } from "../api/webhooksApi.js";
import type { WebhooksRuntime } from "./runtime.js";

/**
 * The wired WebhooksRuntime shared through React context by
 * `<WebhooksProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<WebhooksRuntime> =
  createModuleContext<WebhooksRuntime>("Webhooks");

export const WebhooksRuntimeContext: Context<WebhooksRuntime | null> =
  kit.RuntimeContext;

export const useWebhooksRuntime: () => WebhooksRuntime = kit.useRuntime;

export const useWebhooksApi: () => WebhooksApi = kit.useApi;

export const useWebhooksAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<WebhooksProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<WebhooksRuntime>["Provider"] =
  kit.Provider;
