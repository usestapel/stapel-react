import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { RecordingsRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link RecordingsRuntime} to every recordings hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createRecordingsRuntime({ baseUrl: "/recordings/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <RecordingsProvider runtime={runtime}>{app}</RecordingsProvider>
 * ```
 */
export const RecordingsProvider: (props: {
  runtime: RecordingsRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
