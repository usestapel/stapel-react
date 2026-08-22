import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { CdnRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link CdnRuntime} to every CDN hook and headless
 * component below it. Bring your own visual shell — this component renders
 * nothing of its own.
 *
 * ```tsx
 * const runtime = createCdnRuntime({ baseUrl: "/cdn/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ clients: { cdn } }}>
 * <CdnProvider runtime={runtime}>{app}</CdnProvider>
 * ```
 */
export const CdnProvider: (props: {
  runtime: CdnRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
