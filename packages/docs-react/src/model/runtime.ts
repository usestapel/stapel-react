import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createDocsApi } from "../api/docsApi.js";
import type { DocsApi } from "../api/docsApi.js";

/**
 * The wired docs runtime — core's `ModuleRuntime` bound to this pair's API
 * (slim wave §21/S2: the plumbing lives once in `@stapel/core`'s
 * `createModuleRuntime`/`createModuleContext`; this module only binds the
 * module-prefixed names). The returned `client` is what the host injects into
 * core's `StapelConfigProvider` (as the default or the `"docs"` module
 * client), preserving the client-injection fork seam (frontend-standard
 * §7.2). Auth token/refresh and the verification-403 seam are supplied by the
 * host's auth runtime on the shared client — this pair does not re-implement
 * them. The runtime's fetch/credentials/defaultHeaders are ALSO forwarded to
 * the pair's raw-bytes surface (`api/content.ts`), which cannot ride the JSON
 * client.
 */
export type DocsRuntime = ModuleRuntime<DocsApi>;

export type CreateDocsRuntimeOptions = CreateModuleRuntimeOptions;

export function createDocsRuntime(options: CreateDocsRuntimeOptions): DocsRuntime {
  return createModuleRuntime(
    (client) =>
      createDocsApi(client, {
        ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
        ...(options.credentials !== undefined
          ? { credentials: options.credentials }
          : {}),
        ...(options.defaultHeaders !== undefined
          ? { defaultHeaders: options.defaultHeaders }
          : {}),
      }),
    options
  );
}
