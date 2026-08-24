import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createWebhooksApi } from "../api/webhooksApi.js";
import type { WebhooksApi } from "../api/webhooksApi.js";

/**
 * The wired webhooks runtime — core's `ModuleRuntime` bound to this pair's
 * API (slim wave §21/S2: the plumbing lives once in `@stapel/core`'s
 * `createModuleRuntime`/`createModuleContext`; this module only binds the
 * module-prefixed names). The returned `client` is what the host injects
 * into core's `StapelConfigProvider` (as the default or the `"webhooks"`
 * module client), preserving the client-injection fork seam
 * (frontend-standard §7.2). Auth token/refresh and the verification-403 seam
 * are supplied by the host's auth runtime on the shared client — this pair
 * does not re-implement them.
 */
export type WebhooksRuntime = ModuleRuntime<WebhooksApi>;

export type CreateWebhooksRuntimeOptions = CreateModuleRuntimeOptions;

export function createWebhooksRuntime(
  options: CreateWebhooksRuntimeOptions
): WebhooksRuntime {
  return createModuleRuntime(createWebhooksApi, options);
}
