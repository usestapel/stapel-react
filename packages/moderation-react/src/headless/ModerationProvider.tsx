import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { ModerationRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link ModerationRuntime} to every moderation hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createModerationRuntime({ baseUrl: "/moderation/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <ModerationProvider runtime={runtime}>{app}</ModerationProvider>
 * ```
 */
export const ModerationProvider: (props: {
  runtime: ModerationRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
