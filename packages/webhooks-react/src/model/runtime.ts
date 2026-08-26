import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createWebhooksApi } from "../api/webhooksApi.js";
import type { WebhooksApi } from "../api/webhooksApi.js";

/**
 * The wired webhooks runtime — core's `ModuleRuntime` bound to this pair's API
 * (slim wave §21/S2), plus the two facts about a deployment that this module
 * genuinely knows and its HTTP surface genuinely does not serve.
 *
 * ── `docsHref`: the receiver's half of the contract ───────────────────────
 *
 * A person who creates a `webhook` subscription then has to WRITE a receiver,
 * and everything they need for that lives in `signing.py` and nowhere on the
 * wire (BACKEND-GAP W-6): the header is
 * `X-Stapel-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "{t}.{body}")>`,
 * the tolerance is 300 seconds, and the envelope arrives beside
 * `X-Stapel-Delivery` / `-Event` / `-Event-Id` / `-Attempt`. This package will
 * not paste a signing tutorial into a settings screen and will not invent a
 * URL for one, so the host points at its own documentation and the secret
 * screen links it. Unset, the link is simply absent — never a dead control.
 *
 * ── `retention`: how long a delivery row survives ─────────────────────────
 *
 * `SUCCEEDED_RETENTION_DAYS` (7) and `DEAD_RETENTION_DAYS` (90) are settings
 * (`conf.py`) and are not served either (BACKEND-GAP W-8). The delivery log
 * says them out loud, because "my delivery disappeared" is otherwise
 * indistinguishable from "my delivery was never recorded". A deployment that
 * changed the settings passes its own numbers here rather than shipping copy
 * that lies.
 */
export type WebhooksRuntime = ModuleRuntime<WebhooksApi> & {
  /** Host documentation for writing a receiver (signature + headers). */
  readonly docsHref: string | undefined;
  readonly retention: RetentionWindow;
};

/** How long the backend keeps delivery rows, in days. */
export interface RetentionWindow {
  readonly succeededDays: number;
  readonly deadDays: number;
}

/** `conf.py` defaults — the numbers a deployment gets when it changes nothing. */
export const DEFAULT_RETENTION: RetentionWindow = {
  succeededDays: 7,
  deadDays: 90,
};

/** The module's canonical mount (`urls.py` + `urls_v1.py`). */
export const DEFAULT_WEBHOOKS_BASE_URL = "/webhooks/api/v1/";

export interface CreateWebhooksRuntimeOptions
  extends Omit<CreateModuleRuntimeOptions, "baseUrl"> {
  /** Default {@link DEFAULT_WEBHOOKS_BASE_URL}. */
  readonly baseUrl?: string;
  /** Where "how do I verify the signature?" goes. Omit for no link. */
  readonly docsHref?: string;
  /** Override when the deployment changed the retention settings. */
  readonly retention?: RetentionWindow;
}

export function createWebhooksRuntime(
  options: CreateWebhooksRuntimeOptions = {}
): WebhooksRuntime {
  const { docsHref, retention, baseUrl, ...moduleOptions } = options;
  const base = createModuleRuntime(createWebhooksApi, {
    ...moduleOptions,
    baseUrl: baseUrl ?? DEFAULT_WEBHOOKS_BASE_URL,
  });
  return {
    ...base,
    docsHref,
    retention: retention ?? DEFAULT_RETENTION,
  };
}
