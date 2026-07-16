import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { ProfilesRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link ProfilesRuntime} to every profiles hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createProfilesRuntime({ baseUrl: "/profiles/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <ProfilesProvider runtime={runtime}>{app}</ProfilesProvider>
 * ```
 */
export const ProfilesProvider: (props: {
  runtime: ProfilesRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
