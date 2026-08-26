/**
 * Shared test harness: a moderation runtime over an injected `fetch`, wrapped in
 * the providers a hook or a skin needs.
 *
 * MOCK THE WIRE, NOT THE MODULE (CONTRIBUTING.md): every request goes through
 * the real `StapelClient`, every response is a real `Response` carrying the real
 * body stapel-moderation sends — the presenters' snake_case, the error envelope
 * core's dialect actually parses. The bodies come from `demo/_fixtures.ts`, the
 * SAME ones the stories render, so a screen cannot pass its test against a
 * shape the viewer never shows.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { I18nEngine } from "@stapel/core";
import {
  ModerationProvider,
  createModerationRuntime,
  registerModerationI18n,
} from "../src/index.js";

export const BASE = "https://moderation.test/moderation/api/v1";

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

/**
 * Build a fetch over `substring → handler` routes, tried in DECLARATION ORDER
 * and matched on `"<METHOD> <substring>"` or just the substring.
 *
 * Order is load-bearing in this module more than most: `/cases/{id}` contains
 * `/cases`, and `/appeals/queue` contains `/appeals/`, so a map that listed the
 * list route first would answer a detail read with a page of rows.
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
      return new Response(JSON.stringify(result.body ?? {}), {
        status: result.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ localizable_error: "error.404.not_found", params: {} }),
      { status: 404, headers: { "content-type": "application/json" } }
    );
  }) as typeof globalThis.fetch;

  return { fetch: fetchImpl, calls };
}

/** An error envelope in core's dialect — the shape `refusals.ts` reads. */
export const envelope = (status: number, code: string): HandlerResult => ({
  status,
  body: { localizable_error: code, error: code, params: {} },
});

/** Providers every test render needs. */
export function TestProviders(props: {
  server: MockServer;
  locale?: string;
  children: ReactNode;
}): ReactElement {
  const { server, locale } = props;
  const { runtime, i18n, queryClient } = useMemo(() => {
    const engine: I18nEngine = createI18n({ locale: locale ?? "en" });
    registerModerationI18n(engine);
    return {
      runtime: createModerationRuntime({ baseUrl: BASE, fetch: server.fetch }),
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
        <ModerationProvider runtime={runtime}>{props.children}</ModerationProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** jsdom's window has a fixed width; the skin's sheet/table rules read it. */
export function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
}

export const JSDOM_DEFAULT_WIDTH = 1024;
