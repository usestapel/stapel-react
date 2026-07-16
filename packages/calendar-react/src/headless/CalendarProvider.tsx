import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { CalendarRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link CalendarRuntime} to every calendar hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createCalendarRuntime({ baseUrl: "/calendar/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <CalendarProvider runtime={runtime}>{app}</CalendarProvider>
 * ```
 */
export const CalendarProvider: (props: {
  runtime: CalendarRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
