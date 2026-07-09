/**
 * Module-pair plumbing factories (slim wave §21/S2). Every standard
 * `@stapel/<module>-react` pair used to stamp three byte-identical files —
 * `model/runtime.ts` (client + api wiring), `model/context.tsx` (React
 * context + guard hooks), `headless/<Mod>Provider.tsx` — differing only in
 * the module name. These factories are the ONE reviewed copy; each pair
 * binds them under its module-prefixed public names, so a pair's public API
 * is unchanged while its plumbing collapses to a few lines.
 *
 * auth-react is deliberately NOT built on this: its runtime genuinely
 * differs (useSyncExternalStore session state, token refresh, verification
 * controller) and stays bespoke.
 */
import { createContext, useContext } from "react";
import type { Context, ReactElement, ReactNode } from "react";
import { createStapelClient } from "./client.js";
import type { StapelClient } from "./client.js";
import type { Analytics } from "./analytics/types.js";

/**
 * The wired runtime a standard pair shares through React context — a
 * {@link StapelClient} plus the pair's typed API over it. The `client` is
 * what the host injects into core's `StapelConfigProvider` (as the default
 * or the per-module client), preserving the client-injection fork seam
 * (frontend-standard §7.2). Auth token/refresh and the verification-403
 * seam are supplied by the host's auth runtime on the shared client —
 * standard pairs do not re-implement them.
 */
export interface ModuleRuntime<TApi> {
  readonly client: StapelClient;
  readonly api: TApi;
  readonly analytics: Analytics | null;
}

export interface CreateModuleRuntimeOptions {
  /** e.g. `/profiles/api/` or `https://app.example.com/profiles/api/`. */
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  readonly analytics?: Analytics | null;
  /** Extra headers merged into every request (e.g. a tenant id). */
  readonly defaultHeaders?: Record<string, string>;
}

/**
 * Build a standard pair runtime: a {@link StapelClient} for the module's
 * base URL and the pair's API over it (`createApi` is the pair's generated
 * `create<Mod>Api`).
 */
export function createModuleRuntime<TApi>(
  createApi: (client: StapelClient) => TApi,
  options: CreateModuleRuntimeOptions
): ModuleRuntime<TApi> {
  const analytics = options.analytics ?? null;
  const client = createStapelClient({
    baseUrl: options.baseUrl,
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
    ...(options.credentials !== undefined
      ? { credentials: options.credentials }
      : {}),
    ...(options.defaultHeaders !== undefined
      ? { defaultHeaders: options.defaultHeaders }
      : {}),
  });
  const api = createApi(client);
  return { client, api, analytics };
}

/**
 * What {@link createModuleContext} returns: the context object, a renderless
 * provider, and the guard hooks a pair re-exports under its module-prefixed
 * names (`useProfilesRuntime`, `useProfilesApi`, …).
 */
export interface ModuleContextKit<TRuntime extends ModuleRuntime<unknown>> {
  readonly RuntimeContext: Context<TRuntime | null>;
  /** Renderless provider — bring your own visual shell. */
  readonly Provider: (props: {
    runtime: TRuntime;
    children: ReactNode;
  }) => ReactElement;
  /** The wired runtime; throws outside the pair's provider. */
  readonly useRuntime: () => TRuntime;
  readonly useApi: () => TRuntime["api"];
  readonly useAnalytics: () => Analytics | null;
}

/**
 * Create a pair's context + provider + guard hooks in one call.
 * `moduleName` is the capitalized module base (e.g. `"Profiles"`) — it only
 * shapes the guard-hook error message
 * (`"Profiles hooks must be used within a <ProfilesProvider>"`).
 */
export function createModuleContext<TRuntime extends ModuleRuntime<unknown>>(
  moduleName: string
): ModuleContextKit<TRuntime> {
  const RuntimeContext = createContext<TRuntime | null>(null);

  function useRuntime(): TRuntime {
    const runtime = useContext(RuntimeContext);
    if (runtime === null) {
      throw new Error(
        `${moduleName} hooks must be used within a <${moduleName}Provider>`
      );
    }
    return runtime;
  }

  function useApi(): TRuntime["api"] {
    return useRuntime().api;
  }

  function useAnalytics(): Analytics | null {
    return useRuntime().analytics;
  }

  function Provider(props: {
    runtime: TRuntime;
    children: ReactNode;
  }): ReactElement {
    return (
      <RuntimeContext.Provider value={props.runtime}>
        {props.children}
      </RuntimeContext.Provider>
    );
  }

  return { RuntimeContext, Provider, useRuntime, useApi, useAnalytics };
}
