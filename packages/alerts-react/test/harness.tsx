/**
 * Shared test harness: an alerts runtime over an injected `fetch`, wrapped in
 * the providers a hook or a skin needs.
 *
 * MOCK THE WIRE, NOT THE MODULE (CONTRIBUTING.md): every request goes through
 * the real transport — the real `StapelClient` for the two writes, the pair's
 * real raw reader for the two conditional reads — and every response is a real
 * `Response` carrying the real body stapel-alerts sends: the PAGE envelope for
 * the list (not the bare array its schema declares), snake_case throughout, a
 * real `error.403.forbidden` envelope for the refusal most accounts get.
 *
 * **The server issues ETags and honours `If-None-Match`.** That is the whole
 * point of this harness rather than a simpler one: the behaviour under test is
 * "a re-read that comes back 304 keeps the rows already on screen", and a
 * server that never 304s cannot disprove anything about it.
 *
 * Routes are matched on `"<METHOD> <substring>"` or a bare substring, in
 * declaration order. The METHOD matters: `/issues/{id}` answers a GET and a
 * PATCH, and `/issues/{id}/fix` is a POST on a path that CONTAINS the detail's.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { I18nEngine } from "@stapel/core";
import {
  AlertsProvider,
  createAlertsRuntime,
  registerAlertsI18n,
} from "../src/index.js";
import { registerAlertsI18nRu } from "../src/i18n/ru.js";
import { registerAlertsI18nEs } from "../src/i18n/es.js";

export const BASE = "https://alerts.test/alerts/api/v1/";

/** One recorded request. */
export interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly body: string | undefined;
  readonly ifNoneMatch: string | null;
}

/** What a handler may return. */
export interface HandlerResult {
  readonly status?: number;
  readonly body?: unknown;
  /**
   * The validator this answer carries. Omitted, the server derives a stable
   * one from the body — which is what the real `views._etag` does (a hash of
   * the rendered body, so a status change moves it and a quiet minute does
   * not).
   */
  readonly etag?: string;
}

export type Handler = (call: RecordedCall) => HandlerResult;

export interface MockServer {
  readonly fetch: typeof globalThis.fetch;
  readonly calls: RecordedCall[];
  /** Requests that were answered 304 — the conditional reads that cost nothing. */
  readonly notModified: RecordedCall[];
}

/** A body-derived validator, mirroring the backend's hash-of-the-payload. */
function etagOf(body: unknown): string {
  const text = JSON.stringify(body ?? null);
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return `"${(hash >>> 0).toString(16)}"`;
}

export function mockServer(
  routes: Readonly<Record<string, Handler | HandlerResult>>
): MockServer {
  const calls: RecordedCall[] = [];
  const notModified: RecordedCall[] = [];
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
    const ifNoneMatch = new Headers(init?.headers).get("If-None-Match");
    const call: RecordedCall = { url, method, body, ifNoneMatch };
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
      const etag = result.etag ?? etagOf(result.body ?? {});
      if (status === 200 && ifNoneMatch !== null && ifNoneMatch === etag) {
        notModified.push(call);
        return new Response(null, { status: 304, headers: { ETag: etag } });
      }
      return new Response(JSON.stringify(result.body ?? {}), {
        status,
        headers: { "content-type": "application/json", ETag: etag },
      });
    }
    return new Response(
      JSON.stringify({ localizable_error: "error.404.not_found" }),
      { status: 404, headers: { "content-type": "application/json" } }
    );
  }) as typeof globalThis.fetch;

  return { fetch: fetchImpl, calls, notModified };
}

/** Signed in, not staff — the tracker wall every route can answer. */
export const STAFF_ONLY: HandlerResult = {
  status: 403,
  body: {
    localizable_error: "error.403.forbidden",
    error: "You do not have permission to perform this action",
    params: {},
  },
};

/** No session reached the tracker. */
export const UNAUTHORIZED: HandlerResult = {
  status: 401,
  body: {
    localizable_error: "error.401.unauthorized",
    error: "Authentication required",
    params: {},
  },
};

/** No issue with that id. */
export const ISSUE_NOT_FOUND: HandlerResult = {
  status: 404,
  body: {
    localizable_error: "error.404.alerts_issue_not_found",
    error: "Issue not found",
    params: {},
  },
};

/** The store, declining to be told what it observed. */
export const STATUS_NOT_SETTABLE: HandlerResult = {
  status: 400,
  body: {
    localizable_error: "error.400.alerts_status_not_settable",
    error: "Status regressed is set by the store from evidence",
    params: { status: "regressed" },
  },
};

/** Providers every test render needs. */
export function TestProviders(props: {
  server: MockServer;
  locale?: string;
  pollIntervalMs?: number;
  commitRefUrl?: (sha: string) => string;
  children: ReactNode;
}): ReactElement {
  const { server, locale, pollIntervalMs, commitRefUrl } = props;
  const { runtime, i18n, queryClient } = useMemo(() => {
    const engine: I18nEngine = createI18n({ locale: locale ?? "en" });
    registerAlertsI18n(engine);
    registerAlertsI18nRu(engine);
    registerAlertsI18nEs(engine);
    return {
      runtime: createAlertsRuntime({
        baseUrl: BASE,
        fetch: server.fetch,
        // Off unless a test asks: a poll inside a render test is a race with
        // the assertion, not a behaviour the DOM can show.
        pollIntervalMs: pollIntervalMs ?? 0,
        ...(commitRefUrl !== undefined ? { commitRefUrl } : {}),
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
  }, [server, locale, pollIntervalMs, commitRefUrl]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <AlertsProvider runtime={runtime}>{props.children}</AlertsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
