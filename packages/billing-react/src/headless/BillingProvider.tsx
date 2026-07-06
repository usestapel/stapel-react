import type { ReactElement, ReactNode } from "react";
import { BillingRuntimeContext } from "../model/context.js";
import type { BillingRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link BillingRuntime} to every billing hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own.
 *
 * ```tsx
 * const runtime = createBillingRuntime({ baseUrl: "/billing/api/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <BillingProvider runtime={runtime}>{app}</BillingProvider>
 * ```
 */
export function BillingProvider(props: {
  runtime: BillingRuntime;
  children: ReactNode;
}): ReactElement {
  return (
    <BillingRuntimeContext.Provider value={props.runtime}>
      {props.children}
    </BillingRuntimeContext.Provider>
  );
}
