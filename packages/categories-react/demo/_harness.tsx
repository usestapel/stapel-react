/**
 * Shared harness for the categories-react demos (frontend-guardrails §4.2).
 * Demos are first-class code — compiled, linted with the PRODUCT ruleset,
 * smoke-rendered — so this file obeys the same guardrails as `src/`: no raw
 * colours (tokens via `cssVar()`) and no hardcoded prose (every label is a
 * key).
 *
 * The catalogue store is an IN-MEMORY one, deliberately. A demo must not write
 * into the viewer's `localStorage` and then serve a stale catalogue to the
 * next demo — and passing `memoryCatalogStore()` is also the documented way a
 * host opts out of persistence, so the demo shows the seam while using it.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import {
  CategoriesProvider,
  createCategoriesRuntime,
  memoryCatalogStore,
  registerCategoriesI18n,
} from "../src/index.js";
import type { CatalogStore } from "../src/index.js";

/** The base every mock handler mounts on (mirrors `/categories/api/v1/`). */
export const DEMO_BASE = "https://categories.demo.stapel.dev/categories/api/v1/";

export type DemoResponse = unknown | readonly [number, unknown];
export type DemoHandlers = Readonly<Record<string, DemoResponse>>;

function statusAndBody(value: DemoResponse): [number, unknown] {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
    return [value[0], value[1]];
  }
  return [200, value];
}

/** Build a canned `fetch` from a path-SUFFIX → response map. Suffix, not
 * substring: `/categories/1/features/` contains `/categories/`, so a
 * substring router would answer a feature request with the category list. */
export function mockFetch(handlers: DemoHandlers): typeof globalThis.fetch {
  const routes = Object.entries(handlers);
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const pathname = new URL(url).pathname;
    const found =
      routes.find(([suffix]) => pathname.endsWith(suffix)) ??
      routes.find(([suffix]) => url.includes(suffix));
    const matched: DemoResponse = found?.[1] ?? {};
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
 * `demo.*` is an UNMANAGED namespace, so `i18n-key-exists` treats these as
 * app-local and never false-positives on them.
 *
 * And this map is the pair's central claim, made visible: `demo.category.*`
 * are the CATEGORY NAMES arriving from the wire as translation keys. A host
 * supplies them; the library never could.
 */
const demoBundleEn: Record<string, string> = {
  "demo.category.electronics": "Electronics",
  "demo.category.phones": "Phones",
  "demo.category.laptops": "Laptops",
  "demo.category.used_phones": "Used phones",
  "demo.category.vehicles": "Vehicles",
  "demo.category.retired": "Retired (inactive)",
  "demo.category.gone": "Gone (deleted)",
  "demo.feature.brand": "Brand",
  "demo.feature.power": "Power",
  "demo.feature.holo": "Holographic signature",
  "demo.brand.bosch": "Bosch",
  "demo.brand.makita": "Makita",
  "demo.unit.watt": "W",
};

/** Provider frame every categories demo variant renders inside. */
export function CategoriesDemoHarness(props: {
  handlers?: DemoHandlers;
  children: ReactNode;
}): ReactElement {
  const { handlers } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createCategoriesRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
    });
    const engine = createI18n({ locale: "en" });
    registerCategoriesI18n(engine);
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
        <CategoriesProvider runtime={runtime}>{props.children}</CategoriesProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** One in-memory store per demo render — see this file's header. */
export function useDemoStore(): CatalogStore {
  return useMemo(() => memoryCatalogStore(), []);
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
