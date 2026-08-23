import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { VideoRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link VideoRuntime} to every video hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createVideoRuntime({ baseUrl: "/video/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <VideoProvider runtime={runtime}>{app}</VideoProvider>
 * ```
 */
export const VideoProvider: (props: {
  runtime: VideoRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
