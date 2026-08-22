import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { SearchRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link SearchRuntime} to every search hook and headless
 * component below it. Bring your own visual shell — this component renders
 * nothing of its own. (Core's `createModuleContext` provider, bound to this
 * pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createSearchRuntime({ baseUrl: "/search/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <SearchProvider runtime={runtime}>{app}</SearchProvider>
 * ```
 */
export const SearchProvider: (props: {
  runtime: SearchRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
