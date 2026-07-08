import { createStapelClient } from "@stapel/core";
import type { Analytics, StapelClient } from "@stapel/core";
import { createRecordingsApi } from "../api/recordingsApi.js";
import type { RecordingsApi } from "../api/recordingsApi.js";

/**
 * The wired recordings runtime — builds a {@link StapelClient} and the pair's
 * API over it. The returned `client` is what the host injects into core's
 * `StapelConfigProvider` (as the default or the `"recordings"` module client),
 * preserving the client-injection fork seam (frontend-standard §7.2). Auth
 * token/refresh and the verification-403 seam are supplied by the host's auth
 * runtime on the shared client — this pair does not re-implement them.
 */
export interface RecordingsRuntime {
  readonly client: StapelClient;
  readonly api: RecordingsApi;
  readonly analytics: Analytics | null;
}

export interface CreateRecordingsRuntimeOptions {
  /** e.g. `/recordings/api/` or `https://app.example.com/recordings/api/`. */
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  readonly analytics?: Analytics | null;
  /** Extra headers merged into every request (e.g. a tenant id). */
  readonly defaultHeaders?: Record<string, string>;
}

export function createRecordingsRuntime(
  options: CreateRecordingsRuntimeOptions
): RecordingsRuntime {
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
  const api = createRecordingsApi(client);
  return { client, api, analytics };
}
