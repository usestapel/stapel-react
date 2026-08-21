import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createFormsApi } from "../api/formsApi.js";
import type { FormsApi } from "../api/formsApi.js";

/**
 * The wired forms runtime — core's `ModuleRuntime` bound to this pair's API
 * (slim wave §21/S2: the plumbing lives once in `@stapel/core`'s
 * `createModuleRuntime`/`createModuleContext`; this module only binds the
 * module-prefixed names). The returned `client` is what the host injects into
 * core's `StapelConfigProvider` (as the default or the `"forms"` module
 * client), preserving the client-injection fork seam (frontend-standard §7.2).
 *
 * ANONYMOUS EMBED. The two public routes need no session, so a render-only
 * host page can build this runtime and nothing else:
 *
 * ```tsx
 * const runtime = createFormsRuntime({ baseUrl: "/forms/api/v1/" });
 * <FormsProvider runtime={runtime}><StapelForm publicId="k3J…x9" /></FormsProvider>
 * ```
 *
 * Auth token/refresh and the verification-403 seam are supplied by the host's
 * auth runtime on the shared client when the ADMIN surface is in use — this
 * pair does not re-implement them. The runtime's fetch/credentials/
 * defaultHeaders are ALSO forwarded to the pair's raw CSV surface
 * (`api/export.ts`), which cannot ride the JSON client.
 */
export type FormsRuntime = ModuleRuntime<FormsApi>;

export type CreateFormsRuntimeOptions = CreateModuleRuntimeOptions;

export function createFormsRuntime(
  options: CreateFormsRuntimeOptions
): FormsRuntime {
  return createModuleRuntime(
    (client) =>
      createFormsApi(client, {
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
