import { createStapelClient } from "@stapel/core";
import type { Analytics, StapelClient } from "@stapel/core";
import { createBillingApi } from "../api/billingApi.js";
import type { BillingApi } from "../api/billingApi.js";

/**
 * The wired billing runtime — builds a {@link StapelClient} and the pair's
 * API over it. The returned `client` is what the host injects into core's
 * `StapelConfigProvider` (as the default or the `"billing"` module client),
 * preserving the client-injection fork seam (frontend-standard §7.2). Auth
 * token/refresh and the verification-403 seam are supplied by the host's auth
 * runtime on the shared client — this pair does not re-implement them.
 */
export interface BillingRuntime {
  readonly client: StapelClient;
  readonly api: BillingApi;
  readonly analytics: Analytics | null;
}

export interface CreateBillingRuntimeOptions {
  /** e.g. `/billing/api/` or `https://app.example.com/billing/api/`. */
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  readonly analytics?: Analytics | null;
  /** Extra headers merged into every request (e.g. a tenant id). */
  readonly defaultHeaders?: Record<string, string>;
}

export function createBillingRuntime(
  options: CreateBillingRuntimeOptions
): BillingRuntime {
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
  const api = createBillingApi(client);
  return { client, api, analytics };
}
