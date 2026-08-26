/**
 * Shared test harness: a forms runtime over an injected `fetch`, wrapped in
 * the providers a hook or a skin surface needs (query client, i18n, forms
 * context). Mirrors the demo harness, but records every request so a test can
 * assert on the WIRE — the CSV cursor and the submit body are only observable
 * there.
 */
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import {
  FormsProvider,
  createFormsRuntime,
  registerFormsI18n,
} from "../src/index.js";

export const BASE = "https://forms.test/forms/api/v1/";

/** One recorded request. */
export interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

/** What a handler may return: a JSON body, or a full response spec. */
export interface HandlerResult {
  readonly status?: number;
  readonly body?: unknown;
  /** Raw text body (the CSV export path). */
  readonly text?: string;
  readonly headers?: Record<string, string>;
}

export type Handler = (call: RecordedCall) => HandlerResult;

export interface MockServer {
  readonly fetch: typeof globalThis.fetch;
  readonly calls: RecordedCall[];
}

/**
 * Build a fetch over `substring → handler` routes. Routes are tried in
 * declaration order and matched on `"<METHOD> <substring>"` or just the
 * substring, so a GET and a POST on the same path can differ.
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
      const hasMethod =
        rest.length > 0 && /^[A-Z]+$/.test(maybeMethod ?? "");
      const needle = hasMethod ? rest.join(" ") : pattern;
      if (hasMethod && maybeMethod !== method) continue;
      if (!url.includes(needle)) continue;

      const result = typeof route === "function" ? route(call) : route;
      const status = result.status ?? 200;
      const headers: Record<string, string> = { ...(result.headers ?? {}) };
      if (headers["content-type"] === undefined) {
        headers["content-type"] =
          result.text !== undefined ? "text/csv" : "application/json";
      }
      // 204/205 are null-body statuses: the Response constructor THROWS if
      // given one, and a mock that throws here looks exactly like a failed
      // request to the code under test (which is how a passing delete first
      // read as a refusal).
      const nullBody = status === 204 || status === 205;
      const payload = nullBody
        ? null
        : result.text !== undefined
          ? result.text
          : JSON.stringify(result.body ?? {});
      return new Response(payload, { status, headers });
    }
    return new Response("{}", {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;

  return { fetch: fetchImpl, calls };
}

/** Providers every test render needs. */
export function TestHarness(props: {
  server: MockServer;
  locale?: string;
  /** The runtime's default workspace — the ROUTABLE case, where a screen is
   * mounted from a nav manifest with nothing but the address. */
  workspaceId?: string;
  /** The caller's forms capabilities, as a host declares them. OMITTING this
   * is the third answer ("nobody said"), not an empty grant list. */
  capabilities?: readonly string[];
  children: ReactNode;
}): ReactElement {
  const runtime = createFormsRuntime({
    baseUrl: BASE,
    fetch: props.server.fetch,
    ...(props.workspaceId !== undefined
      ? { workspaceId: props.workspaceId }
      : {}),
    ...(props.capabilities !== undefined
      ? { capabilities: props.capabilities }
      : {}),
  });
  const i18n = createI18n({ locale: props.locale ?? "en" });
  registerFormsI18n(i18n);
  const queryClient = new QueryClient({
    // No retries: a test asserting a refusal must see it on the first answer,
    // not three timeouts later.
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <FormsProvider runtime={runtime}>{props.children}</FormsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
