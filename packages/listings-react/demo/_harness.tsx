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
/** A handler may be a body, a `[status, body]` pair, or a function of the
 * full URL — the last one because one PATH can answer two questions:
 * `my/listings/?status=blocked` is the takedown check and `my/listings/` with
 * a tab's statuses is the dashboard, and a demo that answered both with the
 * same body would show a live listing as taken down. */
export type DemoHandler = DemoResponse | ((url: string) => DemoResponse);
export type DemoHandlers = Readonly<Record<string, DemoHandler>>;

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
    const handler: DemoHandler = found?.[1] ?? {};
    const matched: DemoResponse =
      typeof handler === "function"
        ? (handler as (u: string) => DemoResponse)(url)
        : handler;
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
 * A stand-in PHOTO, not a stand-in for a photo.
 *
 * It was a flat `#d9d9d9` rectangle, and the visual pass read it exactly as a
 * viewer does: a broken image. This is a photograph-shaped thing — a sky
 * gradient over a horizon — so a card demo shows a card with a picture in it
 * and the reviewer's eye goes to the layout instead of to the grey slab. It is
 * demo CONTENT and carries its own colours for that reason; the skin around it
 * still owns not one hex (`no-raw-colors` covers `src/`).
 */
const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">' +
      '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#7f9bb5"/>' +
      '<stop offset="100%" stop-color="#cfd9e2"/></linearGradient></defs>' +
      '<rect width="320" height="240" fill="url(#s)"/>' +
      '<rect y="168" width="320" height="72" fill="#6f7d67"/>' +
      '<circle cx="248" cy="56" r="26" fill="#f2e6c2"/>' +
      '<path d="M0 168 L96 104 L168 168 Z" fill="#55604f"/>' +
      "</svg>"
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
 * app-local and never false-positives on them.
 *
 * These are OPTION labels, and the point they make is the one that survives
 * review: a translatable catalogue stores the option's KEY as the value, the
 * deployment's bundle carries its copy, and the pair resolves the two
 * (`model/features.ts` synthesizes the identity option table a stored DAO does
 * not carry). Every key registered here therefore reaches the screen as a
 * word — a demo that photographs `demo.condition.used` is documenting a bug.
 */
const demoBundleEn: Record<string, string> = {
  "demo.brand.bosch": "Bosch",
  "demo.brand.makita": "Makita",
  "demo.condition.used": "Used",
  "demo.condition.new": "New",

  // Copy the demo STAND-INS render. A demo is product code (compiled, linted
  // with the product ruleset, rendered), so a literal string in one is the
  // same defect as a literal string in a skin — `no-hardcoded-text` does not
  // make an exception for a file whose job is to be photographed.
  "demo.contact.seller": "Message the seller",
  "demo.category.placeholder": "Choose a category",
  "demo.photo.none": "A listing with no photo",
  "demo.photo.unresolvable": "A reference nothing resolves",
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
