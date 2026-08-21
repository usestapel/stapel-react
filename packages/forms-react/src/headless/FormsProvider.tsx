import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { FormsRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link FormsRuntime} to every forms hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createFormsRuntime({ baseUrl: "/forms/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <FormsProvider runtime={runtime}>{app}</FormsProvider>
 * ```
 */
export const FormsProvider: (props: {
  runtime: FormsRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
