/**
 * Test wiring for drive-react.
 *
 * MOCK THE WIRE, NOT THE MODULE (CONTRIBUTING, "Mock the wire, not the
 * module"). Every helper here stubs `fetch` and returns a REAL `Response`, so
 * the value a hook or a component ends up holding was produced by the real
 * transport out of a real body — not hand-shaped by the same author who wrote
 * the code under test. Nothing in this suite calls `vi.mock` on an api module.
 */
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import {
  DocsProvider,
  createDocsRuntime,
  registerDocsI18n,
} from "@stapel/docs-react";
import {
  DriveProvider,
  createDriveRuntime,
  registerDriveI18n,
} from "../src/index.js";

export const BASE = "https://drive.test.stapel.dev/docs/api/v1/";
export const WORKSPACE_ID = "ws-test";

/** One recorded request — what the wire actually saw. */
export interface RecordedCall {
  readonly method: string;
  readonly url: string;
  readonly pathname: string;
  readonly search: string;
  /** The request body as sent, for a write. `null` for a read. Recorded so a
   * test can assert what the wire SAW rather than what a component meant — a
   * level picked in a select and never put on the request is exactly the bug
   * a rendering assertion cannot see. */
  readonly body: string | null;
}

export interface WireStub {
  readonly fetch: typeof globalThis.fetch;
  readonly calls: RecordedCall[];
}

export type RouteAnswer =
  | { readonly status?: number; readonly body?: unknown }
  | (() => Response | Promise<Response>);

/**
 * A `fetch` that answers by path SUFFIX and records every call.
 *
 * Suffix, not substring: `/documents/d-1/star` contains `/documents/`, and a
 * substring router would answer a star with the document list.
 *
 * A key may be prefixed with an HTTP METHOD (`"POST /links"`). The share
 * sheet's listing and its mint are the SAME path, so without this a test
 * could not make the listing succeed while the mint is refused — which is
 * exactly the state the sheet's most interesting branch renders. An
 * unprefixed key still answers any method.
 */
export function wire(routes: Readonly<Record<string, RouteAnswer>>): WireStub {
  const calls: RecordedCall[] = [];
  const entries = Object.entries(routes).map(([key, answer]) => {
    const parts = /^([A-Z]+)\s+(.*)$/.exec(key);
    return {
      method: parts?.[1] ?? null,
      suffix: parts?.[2] ?? key,
      answer,
    };
  });
  const impl = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const parsed = new URL(url, BASE);
    calls.push({
      method: init?.method ?? "GET",
      url,
      pathname: parsed.pathname,
      search: parsed.search,
      body: typeof init?.body === "string" ? init.body : null,
    });
    const method = (init?.method ?? "GET").toUpperCase();
    const usable = entries.filter(
      (entry) => entry.method === null || entry.method === method
    );
    const found =
      usable.find((entry) => parsed.pathname.endsWith(entry.suffix)) ??
      usable.find((entry) => parsed.pathname.includes(entry.suffix));
    const answer = found?.answer;
    if (typeof answer === "function") return Promise.resolve(answer());
    const status = answer?.status ?? 200;
    if (status === 204) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.resolve(
      new Response(JSON.stringify(answer?.body ?? {}), {
        status,
        headers: { "content-type": "application/json" },
      })
    );
  }) as typeof globalThis.fetch;
  return { fetch: impl, calls };
}

export interface Harness {
  readonly wrapper: (props: { children: ReactNode }) => ReactElement;
  readonly queryClient: QueryClient;
}

/** Both providers, in the order a host mounts them, over one stubbed wire. */
export function harness(stub: WireStub, locale: "en" | "ru" | "es" = "en"): Harness {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const docsRuntime = createDocsRuntime({ baseUrl: BASE, fetch: stub.fetch });
  const driveRuntime = createDriveRuntime({ baseUrl: BASE, fetch: stub.fetch });
  const i18n = createI18n({ locale });
  registerDocsI18n(i18n);
  registerDriveI18n(i18n);

  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <DocsProvider runtime={docsRuntime}>
          <DriveProvider runtime={driveRuntime}>{children}</DriveProvider>
        </DocsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
  return { wrapper, queryClient };
}
