import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { TasksApi } from "../api/tasksApi.js";
import type { TasksRuntime } from "./runtime.js";

/**
 * The wired TasksRuntime shared through React context by
 * `<TasksProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<TasksRuntime> =
  createModuleContext<TasksRuntime>("Tasks");

export const TasksRuntimeContext: Context<TasksRuntime | null> =
  kit.RuntimeContext;

export const useTasksRuntime: () => TasksRuntime = kit.useRuntime;

export const useTasksApi: () => TasksApi = kit.useApi;

export const useTasksAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<TasksProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<TasksRuntime>["Provider"] =
  kit.Provider;
