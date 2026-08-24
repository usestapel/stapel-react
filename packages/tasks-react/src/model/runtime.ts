import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createTasksApi } from "../api/tasksApi.js";
import type { TasksApi } from "../api/tasksApi.js";

/**
 * The wired tasks runtime — core's `ModuleRuntime` bound to this pair's
 * API (slim wave §21/S2: the plumbing lives once in `@stapel/core`'s
 * `createModuleRuntime`/`createModuleContext`; this module only binds the
 * module-prefixed names). The returned `client` is what the host injects
 * into core's `StapelConfigProvider` (as the default or the `"tasks"`
 * module client), preserving the client-injection fork seam
 * (frontend-standard §7.2). Auth token/refresh and the verification-403 seam
 * are supplied by the host's auth runtime on the shared client — this pair
 * does not re-implement them.
 */
export type TasksRuntime = ModuleRuntime<TasksApi>;

export type CreateTasksRuntimeOptions = CreateModuleRuntimeOptions;

export function createTasksRuntime(
  options: CreateTasksRuntimeOptions
): TasksRuntime {
  return createModuleRuntime(createTasksApi, options);
}
