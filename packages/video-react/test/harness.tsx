/**
 * Shared test harness: a video runtime over an injected `fetch`, wrapped in
 * the providers a hook or a skin needs.
 *
 * MOCK THE WIRE, NOT THE MODULE (CONTRIBUTING.md): every request goes through
 * the real `StapelClient`, every response is a real `Response` carrying the
 * real body stapel-video sends — a `ScopeUsageResponse` with the field names
 * and the snake_case the schema declares, an `error.404.video_scope_not_found`
 * envelope for the uniform refusal. Nothing here hand-shapes a value the code
 * under test would otherwise have derived, and no test asserts against a
 * fixture the source could not have produced.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { I18nEngine } from "@stapel/core";
import {
  VideoProvider,
  createVideoRuntime,
  registerVideoI18n,
} from "../src/index.js";
import { registerVideoI18nRu } from "../src/i18n/ru.js";

export const BASE = "https://video.test/video/api/v1";

/** A workspace id shaped like a real one, named after nobody. */
export const SCOPE = "acme-7f0c";

/** One recorded request. */
export interface RecordedCall {
  readonly url: string;
  readonly method: string;
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
 * and matched on `"<METHOD> <substring>"` or just the substring. The whole URL
 * including the query string is matched, so a route can distinguish
 * `?months=6` from `?month=2026-08` — which is the difference between the two
 * reads this pair makes.
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
    const call: RecordedCall = { url, method };
    calls.push(call);

    for (const [pattern, route] of Object.entries(routes)) {
      const [maybeMethod, ...rest] = pattern.split(" ");
      const hasMethod = rest.length > 0 && /^[A-Z]+$/.test(maybeMethod ?? "");
      const needle = hasMethod ? rest.join(" ") : pattern;
      if (hasMethod && maybeMethod !== method) continue;
      if (!url.includes(needle)) continue;
      const result = typeof route === "function" ? route(call) : route;
      const status = result.status ?? 200;
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

/** The uniform refusal, as stapel-video's error envelope carries it. */
export const SCOPE_NOT_FOUND: HandlerResult = {
  status: 404,
  body: {
    localizable_error: "error.404.video_scope_not_found",
    error: "Scope not found",
    params: {},
  },
};

/** The period refusal — a malformed `month`, an out-of-range `months`, a
 * `tz` that is not an IANA zone. */
export const INVALID_PERIOD: HandlerResult = {
  status: 400,
  body: {
    localizable_error: "error.400.video_invalid_usage_period",
    error: "month must be YYYY-MM, months a positive integer, and tz an IANA time zone",
    params: {},
  },
};

/** Providers every test render needs. */
export function TestProviders(props: {
  server: MockServer;
  locale?: string;
  scopeKey?: string;
  children: ReactNode;
}): ReactElement {
  const { server, locale, scopeKey } = props;
  const { runtime, i18n, queryClient } = useMemo(() => {
    const engine: I18nEngine = createI18n({ locale: locale ?? "en" });
    registerVideoI18n(engine);
    registerVideoI18nRu(engine);
    return {
      runtime: createVideoRuntime({
        baseUrl: BASE,
        fetch: server.fetch,
        ...(scopeKey !== undefined ? { scopeKey } : {}),
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
  }, [server, locale, scopeKey]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <VideoProvider runtime={runtime}>{props.children}</VideoProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
