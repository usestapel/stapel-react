/**
 * Shared test harness: a CDN runtime over an injected `fetch`, wrapped in the
 * providers a hook or a skin needs.
 *
 * MOCK THE WIRE, NOT THE MODULE (CONTRIBUTING.md): every request goes through
 * the real `StapelClient`, the bodies are the real ones stapel-cdn sends, and
 * the multipart part is a real `FormData` the mock can inspect. Nothing here
 * hand-shapes a value the code under test would otherwise have derived — which
 * is the only way a test can disprove the assumption that would produce the
 * bug. In particular the SHA-256 is really computed: the dedup tests assert
 * the request COUNT, so a flow that only pretended to check would fail them.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { I18nEngine } from "@stapel/core";
import { CdnProvider, createCdnRuntime, registerCdnI18n } from "../src/index.js";
import type { CdnLimitsOverride, CdnVariantWaitOptions } from "../src/index.js";

export const BASE = "https://cdn.test/cdn/api/v1";

/** One recorded request. */
export interface RecordedCall {
  readonly url: string;
  readonly method: string;
  /** The `file` part of a multipart body, when there was one. */
  readonly file: File | null;
}

export interface HandlerResult {
  readonly status?: number;
  readonly body?: unknown;
}

export type Handler = (call: RecordedCall) => HandlerResult;

export interface MockServer {
  readonly fetch: typeof globalThis.fetch;
  readonly calls: RecordedCall[];
  /** How many requests hit a path containing `needle`. */
  count(needle: string): number;
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
    let file: File | null = null;
    if (typeof FormData !== "undefined" && init?.body instanceof FormData) {
      const part = init.body.get("file");
      file = part instanceof File ? part : null;
    }
    const call: RecordedCall = { url, method, file };
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
      JSON.stringify({ localizable_error: "error.404.not_found", error: "no route" }),
      { status: 404, headers: { "content-type": "application/json" } }
    );
  }) as typeof globalThis.fetch;

  return {
    fetch: fetchImpl,
    calls,
    count: (needle) => calls.filter((call) => call.url.includes(needle)).length,
  };
}

export interface HarnessOptions {
  readonly server: MockServer;
  readonly locale?: string;
  readonly limits?: CdnLimitsOverride;
  readonly variants?: CdnVariantWaitOptions;
}

export function createHarnessRuntime(
  options: HarnessOptions
): ReturnType<typeof createCdnRuntime> {
  return createCdnRuntime({
    baseUrl: BASE,
    fetch: options.server.fetch,
    // No waiting by default: a test that cares about the variant wait passes
    // its own budget and its own timer.
    variants: options.variants ?? { attempts: 0 },
    ...(options.limits !== undefined ? { limits: options.limits } : {}),
  });
}

/** Providers every test render needs. */
export function TestHarness(props: {
  server: MockServer;
  locale?: string;
  limits?: CdnLimitsOverride;
  variants?: CdnVariantWaitOptions;
  children: ReactNode;
}): ReactElement {
  const { server, locale, limits, variants } = props;
  const { runtime, i18n, queryClient } = useMemo(() => {
    const engine: I18nEngine = createI18n({ locale: locale ?? "en" });
    registerCdnI18n(engine);
    return {
      runtime: createHarnessRuntime({
        server,
        ...(limits !== undefined ? { limits } : {}),
        ...(variants !== undefined ? { variants } : {}),
      }),
      i18n: engine,
      queryClient: new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      }),
    };
  }, [server, locale, limits, variants]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <CdnProvider runtime={runtime}>{props.children}</CdnProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
