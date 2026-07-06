import { createStapelClient } from "@stapel/core";
import type { Analytics, StapelClient } from "@stapel/core";
import { createWorkspacesApi } from "../api/workspacesApi.js";
import type { WorkspacesApi } from "../api/workspacesApi.js";

/**
 * The wired workspaces runtime — builds a {@link StapelClient} and the pair's
 * API over it. The returned `client` is what the host injects into core's
 * `StapelConfigProvider` (as the default or the `"workspaces"` module client),
 * preserving the client-injection fork seam (frontend-standard §7.2). Auth
 * token/refresh and the verification-403 seam are supplied by the host's auth
 * runtime on the shared client — this pair does not re-implement them.
 */
export interface WorkspacesRuntime {
  readonly client: StapelClient;
  readonly api: WorkspacesApi;
  readonly analytics: Analytics | null;
}

export interface CreateWorkspacesRuntimeOptions {
  /** e.g. `/workspaces/api/` or `https://app.example.com/workspaces/api/`. */
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  readonly analytics?: Analytics | null;
  /** Extra headers merged into every request (e.g. a tenant id). */
  readonly defaultHeaders?: Record<string, string>;
}

export function createWorkspacesRuntime(
  options: CreateWorkspacesRuntimeOptions
): WorkspacesRuntime {
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
  const api = createWorkspacesApi(client);
  return { client, api, analytics };
}
