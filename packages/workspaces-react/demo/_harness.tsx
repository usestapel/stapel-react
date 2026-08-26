/**
 * Shared harness for the workspaces-react demos (frontend-guardrails §4.2) —
 * the PROVIDER FRAME and nothing else.
 *
 * Every story in this package renders a screen out of `src/default/`, so the
 * harness has no visual vocabulary of its own: no debug card, no `state.step`
 * chip, no row of naked buttons. What it wires is what a headless component
 * cannot run without — a query client, an i18n engine, and the workspaces
 * runtime over a canned `fetch` (no MSW worker needed), so a demo renders
 * identically in Ladle and in vitest. Themes are the viewer's job (data-theme
 * + tokens.css).
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { createWorkspacesRuntime } from "../src/index.js";
import { WorkspacesProvider, registerWorkspacesI18n } from "../src/index.js";

/** The base every mock handler mounts on (mirrors stapel-workspaces `/workspaces/api/`). */
export const DEMO_BASE = "https://workspaces.demo.stapel.dev/workspaces/api/";

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
 * Provider frame every workspaces demo variant renders inside. Builds a fresh mock
 * runtime + query client per mount so variants stay isolated.
 */
export function WorkspacesDemoHarness(props: {
  handlers?: DemoHandlers;
  children: ReactNode;
}): ReactElement {
  const { handlers } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createWorkspacesRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
    });
    const engine = createI18n({ locale: "en" });
    registerWorkspacesI18n(engine);
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
        <WorkspacesProvider runtime={runtime}>{props.children}</WorkspacesProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
