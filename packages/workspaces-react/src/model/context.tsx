import { createContext, useContext } from "react";
import type { Context } from "react";
import type { Analytics } from "@stapel/core";
import type { WorkspacesApi } from "../api/workspacesApi.js";
import type { WorkspacesRuntime } from "./runtime.js";

/**
 * The wired WorkspacesRuntime shared through React context by
 * `<WorkspacesProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here.
 */
export const WorkspacesRuntimeContext: Context<WorkspacesRuntime | null> =
  createContext<WorkspacesRuntime | null>(null);

export function useWorkspacesRuntime(): WorkspacesRuntime {
  const runtime = useContext(WorkspacesRuntimeContext);
  if (runtime === null) {
    throw new Error("Workspaces hooks must be used within a <WorkspacesProvider>");
  }
  return runtime;
}

export function useWorkspacesApi(): WorkspacesApi {
  return useWorkspacesRuntime().api;
}

export function useWorkspacesAnalytics(): Analytics | null {
  return useWorkspacesRuntime().analytics;
}
