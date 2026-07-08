import type { ReactElement, ReactNode } from "react";
import { CalendarRuntimeContext } from "../model/context.js";
import type { CalendarRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link CalendarRuntime} to every calendar hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own.
 *
 * ```tsx
 * const runtime = createCalendarRuntime({ baseUrl: "/calendar/api/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <CalendarProvider runtime={runtime}>{app}</CalendarProvider>
 * ```
 */
export function CalendarProvider(props: {
  runtime: CalendarRuntime;
  children: ReactNode;
}): ReactElement {
  return (
    <CalendarRuntimeContext.Provider value={props.runtime}>
      {props.children}
    </CalendarRuntimeContext.Provider>
  );
}
