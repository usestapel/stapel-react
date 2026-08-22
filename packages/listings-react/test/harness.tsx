/**
 * Shared test harness: a listings runtime over an injected `fetch`, wrapped
 * in the providers a hook or a skin surface needs. Every request is recorded
 * — method, url AND body — so a test can assert on the WIRE.
 *
 * That last part is what most of this suite is about. "The composer saved"
 * is not the claim worth proving; "the composer sent `features_draft` tagged
 * with the types from the category schema, and `images_draft` in the gallery's
 * order" is, and it is only observable in the request body.
 *
 * `mockServer` routes on the pathname's SUFFIX, not on a substring:
 * `/listings/7/status/` contains `/listings/`, so a substring router would
 * answer a status probe with the card list and the test would pass against a
 * lie.
 */
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  I18nProvider,
  MandateProvider,
  createI18n,
  mandateAsking,
  mandateResolved,
  mandateUnavailable,
} from "@stapel/core";
import type { I18nEngine, MandatePrincipal, MandateState } from "@stapel/core";
import { registerAttributesI18n } from "@stapel/attributes-react";
import { registerAttributesI18nRu } from "@stapel/attributes-react/i18n/ru";
import { registerAttributesI18nEs } from "@stapel/attributes-react/i18n/es";
import type { StapelImage } from "@stapel/image";
import {
  ListingsProvider,
  createListingsRuntime,
  registerListingsI18n,
} from "../src/index.js";
import { registerListingsI18nRu } from "../src/i18n/ru.js";
import { registerListingsI18nEs } from "../src/i18n/es.js";

export const BASE = "https://listings.test/listings/api/v1/";

export interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

export interface HandlerResult {
  readonly status?: number;
  readonly body?: unknown;
}

export type Handler = (call: RecordedCall) => HandlerResult;

export interface MockServer {
  readonly fetch: typeof globalThis.fetch;
  readonly calls: RecordedCall[];
  /** Every call whose pathname ends with `suffix`, in order. */
  matching(suffix: string): readonly RecordedCall[];
  /** The body of the last call whose pathname ends with `suffix`. */
  lastBody(suffix: string): unknown;
}

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
    let body: unknown;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const call: RecordedCall = { url, method, body };
    calls.push(call);
    const pathname = new URL(url).pathname;

    const match =
      entries.find(([pattern]) => pathname.endsWith(pattern)) ??
      entries.find(([pattern]) => url.includes(pattern));
    if (match !== undefined) {
      const route = match[1];
      const result = typeof route === "function" ? route(call) : route;
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
    matching: (suffix) =>
      calls.filter((call) => new URL(call.url).pathname.endsWith(suffix)),
    lastBody: (suffix) => {
      const found = calls.filter((call) =>
        new URL(call.url).pathname.endsWith(suffix)
      );
      return found[found.length - 1]?.body;
    },
  };
}

/** A resolver that answers for any reference containing a slash — enough to
 * exercise the image path without pretending the pair can resolve one. */
export function testResolveImage(ref: string): StapelImage | undefined {
  if (!ref.includes("/")) return undefined;
  return {
    source: "cdn",
    url: `https://cdn.test/${ref}`,
    mime: "image/webp",
    width: 800,
    height: 600,
    aspect: 4 / 3,
    square: false,
    preview_b64: null,
    variants: [],
  };
}

export type TestMandate = MandatePrincipal | "asking" | "unavailable";

function mandateState(mandate: TestMandate): MandateState {
  if (mandate === "asking") return mandateAsking();
  if (mandate === "unavailable") return mandateUnavailable(new Error("no /me"));
  return mandateResolved(mandate);
}

export function TestProviders(props: {
  server: MockServer;
  locale?: string;
  mandate?: TestMandate;
  /** Off by default so a test can prove the "photos cannot be shown" branch. */
  resolveImage?: boolean;
  children: ReactNode;
}): ReactElement {
  const runtime = createListingsRuntime({
    baseUrl: BASE,
    fetch: props.server.fetch,
    ...(props.resolveImage === true ? { resolveImage: testResolveImage } : {}),
  });
  const i18n: I18nEngine = createI18n({ locale: props.locale ?? "en" });
  registerListingsI18n(i18n);
  registerAttributesI18n(i18n);
  if (props.locale === "ru") {
    registerListingsI18nRu(i18n);
    registerAttributesI18nRu(i18n);
  }
  if (props.locale === "es") {
    registerListingsI18nEs(i18n);
    registerAttributesI18nEs(i18n);
  }
  const queryClient = new QueryClient({
    // No retries: a test asserting a refusal must see it on the first answer.
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <MandateProvider source={{ state: mandateState(props.mandate ?? "member") }}>
          <ListingsProvider runtime={runtime}>{props.children}</ListingsProvider>
        </MandateProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
