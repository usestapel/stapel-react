/**
 * Shared harness for the listings-react demos (frontend-guardrails §4.2).
 * Demos are first-class code — compiled, linted with the PRODUCT ruleset,
 * smoke-rendered — so this file obeys the same guardrails as `src/`: no raw
 * colours (tokens via `cssVar()`) and no hardcoded prose in product surfaces.
 *
 * The runtime carries a `resolveImage` that answers with a tiny inline SVG
 * data URI. That is not decoration: the pair CANNOT resolve a stored CDN
 * reference on its own (no contract in this fleet does — `model/runtime.ts`),
 * so the seam is the thing worth showing, and a demo that left it unwired
 * would only ever render the "photo unavailable" branch.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  I18nProvider,
  MandateProvider,
  createI18n,
  mandateResolved,
} from "@stapel/core";
import type { MandatePrincipal } from "@stapel/core";
import { cssVar, radii, spacing, fontSize } from "@stapel/tokens";
import { registerAttributesI18n } from "@stapel/attributes-react";
import type { StapelImage } from "@stapel/image";
import {
  ListingsProvider,
  createListingsRuntime,
  registerListingsI18n,
} from "../src/index.js";

/** The base every mock handler mounts on (mirrors `/listings/api/v1/`). */
export const DEMO_BASE = "https://listings.demo.stapel.dev/listings/api/v1/";

export type DemoResponse = unknown | readonly [number, unknown];
export type DemoHandlers = Readonly<Record<string, DemoResponse>>;

function statusAndBody(value: DemoResponse): [number, unknown] {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
    return [value[0], value[1]];
  }
  return [200, value];
}

/** Build a canned `fetch` from a path-SUFFIX → response map. Suffix, not
 * substring: `/listings/7/status/` contains `/listings/`, so a substring
 * router would answer a status probe with the card list. */
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

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">' +
      '<rect width="320" height="240" fill="#d9d9d9"/></svg>'
  );

/** The seam a deployment fills in: reference → renderable image. */
export function demoResolveImage(ref: string): StapelImage | undefined {
  if (!ref.includes("/")) return undefined;
  return {
    source: "cdn",
    url: PLACEHOLDER,
    mime: "image/svg+xml",
    width: 320,
    height: 240,
    aspect: 320 / 240,
    square: false,
    preview_b64: null,
    variants: [],
  };
}

/**
 * `demo.*` is an UNMANAGED namespace, so `i18n-key-exists` treats these as
 * app-local and never false-positives on them. The feature NAMES here are the
 * point being made twice over: a feature's name arrives from the wire as a
 * translation key, and a deployment's bundle is where its copy belongs.
 */
const demoBundleEn: Record<string, string> = {
  "demo.feature.brand": "Brand",
  "demo.feature.power": "Power",
  "demo.feature.condition": "Condition",
  "demo.brand.bosch": "Bosch",
  "demo.condition.used": "Used",
};

/** Provider frame every listings demo variant renders inside. */
export function ListingsDemoHarness(props: {
  handlers?: DemoHandlers;
  /** Which principal the demo is showing. `anonymous` is what makes the
   * blocked-with-a-reason controls visible, so it is a first-class knob. */
  principal?: MandatePrincipal;
  children: ReactNode;
}): ReactElement {
  const { handlers, principal } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const rt = createListingsRuntime({
      baseUrl: DEMO_BASE,
      fetch: mockFetch(handlers ?? {}),
      resolveImage: demoResolveImage,
    });
    const engine = createI18n({ locale: "en" });
    registerListingsI18n(engine);
    registerAttributesI18n(engine);
    engine.registerBundle("en", demoBundleEn);
    return {
      runtime: rt,
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
      i18n: engine,
    };
  }, [handlers]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <MandateProvider source={{ state: mandateResolved(principal ?? "member") }}>
          <ListingsProvider runtime={runtime}>{props.children}</ListingsProvider>
        </MandateProvider>
      </I18nProvider>
    </QueryClientProvider>
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

/** A small monospace chip for a stage / status value. */
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
