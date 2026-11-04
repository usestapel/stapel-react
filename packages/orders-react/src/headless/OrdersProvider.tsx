import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { OrdersRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link OrdersRuntime} to every orders hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createOrdersRuntime({ baseUrl: "/orders/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <OrdersProvider runtime={runtime}>{app}</OrdersProvider>
 * ```
 */
export const OrdersProvider: (props: {
  runtime: OrdersRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
