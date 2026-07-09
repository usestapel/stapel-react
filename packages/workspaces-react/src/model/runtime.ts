import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createWorkspacesApi } from "../api/workspacesApi.js";
import type { WorkspacesApi } from "../api/workspacesApi.js";

/**
 * The wired workspaces runtime — core's `ModuleRuntime` bound to this pair's
 * API (slim wave §21/S2: the plumbing lives once in `@stapel/core`'s
 * `createModuleRuntime`/`createModuleContext`; this module only binds the
 * module-prefixed names). The returned `client` is what the host injects
 * into core's `StapelConfigProvider` (as the default or the `"workspaces"`
 * module client), preserving the client-injection fork seam
 * (frontend-standard §7.2). Auth token/refresh and the verification-403 seam
 * are supplied by the host's auth runtime on the shared client — this pair
 * does not re-implement them.
 */
export type WorkspacesRuntime = ModuleRuntime<WorkspacesApi>;

export type CreateWorkspacesRuntimeOptions = CreateModuleRuntimeOptions;

export function createWorkspacesRuntime(
  options: CreateWorkspacesRuntimeOptions
): WorkspacesRuntime {
  return createModuleRuntime(createWorkspacesApi, options);
}
