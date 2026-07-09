import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { NotificationsRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link NotificationsRuntime} to every notifications hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createNotificationsRuntime({ baseUrl: "/notifications/api/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <NotificationsProvider runtime={runtime}>{app}</NotificationsProvider>
 * ```
 */
export const NotificationsProvider: (props: {
  runtime: NotificationsRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
