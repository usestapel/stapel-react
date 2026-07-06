import type { ReactElement, ReactNode } from "react";
import { NotificationsRuntimeContext } from "../model/context.js";
import type { NotificationsRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link NotificationsRuntime} to every notifications hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own.
 *
 * ```tsx
 * const runtime = createNotificationsRuntime({ baseUrl: "/notifications/api/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <NotificationsProvider runtime={runtime}>{app}</NotificationsProvider>
 * ```
 */
export function NotificationsProvider(props: {
  runtime: NotificationsRuntime;
  children: ReactNode;
}): ReactElement {
  return (
    <NotificationsRuntimeContext.Provider value={props.runtime}>
      {props.children}
    </NotificationsRuntimeContext.Provider>
  );
}
