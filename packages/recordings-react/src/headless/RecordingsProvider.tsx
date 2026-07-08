import type { ReactElement, ReactNode } from "react";
import { RecordingsRuntimeContext } from "../model/context.js";
import type { RecordingsRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link RecordingsRuntime} to every recordings hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own.
 *
 * ```tsx
 * const runtime = createRecordingsRuntime({ baseUrl: "/recordings/api/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <RecordingsProvider runtime={runtime}>{app}</RecordingsProvider>
 * ```
 */
export function RecordingsProvider(props: {
  runtime: RecordingsRuntime;
  children: ReactNode;
}): ReactElement {
  return (
    <RecordingsRuntimeContext.Provider value={props.runtime}>
      {props.children}
    </RecordingsRuntimeContext.Provider>
  );
}
