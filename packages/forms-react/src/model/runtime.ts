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
 *
 * ── The workspace scope, and why it lives here ─────────────────────────────
 *
 * Every admin route is workspace-scoped, so every admin screen needs a
 * workspace id — and a ROUTE cannot carry one: a container mounts
 * `<FormsListPane/>` from a nav manifest with nothing but the URL in hand,
 * and the workspace a person is acting in is a property of the SESSION, not
 * of the address. Declaring it once on the runtime is what lets the three
 * admin screens be routable at all; passing `workspaceId` to a screen still
 * wins, so a host driving two workspaces on one page keeps working.
 */
export type FormsRuntime = ModuleRuntime<FormsApi> & {
  /** The workspace the admin screens act in when a screen is not given one. */
  readonly workspaceId?: string;
};

export type CreateFormsRuntimeOptions = CreateModuleRuntimeOptions & {
  /** Default workspace for the admin surface. Omit for the anonymous embed —
   * `<StapelForm>` and `<FormFill>` never read it. */
  readonly workspaceId?: string;
};

export function createFormsRuntime(
  options: CreateFormsRuntimeOptions
): FormsRuntime {
  const base = createModuleRuntime(
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
  return {
    ...base,
    ...(options.workspaceId !== undefined
      ? { workspaceId: options.workspaceId }
      : {}),
  };
}
