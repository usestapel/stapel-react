import type { ReactElement, ReactNode } from "react";
import { WorkspacesRuntimeContext } from "../model/context.js";
import type { WorkspacesRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link WorkspacesRuntime} to every workspaces hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own.
 *
 * ```tsx
 * const runtime = createWorkspacesRuntime({ baseUrl: "/workspaces/api/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <WorkspacesProvider runtime={runtime}>{app}</WorkspacesProvider>
 * ```
 */
export function WorkspacesProvider(props: {
  runtime: WorkspacesRuntime;
  children: ReactNode;
}): ReactElement {
  return (
    <WorkspacesRuntimeContext.Provider value={props.runtime}>
      {props.children}
    </WorkspacesRuntimeContext.Provider>
  );
}
