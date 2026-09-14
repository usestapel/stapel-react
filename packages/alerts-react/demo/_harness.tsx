/**
 * Shared harness for the alerts-react demos (frontend-guardrails §4.2). Demos
 * are first-class code — compiled, linted with the PRODUCT ruleset,
 * smoke-rendered — so this file obeys the same guardrails as `src/`: no raw
 * colours, no hardcoded user-facing text.
 *
 * The mock runtime injects a canned `fetch` (no MSW worker needed) so a demo
 * renders identically in Ladle (interactive) and in vitest (smoke). The token
 * layer is the viewer's (`data-theme` + tokens.css); this wires the providers
 * a demo needs: query client, i18n, and the alerts runtime.
 *
 * **The canned fetch answers with an `ETag`.** The two reads of this pair are
 * conditional, and a harness whose responses carried no validator would
 * document a version of the feed that re-downloads the board every minute —
 * exactly the behaviour the pair exists to avoid. It also honours
 * `If-None-Match` with a real 304, so the "up to date" line a demo shows is
 * the one a host gets.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import {
  AlertsProvider,
  createAlertsRuntime,
  registerAlertsI18n,
} from "../src/index.js";

/** The base every mock handler mounts on (mirrors `/alerts/api/v1/`). */
export const DEMO_BASE = "https://alerts.demo.stapel.dev/alerts/api/v1/";

/**
 * A handler map: path suffix → response. A plain value is a 200 JSON body; a
 * `[status, body]` tuple sets the HTTP status (so a demo can reach a refusal).
 */
export type DemoResponse = unknown | readonly [number, unknown];
export type DemoHandlers = Readonly<Record<string, DemoResponse>>;

function statusAndBody(value: DemoResponse): [number, unknown] {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
    return [value[0], value[1]];
  }
  return [200, value];
}

/** A stable validator for a body, so re-reads in a demo 304 like the real one. */
function etagOf(body: unknown): string {
  const text = JSON.stringify(body ?? null);
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return `"${(hash >>> 0).toString(16)}"`;
}

/** Build a canned `fetch` from a suffix→response map; unmatched paths 404. */
export function mockFetch(handlers: DemoHandlers): typeof globalThis.fetch {
  return ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    let matched: DemoResponse | undefined;
    for (const [suffix, value] of Object.entries(handlers)) {
      if (url.includes(suffix)) {
        matched = value;
        break;
      }
    }
    if (matched === undefined) {
      return Promise.resolve(
        new Response(JSON.stringify({ localizable_error: "error.404.not_found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        })
      );
    }
    const [status, body] = statusAndBody(matched);
    const etag = etagOf(body);
    const headers = new Headers(init?.headers);
    if (status === 200 && headers.get("If-None-Match") === etag) {
      return Promise.resolve(new Response(null, { status: 304, headers: { ETag: etag } }));
    }
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", ETag: etag },
      })
    );
  }) as typeof globalThis.fetch;
}

/**
 * Provider frame every alerts demo variant renders inside. Builds a fresh mock
 * runtime + query client per mount so variants stay isolated.
 *
 * The poll is OFF in demos (`pollIntervalMs: 0`): a story that re-asks every
 * minute would make the shot runner's screenshots a race, and the polling
 * behaviour is a hook contract proved in `test/issuesHook.test.tsx`, not
 * something a still picture can show.
 */
export function AlertsDemoHarness(props: {
  handlers?: DemoHandlers;
  children: ReactNode;
}): ReactElement {
  const { handlers } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const engine = createI18n({ locale: "en" });
    registerAlertsI18n(engine);
    return {
      runtime: createAlertsRuntime({
        baseUrl: DEMO_BASE,
        fetch: mockFetch(handlers ?? {}),
        pollIntervalMs: 0,
        commitRefUrl: (sha) => `https://example.invalid/commit/${sha}`,
      }),
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
      i18n: engine,
    };
  }, [handlers]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <AlertsProvider runtime={runtime}>
          <SkinTheme>{props.children}</SkinTheme>
        </AlertsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
