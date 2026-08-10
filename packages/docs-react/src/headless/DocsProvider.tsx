import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { DocsRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link DocsRuntime} to every docs hook and headless
 * component below it. Bring your own visual shell — this component renders
 * nothing of its own. (Core's `createModuleContext` provider, bound to this
 * pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createDocsRuntime({ baseUrl: "/docs/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <DocsProvider runtime={runtime}>{app}</DocsProvider>
 * ```
 */
export const DocsProvider: (props: {
  runtime: DocsRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
