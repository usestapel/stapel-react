import { createContext, useContext } from "react";
import type { ReactElement, ReactNode } from "react";
import type { StapelClient } from "./client.js";

/**
 * App-level Stapel configuration. `clients` allows per-module client
 * overrides — the client-injection fork-resolution seam of
 * frontend-standard §7.2: a divergent backend gets its own generated client
 * injected into the same package machines.
 */
export interface StapelConfig {
  /** Default API client used by all `@stapel/<module>-react` packages. */
  readonly client: StapelClient;
  /** Per-module overrides, keyed by module name (e.g. `"auth"`). */
  readonly clients?: Readonly<Record<string, StapelClient>>;
}

const StapelConfigContext = createContext<StapelConfig | null>(null);

export function StapelConfigProvider(props: {
  config: StapelConfig;
  children: ReactNode;
}): ReactElement {
  return (
    <StapelConfigContext.Provider value={props.config}>
      {props.children}
    </StapelConfigContext.Provider>
  );
}

export function useStapelConfig(): StapelConfig {
  const config = useContext(StapelConfigContext);
  if (config === null) {
    throw new Error(
      "useStapelConfig must be used within a <StapelConfigProvider>"
    );
  }
  return config;
}

/**
 * Resolve the API client for a module: the per-module override when
 * configured, otherwise the default client.
 */
export function useStapelClient(module?: string): StapelClient {
  const config = useStapelConfig();
  if (module !== undefined) {
    const override = config.clients?.[module];
    if (override) return override;
  }
  return config.client;
}
