import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { TranslateRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link TranslateRuntime} to every translate hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createTranslateRuntime({ baseUrl: "/translate/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <TranslateProvider runtime={runtime}>{app}</TranslateProvider>
 * ```
 */
export const TranslateProvider: (props: {
  runtime: TranslateRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
