import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { BillingRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link BillingRuntime} to every billing hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createBillingRuntime({ baseUrl: "/billing/api/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <BillingProvider runtime={runtime}>{app}</BillingProvider>
 * ```
 */
export const BillingProvider: (props: {
  runtime: BillingRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
