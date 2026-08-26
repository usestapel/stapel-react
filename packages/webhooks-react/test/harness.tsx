/**
 * Shared test harness: a webhooks runtime over an injected `fetch`, wrapped in
 * the providers a hook or a skin needs.
 *
 * MOCK THE WIRE, NOT THE MODULE (CONTRIBUTING.md): every request goes through
 * the real `StapelClient`, every response is a real `Response` carrying the
 * real body stapel-webhooks sends — snake_case, `has_secret` and never
 * `secret` on a read, an `error.503.mandate_unavailable` envelope for the
 * refusal that is about the deployment. Nothing here hand-shapes a value the
 * code under test would otherwise have derived.
 *
 * Routes are matched on `"<METHOD> <substring>"` or a bare substring, in
 * declaration order. The METHOD matters more here than in most pairs: this
 * module mounts a GET and a POST on the same `/subscriptions` path, and
 * `/subscriptions/{id}` answers a GET, a PATCH and a DELETE.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { I18nEngine } from "@stapel/core";
import {
  WebhooksProvider,
  createWebhooksRuntime,
  registerWebhooksI18n,
} from "../src/index.js";
import { registerWebhooksI18nRu } from "../src/i18n/ru.js";
import { registerWebhooksI18nEs } from "../src/i18n/es.js";

export const BASE = "https://webhooks.test/webhooks/api/v1/";

/** One recorded request. */
export interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly body: string | undefined;
}

/** What a handler may return. */
export interface HandlerResult {
  readonly status?: number;
  readonly body?: unknown;
}

export type Handler = (call: RecordedCall) => HandlerResult;

export interface MockServer {
  readonly fetch: typeof globalThis.fetch;
  readonly calls: RecordedCall[];
}

export function mockServer(
  routes: Readonly<Record<string, Handler | HandlerResult>>
): MockServer {
  const calls: RecordedCall[] = [];
  const fetchImpl = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? init.body : undefined;
    const call: RecordedCall = { url, method, body };
    calls.push(call);

    for (const [pattern, route] of Object.entries(routes)) {
      const [maybeMethod, ...rest] = pattern.split(" ");
      const hasMethod = rest.length > 0 && /^[A-Z]+$/.test(maybeMethod ?? "");
      const needle = hasMethod ? rest.join(" ") : pattern;
      if (hasMethod && maybeMethod !== method) continue;
      if (!url.includes(needle)) continue;
      const result = typeof route === "function" ? route(call) : route;
      const status = result.status ?? 200;
      if (status === 204) return new Response(null, { status });
      return new Response(JSON.stringify(result.body ?? {}), {
        status,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ localizable_error: "error.404.not_found" }),
      { status: 404, headers: { "content-type": "application/json" } }
    );
  }) as typeof globalThis.fetch;

  return { fetch: fetchImpl, calls };
}

/** The 503 every route of this module can answer. */
export const MANDATE_UNAVAILABLE: HandlerResult = {
  status: 503,
  body: {
    localizable_error: "error.503.mandate_unavailable",
    error: "Cannot verify workspace mandate right now",
    params: {},
  },
};

/** At the per-owner ceiling — the create refusal a client cannot predict. */
export const SUBSCRIPTION_CAP: HandlerResult = {
  status: 409,
  body: {
    localizable_error: "error.409.webhooks_subscription_cap",
    error: "You already have the maximum number of subscriptions",
    params: {},
  },
};

/** A webhook target that is not https. */
export const INSECURE_TARGET: HandlerResult = {
  status: 400,
  body: {
    localizable_error: "error.400.webhooks_insecure_target",
    error: "A webhook target must be an https URL",
    params: {},
  },
};

/** Rotation asked of a delivery type that carries no signature. */
export const NOT_SIGNED_TYPE: HandlerResult = {
  status: 400,
  body: {
    localizable_error: "error.400.webhooks_not_signed_type",
    error: "This delivery type carries no signature, so it has no secret to rotate",
    params: {},
  },
};

/** Replay asked of a row that is not a dead letter. */
export const NOT_REPLAYABLE: HandlerResult = {
  status: 409,
  body: {
    localizable_error: "error.409.webhooks_not_replayable",
    error: "Only a dead-lettered delivery can be replayed",
    params: {},
  },
};

/** Providers every test render needs. */
export function TestProviders(props: {
  server: MockServer;
  locale?: string;
  docsHref?: string;
  children: ReactNode;
}): ReactElement {
  const { server, locale, docsHref } = props;
  const { runtime, i18n, queryClient } = useMemo(() => {
    const engine: I18nEngine = createI18n({ locale: locale ?? "en" });
    registerWebhooksI18n(engine);
    registerWebhooksI18nRu(engine);
    registerWebhooksI18nEs(engine);
    return {
      runtime: createWebhooksRuntime({
        baseUrl: BASE,
        fetch: server.fetch,
        ...(docsHref !== undefined ? { docsHref } : {}),
      }),
      i18n: engine,
      queryClient: new QueryClient({
        // No retries: a test asserting a refusal must see it on the first
        // answer, not three timeouts later.
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      }),
    };
  }, [server, locale, docsHref]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <WebhooksProvider runtime={runtime}>{props.children}</WebhooksProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
