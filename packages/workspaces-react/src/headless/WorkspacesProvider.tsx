import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { WorkspacesRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link WorkspacesRuntime} to every workspaces hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createWorkspacesRuntime({ baseUrl: "/workspaces/api/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <WorkspacesProvider runtime={runtime}>{app}</WorkspacesProvider>
 * ```
 */
export const WorkspacesProvider: (props: {
  runtime: WorkspacesRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
