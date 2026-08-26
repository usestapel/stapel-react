/**
 * Shared harness for the forms-react demos (frontend-guardrails §4.2). Demos
 * are first-class code — compiled, linted with the PRODUCT ruleset,
 * smoke-rendered — so this file obeys the same guardrails as `src/`: no raw
 * colours (every colour a token), no hardcoded prose.
 *
 * Every demo here photographs a SHIPPED surface. The step-chip demos that
 * printed `state.step` beside a component name are gone: a gallery is what a
 * stakeholder judges the package on, and half of it was reading out internal
 * flow tokens next to the real screens that already cover the same components.
 *
 * The mock runtime injects a canned `fetch` (no MSW worker needed) so a demo
 * renders identically in Ladle (interactive) and in vitest (smoke). Themes are
 * the viewer's job (data-theme + tokens.css); this only wires the providers a
 * headless component needs: query client, i18n, and the forms runtime.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { createFormsRuntime } from "../src/index.js";
import { FormsProvider, registerFormsI18n } from "../src/index.js";

/** The base every mock handler mounts on (mirrors stapel-forms `/forms/api/v1/`). */
export const DEMO_BASE = "https://forms.demo.stapel.dev/forms/api/v1/";

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

/**
 * Build a canned `fetch` from a suffix→response map.
 *
 * An unmatched path is a **404**, not an empty 200. A silent `{}` is the worst
 * possible answer for a demo: the client parses it as a successful read, the
 * screen repaints as its own empty state (or throws spreading a non-array),
 * and the gallery photographs a failure that looks like a design. A 404 puts
 * the gap on screen as an error state with the path in it.
 */
export function mockFetch(handlers: DemoHandlers): typeof globalThis.fetch {
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    let matched: DemoResponse = [
      404,
      { code: "error.404.forms_demo_unhandled_path", detail: url },
    ];
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

/** i18n copy for the demo chrome — a `demo.*` (unmanaged) namespace, so the
 * i18n-key-exists lint treats it as app-local and never false-positives. */
const demoBundleEn: Record<string, string> = {
  "demo.action.start": "Start",
  "demo.action.submit": "Submit",
  "demo.action.reset": "Reset",
  "demo.label.step": "state.step",
};

/**
 * One pre-seeded read: a query key and the data the cache already holds for
 * it. Seeding matters for the SKIN demos: a story rendered statically (the
 * shot runner, `assertVariantsRenderDistinctly`, `renderToStaticMarkup`) never
 * gets to await a fetch, so an unseeded variant photographs its skeleton — and
 * every variant's skeleton is the same picture under three different names.
 */
export type DemoSeed = readonly [readonly unknown[], unknown];

/**
 * Provider frame every forms demo variant renders inside. Builds a fresh mock
 * runtime + query client per mount so variants stay isolated.
 */
export function FormsDemoHarness(props: {
  handlers?: DemoHandlers;
  /** Reads the cache already holds — see {@link DemoSeed}. */
  seed?: readonly DemoSeed[];
  /** The workspace the admin screens act in when a screen is not given one.
   * This is the ROUTABLE case: a nav-mounted screen has only the address. */
  workspaceId?: string;
  /** The caller's forms capabilities, as a host would hand them over. Omit
   * for the "nobody said" case, which gates nothing client-side. */
  capabilities?: readonly string[];
  children: ReactNode;
}): ReactElement {
  const { handlers, seed, workspaceId, capabilities } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createFormsRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
      ...(workspaceId !== undefined ? { workspaceId } : {}),
      ...(capabilities !== undefined ? { capabilities } : {}),
    });
    const engine = createI18n({ locale: "en" });
    registerFormsI18n(engine);
    engine.registerBundle("en", demoBundleEn);
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          // A SEEDED read is the story's subject, and the default staleTime of
          // 0 makes it stale the instant it is written: every seeded screen
          // refetched on mount and repainted itself with whatever the canned
          // fetch answered — an empty body for a path no handler claimed. That
          // is how `forms-list`, `responses` and `public-form` photographed a
          // blank page while their vitest static render was green (a static
          // render never awaits the refetch). The seed is the fixture; nothing
          // in the background may overwrite it.
          staleTime: Number.POSITIVE_INFINITY,
          refetchOnWindowFocus: false,
        },
      },
    });
    for (const [key, data] of seed ?? []) client.setQueryData(key, data);
    return { runtime: rt, queryClient: client, i18n: engine };
  }, [handlers, seed, workspaceId, capabilities]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <FormsProvider runtime={runtime}>{props.children}</FormsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/**
 * The frame a SKIN demo renders in: the shipped surface, on a page-width
 * column that is centred rather than pinned to the top-left of a 1280px shot
 * (visual class M-5). No card chrome — the skin paints its own surface.
 */
export function SkinFrame(props: {
  /** Cap the column so a desktop shot is a page, not a stretched phone. */
  maxWidth?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div
      style={{
        maxWidth: props.maxWidth ?? "56rem",
        margin: "0 auto",
        padding: spacing["4"],
      }}
    >
      {props.children}
    </div>
  );
}

