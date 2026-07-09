import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { WorkspacesApi } from "../api/workspacesApi.js";
import type { WorkspacesRuntime } from "./runtime.js";

/**
 * The wired WorkspacesRuntime shared through React context by
 * `<WorkspacesProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<WorkspacesRuntime> =
  createModuleContext<WorkspacesRuntime>("Workspaces");

export const WorkspacesRuntimeContext: Context<WorkspacesRuntime | null> =
  kit.RuntimeContext;

export const useWorkspacesRuntime: () => WorkspacesRuntime = kit.useRuntime;

export const useWorkspacesApi: () => WorkspacesApi = kit.useApi;

export const useWorkspacesAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<WorkspacesProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<WorkspacesRuntime>["Provider"] =
  kit.Provider;
