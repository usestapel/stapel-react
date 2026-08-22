/**
 * Shared test harness: a reviews runtime over an injected `fetch`, wrapped in
 * the providers a hook or a skin needs.
 *
 * MOCK THE WIRE, NOT THE MODULE (CONTRIBUTING.md): every request goes through
 * the real `StapelClient`, every response is a real `Response` carrying the
 * real body stapel-reviews sends — the AnchorPagination envelope, the
 * `{avg: 0.0, count: 0}` of an unrated target, the 400 whose
 * `localizable_error` is the duplicate code. Nothing here hand-shapes a value
 * the code under test would otherwise have derived.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { I18nEngine } from "@stapel/core";
import {
  ReviewsProvider,
  createReviewsRuntime,
  registerReviewsI18n,
} from "../src/index.js";
import type { ReviewRatingBounds } from "../src/index.js";

export const BASE = "https://reviews.test/reviews/api/v1";

/** One recorded request. */
export interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
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
 * and matched on `"<METHOD> <substring>"` or just the substring.
 *
 * Declaration order matters here more than in the sibling pairs: `/reviews`
 * is a prefix of `/reviews/aggregate`, so an aggregate route must be declared
 * first (or spelled with its own path).
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
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    let body: unknown;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body) as unknown;
      } catch {
        body = init.body;
      }
    }
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
      const nullBody = status === 204 || status === 205;
      return new Response(nullBody ? null : JSON.stringify(result.body ?? {}), {
        status,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ localizable_error: "error.404.not_found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;

  return { fetch: fetchImpl, calls };
}

/** Providers every test render needs. */
export function TestProviders(props: {
  server: MockServer;
  locale?: string;
  ratingBounds?: Partial<ReviewRatingBounds>;
  children: ReactNode;
}): ReactElement {
  const { server, locale, ratingBounds } = props;
  const { runtime, i18n, queryClient } = useMemo(() => {
    const engine: I18nEngine = createI18n({ locale: locale ?? "en" });
    registerReviewsI18n(engine);
    return {
      runtime: createReviewsRuntime({
        baseUrl: BASE,
        fetch: server.fetch,
        ...(ratingBounds !== undefined ? { ratingBounds } : {}),
      }),
      i18n: engine,
      queryClient: new QueryClient({
        // No retries: a test asserting a refusal must see it on the first
        // answer, not three timeouts later.
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
    };
  }, [server, locale, ratingBounds]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <ReviewsProvider runtime={runtime}>{props.children}</ReviewsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
