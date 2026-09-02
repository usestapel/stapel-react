/**
 * Shared harness for the docs-react demos (frontend-guardrails §4.2). Demos
 * are first-class code — compiled, linted with the PRODUCT ruleset, smoke-
 * rendered — so this file obeys the same guardrails as `src/`.
 *
 * Every demo renders the DEFAULT SKIN, not a debug card: a story that draws a
 * component's class name and a row of naked buttons documents the headless
 * twin, and the product is the skin (§83). The provider frame below is the
 * only thing this file adds — a canned `fetch` so a surface can be
 * photographed in a named state (populated / empty / failed / still loading)
 * without a server.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import {
  DocsProvider,
  createDocsRuntime,
  registerDocsI18n,
} from "../src/index.js";

/** The base every mock handler mounts on (mirrors `/docs/api/v1/`). */
export const DEMO_BASE = "https://docs.demo.stapel.dev/docs/api/v1/";

export type DemoResponse = unknown | readonly [number, unknown];
/** A handler is a JSON body, a `[status, body]` pair, or a raw `Response`
 * factory — the last one because the content routes answer BYTES plus the
 * `X-Docs-Head-Seq` header the save discipline reads, not JSON. */
export type DemoHandler = DemoResponse | (() => Response | Promise<Response>);
export type DemoHandlers = Readonly<Record<string, DemoHandler>>;

function statusAndBody(value: DemoResponse): [number, unknown] {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
    return [value[0], value[1]];
  }
  return [200, value];
}

/**
 * Build a canned `fetch` from a path-SUFFIX → response map. Suffix, not
 * substring: `/documents/d-1/content` contains `/documents/`, so a substring
 * router would answer a content read with the document list.
 *
 * A key may be prefixed with an HTTP METHOD (`"POST /links"`) — needed because
 * a share sheet's listing and its mint are the SAME path, and a demo that
 * cannot make one succeed while the other refuses cannot photograph a refused
 * mint at all. An unprefixed key still answers any method, so every existing
 * demo is untouched.
 */
export function mockFetch(handlers: DemoHandlers): typeof globalThis.fetch {
  const routes = Object.entries(handlers).map(([key, value]) => {
    const parts = /^([A-Z]+)\s+(.*)$/.exec(key);
    return {
      method: parts?.[1] ?? null,
      suffix: parts?.[2] ?? key,
      value,
    };
  });
  return ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const pathname = new URL(url, DEMO_BASE).pathname;
    const usable = routes.filter(
      (route) => route.method === null || route.method === method
    );
    const found =
      usable.find((route) => pathname.endsWith(route.suffix)) ??
      usable.find((route) => pathname.includes(route.suffix));
    const handler = found?.value;
    if (typeof handler === "function") {
      return Promise.resolve((handler as () => Response | Promise<Response>)());
    }
    const [status, body] = statusAndBody(handler ?? {});
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
    );
  }) as typeof globalThis.fetch;
}

/** A read that never settles — the honest shape of "still loading". */
export function neverSettles(): Promise<Response> {
  return new Promise<Response>(() => undefined);
}

/** Raw document bytes plus the head sequence a snapshot save sends back as
 * `If-Match` (the editors cannot be demoed without it). */
export function textBody(body: string, headSeq: number, mime = "text/plain") {
  return (): Response =>
    new Response(body, {
      status: 200,
      headers: { "content-type": mime, "X-Docs-Head-Seq": String(headSeq) },
    });
}

/** Provider frame every docs demo variant renders inside. */
export function DocsDemoHarness(props: {
  handlers?: DemoHandlers;
  locale?: string;
  children: ReactNode;
}): ReactElement {
  const { handlers, locale } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createDocsRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
    });
    const engine = createI18n({ locale: locale ?? "en" });
    registerDocsI18n(engine);
    return {
      runtime: rt,
      queryClient: new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      }),
      i18n: engine,
    };
  }, [handlers, locale]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <DocsProvider runtime={runtime}>{props.children}</DocsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
