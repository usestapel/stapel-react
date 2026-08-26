/**
 * Shared harness for the billing-react demos (frontend-guardrails §4.2). Demos
 * are first-class code — compiled, linted with the PRODUCT ruleset,
 * smoke-rendered — so this file obeys the same guardrails as `src/`.
 *
 * It is providers and a canned wire, and nothing else: every billing story
 * renders a real `src/default` surface, so there is no demo chrome to share.
 *
 * The mock runtime injects a canned `fetch` (no MSW worker needed) so a demo
 * renders identically in Ladle (interactive) and in vitest (smoke). Themes are
 * the viewer's job (data-theme + tokens.css); this only wires the providers a
 * headless component needs: query client, i18n, and the billing runtime.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { createBillingRuntime } from "../src/index.js";
import { BillingProvider, registerBillingI18n } from "../src/index.js";

/** The base every mock handler mounts on (mirrors stapel-billing `/billing/api/`). */
export const DEMO_BASE = "https://billing.demo.stapel.dev/billing/api/";

/**
 * A handler map: path suffix → response. A plain value is a 200 JSON body; a
 * `[status, body]` tuple sets the HTTP status (so a demo can reach an error
 * step).
 */
export type DemoResponse = unknown | readonly [number, unknown];
export type DemoHandlers = Readonly<Record<string, DemoResponse>>;

function statusAndBody(value: DemoResponse): [number, unknown] {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number"
  ) {
    return [value[0], value[1]];
  }
  return [200, value];
}

/** Build a canned `fetch` from a suffix→response map; unmatched paths return `{}`. */
export function mockFetch(handlers: DemoHandlers): typeof globalThis.fetch {
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    let matched: DemoResponse = {};
    for (const [suffix, value] of Object.entries(handlers)) {
      if (url.includes(suffix)) {
        matched = value;
        break;
      }
    }
    const [status, body] = statusAndBody(matched);
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
    );
  }) as typeof globalThis.fetch;
}

/**
 * Provider frame every billing demo variant renders inside. Builds a fresh mock
 * runtime + query client per mount so variants stay isolated.
 */
export function BillingDemoHarness(props: {
  handlers?: DemoHandlers;
  children: ReactNode;
}): ReactElement {
  const { handlers } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createBillingRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
    });
    const engine = createI18n({ locale: "en" });
    registerBillingI18n(engine);
    return {
      runtime: rt,
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
      i18n: engine,
    };
  }, [handlers]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <BillingProvider runtime={runtime}>{props.children}</BillingProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
