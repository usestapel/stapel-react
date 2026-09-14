import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { AlertsRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link AlertsRuntime} to every alerts hook and screen
 * below it. Bring your own visual shell — this component renders nothing of
 * its own. (Core's `createModuleContext` provider, bound to this pair — slim
 * wave §21/S2.)
 *
 * ```tsx
 * const runtime = createAlertsRuntime({ baseUrl: "/alerts/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <AlertsProvider runtime={runtime}>{app}</AlertsProvider>
 * ```
 */
export const AlertsProvider: (props: {
  runtime: AlertsRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
