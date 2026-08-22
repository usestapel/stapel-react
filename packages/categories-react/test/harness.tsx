/**
 * Shared test harness: a categories runtime over an injected `fetch`, wrapped
 * in the providers a hook or a skin surface needs. Every request is recorded
 * so a test can assert on the WIRE — `min_revision`, `max_revision`,
 * `include_deleted` and the page number are only observable there, and they
 * are exactly what the delta protocol is made of.
 *
 * The catalogue store is an in-memory one by default. jsdom HAS a
 * `localStorage`, so an app-scoped repository would happily persist across
 * tests in the same file and make each test depend on the ones before it.
 */
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { I18nEngine } from "@stapel/core";
import {
  CategoriesProvider,
  createCategoriesRuntime,
  memoryCatalogStore,
  registerCategoriesI18n,
} from "../src/index.js";
import type { CatalogStore } from "../src/index.js";
import { registerCategoriesI18nRu } from "../src/i18n/ru.js";
import { registerCategoriesI18nEs } from "../src/i18n/es.js";

export const BASE = "https://categories.test/categories/api/v1/";

export interface RecordedCall {
  readonly url: string;
  readonly method: string;
}

export interface HandlerResult {
  readonly status?: number;
  readonly body?: unknown;
}

export type Handler = (call: RecordedCall) => HandlerResult;

export interface MockServer {
  readonly fetch: typeof globalThis.fetch;
  readonly calls: RecordedCall[];
  /** Query params of the last request whose URL contains `needle`. */
  lastQuery(needle: string): URLSearchParams | null;
  /** Query params of every request whose URL contains `needle`, in order. */
  queries(needle: string): readonly URLSearchParams[];
}

/**
 * Build a fetch over `path-suffix → handler` routes.
 *
 * Suffix, not substring, and that is load-bearing: `/categories/1/features/`
 * CONTAINS `/categories/`, so a substring router would answer a feature
 * request with the category list and the test would pass against a lie. The
 * pathname's end is what distinguishes this module's five reads.
 */
export function mockServer(
  routes: Readonly<Record<string, Handler | HandlerResult>>
): MockServer {
  const calls: RecordedCall[] = [];
  const entries = Object.entries(routes);
  const fetchImpl = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method });
    const pathname = new URL(url).pathname;

    const match =
      entries.find(([pattern]) => pathname.endsWith(pattern)) ??
      entries.find(([pattern]) => url.includes(pattern));
    if (match !== undefined) {
      const route = match[1];
      const result = typeof route === "function" ? route({ url, method }) : route;
      return new Response(JSON.stringify(result.body ?? {}), {
        status: result.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;

  return {
    fetch: fetchImpl,
    calls,
    lastQuery: (needle) => {
      for (let i = calls.length - 1; i >= 0; i -= 1) {
        const call = calls[i];
        if (call !== undefined && call.url.includes(needle)) {
          return new URL(call.url).searchParams;
        }
      }
      return null;
    },
    queries: (needle) =>
      calls
        .filter((call) => call.url.includes(needle))
        .map((call) => new URL(call.url).searchParams),
  };
}

export function TestProviders(props: {
  server: MockServer;
  locale?: string;
  children: ReactNode;
}): ReactElement {
  const runtime = createCategoriesRuntime({
    baseUrl: BASE,
    fetch: props.server.fetch,
  });
  const i18n: I18nEngine = createI18n({ locale: props.locale ?? "en" });
  registerCategoriesI18n(i18n);
  if (props.locale === "ru") registerCategoriesI18nRu(i18n);
  if (props.locale === "es") registerCategoriesI18nEs(i18n);
  const queryClient = new QueryClient({
    // No retries: a test asserting a refusal must see it on the first answer.
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <CategoriesProvider runtime={runtime}>{props.children}</CategoriesProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** One fresh in-memory store per test — see this file's header. */
export function testStore(): CatalogStore {
  return memoryCatalogStore();
}
