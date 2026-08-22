/**
 * Shared test harness: a search runtime over an injected `fetch`, wrapped in
 * the providers a hook or a skin surface needs (query client, i18n, search
 * context, URL state). Every request is recorded so a test can assert on the
 * WIRE — repeated `f.<slug>` keys and the cursor are only observable there.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { I18nEngine } from "@stapel/core";
import {
  SearchProvider,
  SearchStateProvider,
  createSearchRuntime,
  registerSearchI18n,
} from "../src/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { registerSearchI18nRu } from "../src/i18n/ru.js";

export const BASE = "https://search.test/search/api/v1/";

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
  /** The query string of the last matching request, parsed. */
  lastQuery(needle: string): URLSearchParams | null;
}

/** Build a fetch over `substring → handler` routes, in declaration order. */
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
    calls.push({ url, method });

    for (const [pattern, route] of Object.entries(routes)) {
      if (!url.includes(pattern)) continue;
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
  };
}

/** A controllable in-memory URL adapter, so a test can read the query string
 * the pair wrote and assert Back-like behaviour without a router. */
export function useTestParams(initial: string): SearchParamsAdapter & {
  readonly search: string;
  readonly history: readonly string[];
} {
  const [history, setHistory] = useState<readonly string[]>([initial]);
  const search = history[history.length - 1] ?? "";
  return {
    search,
    history,
    params: new URLSearchParams(search),
    setParams: (next, options) => {
      const value = next.toString();
      setHistory((prev) =>
        options?.replace === true
          ? [...prev.slice(0, -1), value]
          : [...prev, value]
      );
    },
  };
}

export function TestProviders(props: {
  server: MockServer;
  locale?: string;
  children: ReactNode;
}): ReactElement {
  const runtime = createSearchRuntime({ baseUrl: BASE, fetch: props.server.fetch });
  const i18n: I18nEngine = createI18n({ locale: props.locale ?? "en" });
  registerSearchI18n(i18n);
  if (props.locale === "ru") registerSearchI18nRu(i18n);
  const queryClient = new QueryClient({
    // No retries: a test asserting a refusal must see it on the first answer.
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <SearchProvider runtime={runtime}>{props.children}</SearchProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** Providers + URL state, for a test that drives filters and paging. */
export function TestHarness(props: {
  server: MockServer;
  initialSearch?: string;
  locale?: string;
  defaultType?: string;
  onAdapter?: (adapter: { readonly search: string; readonly history: readonly string[] }) => void;
  children: ReactNode;
}): ReactElement {
  return (
    <TestProviders
      server={props.server}
      {...(props.locale !== undefined ? { locale: props.locale } : {})}
    >
      <StateFrame
        initialSearch={props.initialSearch ?? "type=listing"}
        defaultType={props.defaultType ?? "listing"}
        {...(props.onAdapter !== undefined ? { onAdapter: props.onAdapter } : {})}
      >
        {props.children}
      </StateFrame>
    </TestProviders>
  );
}

function StateFrame(props: {
  initialSearch: string;
  defaultType: string;
  onAdapter?: (adapter: { readonly search: string; readonly history: readonly string[] }) => void;
  children: ReactNode;
}): ReactElement {
  const adapter = useTestParams(props.initialSearch);
  props.onAdapter?.({ search: adapter.search, history: adapter.history });
  return (
    <SearchStateProvider adapter={adapter} defaultType={props.defaultType}>
      {props.children}
    </SearchStateProvider>
  );
}
