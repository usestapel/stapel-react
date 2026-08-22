/**
 * Shared harness for the search-react demos (frontend-guardrails §4.2). Demos
 * are first-class code — compiled, linted with the PRODUCT ruleset,
 * smoke-rendered — so this file obeys the same guardrails as `src/`: no raw
 * colours (tokens via `cssVar()`), no hardcoded prose (every label is a key),
 * and the one clickable declares why it tracks nothing.
 *
 * The URL adapter is an IN-MEMORY one, which is also the point: a demo shows
 * that the pair's state layer needs no router at all — `SearchParamsAdapter`
 * is two members, and react-router's binding (`./router`) is one of several
 * possible implementations rather than a dependency.
 */
import { useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n, useT } from "@stapel/core";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import {
  SearchProvider,
  SearchStateProvider,
  createSearchRuntime,
  registerSearchI18n,
} from "../src/index.js";
import type { SearchParamsAdapter } from "../src/index.js";
import { DEMO_TYPE } from "./fixtures.js";

/** The base every mock handler mounts on (mirrors `/search/api/v1/`). */
export const DEMO_BASE = "https://search.demo.stapel.dev/search/api/v1/";

export type DemoResponse = unknown | readonly [number, unknown];
export type DemoHandlers = Readonly<Record<string, DemoResponse>>;

function statusAndBody(value: DemoResponse): [number, unknown] {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
    return [value[0], value[1]];
  }
  return [200, value];
}

/** Build a canned `fetch` from a suffix→response map. */
export function mockFetch(handlers: DemoHandlers): typeof globalThis.fetch {
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
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

/** `demo.*` is an UNMANAGED namespace, so `i18n-key-exists` treats these as
 * app-local and never false-positives on them. */
const demoBundleEn: Record<string, string> = {
  "demo.label.url": "URL",
  "demo.action.reset": "Reset",
  "demo.feature.brand": "Brand",
  "demo.feature.condition": "Condition",
  "demo.brand.bosch": "Bosch",
  "demo.brand.makita": "Makita",
  "demo.brand.interskol": "Interskol",
  "demo.condition.new": "New",
  "demo.condition.used": "Used",
  "search.scorer.relevance": "Text relevance",
  "search.scorer.geo": "Distance",
};

/** An in-memory {@link SearchParamsAdapter} — no router, no history. */
export function useMemoryParams(initial = ""): SearchParamsAdapter & {
  readonly search: string;
} {
  const [search, setSearch] = useState(initial);
  return useMemo(
    () => ({
      search,
      params: new URLSearchParams(search),
      setParams: (next: URLSearchParams) => {
        setSearch(next.toString());
      },
    }),
    [search]
  );
}

/** Provider frame every search demo variant renders inside. */
export function SearchDemoHarness(props: {
  handlers?: DemoHandlers;
  children: ReactNode;
}): ReactElement {
  const { handlers } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createSearchRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
    });
    const engine = createI18n({ locale: "en" });
    registerSearchI18n(engine);
    engine.registerBundle("en", demoBundleEn);
    return {
      runtime: rt,
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      i18n: engine,
    };
  }, [handlers]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <SearchProvider runtime={runtime}>{props.children}</SearchProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** The frame plus the URL state, with the live query string on show — the
 * demo of "the URL is the state" is the URL being visible while you click. */
export function SearchStateDemoHarness(props: {
  handlers?: DemoHandlers;
  initialSearch?: string;
  children: ReactNode;
}): ReactElement {
  const adapter = useMemoryParams(props.initialSearch ?? `type=${DEMO_TYPE}`);
  return (
    <SearchDemoHarness {...(props.handlers ? { handlers: props.handlers } : {})}>
      <SearchStateProvider adapter={adapter} defaultType={DEMO_TYPE}>
        <div style={cardStyle} data-theme-surface>
          <UrlLine search={adapter.search} />
          {props.children}
        </div>
      </SearchStateProvider>
    </SearchDemoHarness>
  );
}

const cardStyle: CSSProperties = {
  background: cssVar("surface-raised"),
  color: cssVar("text"),
  border: `1px solid ${cssVar("border")}`,
  borderRadius: radii.lg,
  padding: spacing["5"],
  display: "flex",
  flexDirection: "column",
  gap: spacing["3"],
  fontSize: fontSize.md.fontSize,
};

function UrlLine(props: { search: string }): ReactElement {
  const t = useT();
  return (
    <div style={{ display: "flex", gap: spacing["2"], alignItems: "baseline" }}>
      <span style={{ color: cssVar("text-muted") }}>{t("demo.label.url")}</span>
      <code
        data-testid="demo-url"
        style={{
          background: cssVar("surface-sunken"),
          color: cssVar("brand"),
          borderRadius: radii.sm,
          padding: `${spacing["1"]}px ${spacing["2"]}px`,
          wordBreak: "break-all",
        }}
      >
        {`?${props.search}`}
      </code>
    </div>
  );
}

/** A titled card wrapper for a demo body. */
export function DemoCard(props: {
  heading: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <div style={cardStyle} data-theme-surface>
      <strong style={{ fontSize: fontSize.lg.fontSize }}>{props.heading}</strong>
      {props.children}
    </div>
  );
}

/** Renders a technical token (a load status, a count), never user prose. */
export function StepBadge(props: { step: string }): ReactElement {
  return (
    <code
      style={{
        background: cssVar("surface-sunken"),
        color: cssVar("brand"),
        borderRadius: radii.sm,
        padding: `${spacing["1"]}px ${spacing["2"]}px`,
      }}
    >
      {props.step}
    </code>
  );
}
