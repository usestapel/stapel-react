import { createStapelClient } from "@stapel/core";
import type { Analytics, StapelClient } from "@stapel/core";
import { createNotificationsApi } from "../api/notificationsApi.js";
import type { NotificationsApi } from "../api/notificationsApi.js";

/**
 * The wired notifications runtime — builds a {@link StapelClient} and the pair's
 * API over it. The returned `client` is what the host injects into core's
 * `StapelConfigProvider` (as the default or the `"notifications"` module client),
 * preserving the client-injection fork seam (frontend-standard §7.2). Auth
 * token/refresh and the verification-403 seam are supplied by the host's auth
 * runtime on the shared client — this pair does not re-implement them.
 */
export interface NotificationsRuntime {
  readonly client: StapelClient;
  readonly api: NotificationsApi;
  readonly analytics: Analytics | null;
}

export interface CreateNotificationsRuntimeOptions {
  /** e.g. `/notifications/api/` or `https://app.example.com/notifications/api/`. */
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  readonly analytics?: Analytics | null;
  /** Extra headers merged into every request (e.g. a tenant id). */
  readonly defaultHeaders?: Record<string, string>;
}

export function createNotificationsRuntime(
  options: CreateNotificationsRuntimeOptions
): NotificationsRuntime {
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
  const api = createNotificationsApi(client);
  return { client, api, analytics };
}
