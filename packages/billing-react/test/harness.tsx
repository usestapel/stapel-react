/**
 * Shared test harness: a billing runtime over an injected `fetch`, wrapped in
 * the providers a hook or a skin needs.
 *
 * MOCK THE WIRE, NOT THE MODULE (CONTRIBUTING.md): every request goes through
 * the real `StapelClient`, and every response is a real `Response` carrying a
 * body shaped exactly as stapel-billing 0.8.1's schema declares it — a
 * `WalletResponse` with `lots[]`, `holds[]` and `expiring_soon`, snake_case
 * and all, a `CatalogResponse` with both product lists. Nothing here
 * hand-shapes a value the code under test would otherwise have derived.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { I18nEngine } from "@stapel/core";
import {
  BillingProvider,
  createBillingRuntime,
  registerBillingI18n,
} from "../src/index.js";
import { registerBillingI18nRu } from "../src/i18n/ru.js";

export const BASE = "https://billing.test/billing/api/v1";

/** One recorded request. */
export interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly body: string | null;
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

/**
 * Build a fetch over `substring → handler` routes, tried in declaration order
 * and matched on `"<METHOD> <substring>"` or just the substring. `/wallet` and
 * `/wallet/transactions` share a prefix, so declaration order is what
 * distinguishes them — the more specific route first.
 */
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
    const body = typeof init?.body === "string" ? init.body : null;
    const call: RecordedCall = { url, method, body };
    calls.push(call);

    for (const [pattern, route] of Object.entries(routes)) {
      const [maybeMethod, ...rest] = pattern.split(" ");
      const hasMethod = rest.length > 0 && /^[A-Z]+$/.test(maybeMethod ?? "");
      const needle = hasMethod ? rest.join(" ") : pattern;
      if (hasMethod && maybeMethod !== method) continue;
      if (!url.includes(needle)) continue;
      const result = typeof route === "function" ? route(call) : route;
      return new Response(JSON.stringify(result.body ?? {}), {
        status: result.status ?? 200,
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

/** The wallet read is down — the arm that must never render as "no credits". */
export const WALLET_UNAVAILABLE: HandlerResult = {
  status: 503,
  body: {
    localizable_error: "error.503.service_unavailable",
    error: "Billing is unavailable",
    params: {},
  },
};

/** Providers every test render needs. */
export function TestProviders(props: {
  server: MockServer;
  locale?: string;
  children: ReactNode;
}): ReactElement {
  const { server, locale } = props;
  const { runtime, i18n, queryClient } = useMemo(() => {
    const engine: I18nEngine = createI18n({ locale: locale ?? "en" });
    registerBillingI18n(engine);
    registerBillingI18nRu(engine);
    return {
      runtime: createBillingRuntime({ baseUrl: BASE, fetch: server.fetch }),
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
  }, [server, locale]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <BillingProvider runtime={runtime}>{props.children}</BillingProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
