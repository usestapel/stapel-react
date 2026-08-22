import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { CategoriesRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link CategoriesRuntime} to every categories hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound to
 * this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createCategoriesRuntime({ baseUrl: "/categories/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <CategoriesProvider runtime={runtime}>{app}</CategoriesProvider>
 * ```
 */
export const CategoriesProvider: (props: {
  runtime: CategoriesRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
