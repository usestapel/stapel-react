import { useEffect } from "react";
import type { ReactElement, ReactNode } from "react";
import { AuthRuntimeContext } from "../model/context.js";
import type { AuthRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link AuthRuntime} to every auth hook and headless
 * component below it, and restores any persisted session once on mount. Bring
 * your own visual shell — this component renders nothing of its own.
 *
 * ```tsx
 * const runtime = createAuthRuntime({ baseUrl: "/auth/api", storage });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <AuthProvider runtime={runtime}>{app}</AuthProvider>
 * ```
 */
export function AuthProvider(props: {
  runtime: AuthRuntime;
  children: ReactNode;
}): ReactElement {
  const { runtime } = props;
  useEffect(() => {
    void runtime.session.restore();
  }, [runtime]);
  return (
    <AuthRuntimeContext.Provider value={runtime}>
      {props.children}
    </AuthRuntimeContext.Provider>
  );
}
