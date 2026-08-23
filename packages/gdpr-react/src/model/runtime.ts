import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createGdprApi } from "../api/gdprApi.js";
import type { GdprApi } from "../api/gdprApi.js";

/**
 * The wired gdpr runtime — core's `ModuleRuntime` bound to this pair's API
 * (slim wave §21/S2: the plumbing lives once in `@stapel/core`'s
 * `createModuleRuntime`/`createModuleContext`; this module only binds the
 * module-prefixed names). The returned `client` is what the host injects into
 * core's `StapelConfigProvider` (as the default or the `"gdpr"` module
 * client), preserving the client-injection fork seam (frontend-standard §7.2).
 * Auth token/refresh and the verification-403 seam are supplied by the host's
 * auth runtime on the shared client — this pair does not re-implement them.
 *
 * `fetch` / `credentials` / `defaultHeaders` are ALSO forwarded to the pair's
 * raw-bytes surface (`api/download.ts`), which cannot ride the JSON client:
 * the export archive is a ZIP, and core's client parses every success as text
 * (the `@stapel/docs-react` precedent, same forwarding, same reason).
 *
 * EVERY read here is the caller's own or staff-only, and every write is
 * destructive or statutory. Nothing in this runtime is scoped to a workspace,
 * a tenant or an object — there is no `scopeKey`-shaped option to pass, and a
 * host that wants one is asking for `useRequestErasure`, which takes the
 * subject per call.
 */
export type GdprRuntime = ModuleRuntime<GdprApi>;

export type CreateGdprRuntimeOptions = CreateModuleRuntimeOptions;

export function createGdprRuntime(
  options: CreateGdprRuntimeOptions
): GdprRuntime {
  return createModuleRuntime(
    (client) =>
      createGdprApi(client, {
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
