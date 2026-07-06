import { createStapelClient } from "@stapel/core";
import type { Analytics, StapelClient } from "@stapel/core";
import { createProfilesApi } from "../api/profilesApi.js";
import type { ProfilesApi } from "../api/profilesApi.js";

/**
 * The wired profiles runtime — builds a {@link StapelClient} and the pair's
 * API over it. The returned `client` is what the host injects into core's
 * `StapelConfigProvider` (as the default or the `"profiles"` module client),
 * preserving the client-injection fork seam (frontend-standard §7.2). Auth
 * token/refresh and the verification-403 seam are supplied by the host's auth
 * runtime on the shared client — this pair does not re-implement them.
 */
export interface ProfilesRuntime {
  readonly client: StapelClient;
  readonly api: ProfilesApi;
  readonly analytics: Analytics | null;
}

export interface CreateProfilesRuntimeOptions {
  /** e.g. `/profiles/api/` or `https://app.example.com/profiles/api/`. */
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  readonly analytics?: Analytics | null;
  /** Extra headers merged into every request (e.g. a tenant id). */
  readonly defaultHeaders?: Record<string, string>;
}

export function createProfilesRuntime(
  options: CreateProfilesRuntimeOptions
): ProfilesRuntime {
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
  const api = createProfilesApi(client);
  return { client, api, analytics };
}
