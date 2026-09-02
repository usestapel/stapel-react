import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createDriveApi } from "../api/driveApi.js";
import type { DriveApi } from "../api/driveApi.js";

/**
 * The wired drive runtime — core's `ModuleRuntime` bound to this pair's five
 * new operations (slim wave §21/S2: the plumbing lives once in
 * `@stapel/core`'s `createModuleRuntime`/`createModuleContext`).
 *
 * `baseUrl` is stapel-docs' own (`/docs/api/v1/`) — the drive surfaces ARE
 * that module's endpoints (spec §2.1), so this runtime and the docs runtime
 * point at one backend and, in a host that shares one `StapelClient`, at one
 * client. Nothing here re-implements auth: the host's auth runtime supplies
 * token/refresh and the verification-403 seam on the shared client.
 */
export type DriveRuntime = ModuleRuntime<DriveApi>;

export type CreateDriveRuntimeOptions = CreateModuleRuntimeOptions;

export function createDriveRuntime(
  options: CreateDriveRuntimeOptions
): DriveRuntime {
  return createModuleRuntime(
    (client) =>
      createDriveApi(client, {
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
