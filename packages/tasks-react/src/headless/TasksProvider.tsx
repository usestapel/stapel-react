import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { TasksRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link TasksRuntime} to every tasks hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createTasksRuntime({ baseUrl: "/tasks/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <TasksProvider runtime={runtime}>{app}</TasksProvider>
 * ```
 */
export const TasksProvider: (props: {
  runtime: TasksRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
