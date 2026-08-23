/**
 * Shared test harness: a gdpr runtime over an injected `fetch`, wrapped in the
 * providers a hook or a skin needs.
 *
 * MOCK THE WIRE, NOT THE MODULE (CONTRIBUTING.md): every request goes through
 * the real `StapelClient`, every response is a real `Response` carrying the
 * real body stapel-gdpr sends — a `ClosureStatusDTO` with the field names and
 * the snake_case the schema declares, an `error.404.gdpr.no_active_closure`
 * envelope for the refusal that means "you are fine". Nothing here hand-shapes
 * a value the code under test would otherwise have derived, and no test
 * asserts against a fixture the source could not have produced.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { I18nEngine } from "@stapel/core";
import {
  GdprProvider,
  createGdprRuntime,
  registerGdprI18n,
} from "../src/index.js";
import { registerGdprI18nRu } from "../src/i18n/ru.js";

export const BASE = "https://gdpr.test/gdpr/api/v1";

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
  /** Response headers — the download surface reads `Content-Disposition`. */
  readonly headers?: Record<string, string>;
}

export type Handler = (call: RecordedCall) => HandlerResult;

export interface MockServer {
  readonly fetch: typeof globalThis.fetch;
  readonly calls: RecordedCall[];
}

/**
 * Build a fetch over `substring → handler` routes, tried in declaration order
 * and matched on `"<METHOD> <substring>"` or just the substring. The whole URL
 * is matched, and the METHOD matters here more than in most pairs: this module
 * mounts a GET and a POST on the same `/dsar` path, and `/erasures` is a POST
 * that opens one and a GET that reads one.
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
      const status = result.status ?? 200;
      return new Response(JSON.stringify(result.body ?? {}), {
        status,
        headers: { "content-type": "application/json", ...(result.headers ?? {}) },
      });
    }
    return new Response(
      JSON.stringify({ localizable_error: "error.404.not_found" }),
      { status: 404, headers: { "content-type": "application/json" } }
    );
  }) as typeof globalThis.fetch;

  return { fetch: fetchImpl, calls };
}

/** The 404 that means "your account is not being deleted". */
export const NO_ACTIVE_CLOSURE: HandlerResult = {
  status: 404,
  body: {
    localizable_error: "error.404.gdpr.no_active_closure",
    error: "No pending account closure found.",
    params: {},
  },
};

/** The 404 that means "you have never asked for an archive". */
export const EXPORT_NOT_FOUND: HandlerResult = {
  status: 404,
  body: {
    localizable_error: "error.404.gdpr.export_not_found",
    error: "Export request not found.",
    params: {},
  },
};

/** A closure already exists — a no-op, not a failure. */
export const CLOSURE_ALREADY_PENDING: HandlerResult = {
  status: 409,
  body: {
    localizable_error: "error.409.gdpr.closure_already_pending",
    error: "Account closure is already in progress.",
    params: {},
  },
};

/** The OTHER 409: we may not delete this at all yet. */
export const LEGAL_HOLD: HandlerResult = {
  status: 409,
  body: {
    localizable_error: "error.409.gdpr.legal_hold",
    error: "Account data is under a legal hold and cannot be deleted.",
    params: {},
  },
};

/** One export per 30 days. */
export const EXPORT_COOLDOWN: HandlerResult = {
  status: 409,
  body: {
    localizable_error: "error.409.gdpr.export_cooldown",
    error: "A data export was already requested in the last 30 days.",
    params: {},
  },
};

/** The first 410: the single-use token was already spent. */
export const DOWNLOAD_CONSUMED: HandlerResult = {
  status: 410,
  body: {
    localizable_error: "error.410.gdpr.download_consumed",
    error: "Download link was already used. Request a new export.",
    params: {},
  },
};

/** The second 410 — same status, opposite advice. */
export const DOWNLOAD_EXPIRED: HandlerResult = {
  status: 410,
  body: {
    localizable_error: "error.410.gdpr.download_expired",
    error: "Download link has expired.",
    params: {},
  },
};

/** The host's `ERASURE_AUTHORIZER` refused (default: staff only). */
export const ERASURE_FORBIDDEN: HandlerResult = {
  status: 403,
  body: {
    localizable_error: "error.403.gdpr.erasure_forbidden",
    error: "You are not allowed to request erasure of this item.",
    params: {},
  },
};

/** A subject type outside `STAPEL_GDPR["SUBJECT_TYPES"]`. */
export const UNKNOWN_SUBJECT_TYPE: HandlerResult = {
  status: 400,
  body: {
    localizable_error: "error.400.gdpr.unknown_subject_type",
    error: "This kind of data cannot be erased through this endpoint.",
    params: {},
  },
};

/** The staff-only reads, refused for an ordinary member. */
export const STAFF_ONLY: HandlerResult = {
  status: 403,
  body: {
    localizable_error: "error.403.forbidden",
    error: "You do not have permission to perform this action",
    params: {},
  },
};

/** The anonymous form's captcha was rejected. */
export const CAPTCHA_INVALID: HandlerResult = {
  status: 400,
  body: {
    localizable_error: "error.400.captcha_invalid",
    error: "Captcha verification failed. Please try again.",
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
    registerGdprI18n(engine);
    registerGdprI18nRu(engine);
    return {
      runtime: createGdprRuntime({ baseUrl: BASE, fetch: server.fetch }),
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
        <GdprProvider runtime={runtime}>{props.children}</GdprProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
