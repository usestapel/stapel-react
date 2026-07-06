import type { ReactElement, ReactNode } from "react";
import { ProfilesRuntimeContext } from "../model/context.js";
import type { ProfilesRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link ProfilesRuntime} to every profiles hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own.
 *
 * ```tsx
 * const runtime = createProfilesRuntime({ baseUrl: "/profiles/api/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <ProfilesProvider runtime={runtime}>{app}</ProfilesProvider>
 * ```
 */
export function ProfilesProvider(props: {
  runtime: ProfilesRuntime;
  children: ReactNode;
}): ReactElement {
  return (
    <ProfilesRuntimeContext.Provider value={props.runtime}>
      {props.children}
    </ProfilesRuntimeContext.Provider>
  );
}
