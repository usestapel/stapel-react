import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { CurrenciesRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link CurrenciesRuntime} to every currencies hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createCurrenciesRuntime({ baseUrl: "/currencies/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <CurrenciesProvider runtime={runtime}>{app}</CurrenciesProvider>
 * ```
 */
export const CurrenciesProvider: (props: {
  runtime: CurrenciesRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
