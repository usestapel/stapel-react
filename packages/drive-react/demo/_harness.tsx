/**
 * Shared harness for the drive-react demos (frontend-guardrails §4.2). Demos
 * are first-class code — compiled, linted with the PRODUCT ruleset, smoke-
 * rendered — so this file obeys the same guardrails as `src/`.
 *
 * Every demo renders the DEFAULT SKIN, not a debug card: the product IS the
 * skin (§83). What this file adds is the provider frame plus a canned `fetch`,
 * so a surface can be photographed in a named state (populated / empty /
 * failed / still loading) without a server.
 *
 * BOTH providers, in the order a host mounts them: the drive composes the docs
 * pair, so `<DriveProvider>` sits inside `<DocsProvider>` and the two runtimes
 * share one base URL — these are one module's endpoints.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { DocsProvider, createDocsRuntime, registerDocsI18n } from "@stapel/docs-react";
import { DriveProvider, createDriveRuntime, registerDriveI18n } from "../src/index.js";
import type { UploadItem, UploadTrayBag } from "../src/index.js";

/** The base every mock handler mounts on (mirrors `/docs/api/v1/`). */
export const DEMO_BASE = "https://drive.demo.stapel.dev/docs/api/v1/";

export type DemoResponse = unknown | readonly [number, unknown];
/** A handler is a JSON body, a `[status, body]` pair, or a raw `Response`
 * factory — the last one because the thumbnail route answers BYTES. */
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
 * substring: `/documents/d-1/thumbnail` contains `/documents/`, so a substring
 * router would answer a preview with the document list.
 *
 * A key may be prefixed with an HTTP METHOD (`"POST /links"`) — the share
 * sheet's listing and its mint are the SAME path, and a demo that cannot make
 * one succeed while the other refuses cannot photograph a refused mint at all.
 * An unprefixed key still answers any method.
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
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
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

/**
 * A queue frozen at a named moment, for the tray demos.
 *
 * The real queue is driven by an XHR against an object store; a demo has
 * neither, and a bar that moves because a timer moved it would be documenting
 * an animation rather than the machine. So the tray is handed the same
 * `UploadTrayBag` shape the machine produces, seeded at the state being shown
 * — which is exactly what `DriveScreen`'s `uploads` prop takes from a host
 * with a shared queue.
 */
export function frozenQueue(items: readonly UploadItem[]): UploadTrayBag {
  return {
    items,
    add: () => undefined,
    retry: () => undefined,
    cancel: () => undefined,
    clearFinished: () => undefined,
    isUploading: items.some(
      (item) => item.status === "uploading" || item.status === "queued"
    ),
    quotaExceeded: items.some((item) => item.quotaExceeded),
  };
}

/** One tray row, at whatever moment the demo needs. */
export function uploadItem(patch: Partial<UploadItem> & { id: string }): UploadItem {
  return {
    name: "Warehouse.jpg",
    size: 2_400_000,
    status: "queued",
    loaded: 0,
    progress: 0,
    error: null,
    quotaExceeded: false,
    documentId: null,
    ...patch,
  };
}

/** Provider frame every drive demo variant renders inside. */
export function DriveDemoHarness(props: {
  handlers?: DemoHandlers;
  locale?: string;
  children: ReactNode;
}): ReactElement {
  const { handlers, locale } = props;
  const { docsRuntime, driveRuntime, queryClient, i18n } = useMemo(() => {
    const fetchImpl = mockFetch(handlers ?? {});
    const engine = createI18n({ locale: locale ?? "en" });
    registerDocsI18n(engine);
    registerDriveI18n(engine);
    return {
      docsRuntime: createDocsRuntime({ baseUrl: DEMO_BASE, fetch: fetchImpl }),
      driveRuntime: createDriveRuntime({ baseUrl: DEMO_BASE, fetch: fetchImpl }),
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
        <DocsProvider runtime={docsRuntime}>
          <DriveProvider runtime={driveRuntime}>{props.children}</DriveProvider>
        </DocsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
