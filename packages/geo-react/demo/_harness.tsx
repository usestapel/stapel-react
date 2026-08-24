/**
 * Shared harness for the geo-react demos (frontend-guardrails §4.2). Demos are
 * first-class code — compiled, linted with the PRODUCT ruleset, smoke-rendered
 * — so this file obeys the same guardrails as `src/`: colours are tokens,
 * every label is an i18n key.
 *
 * The mock runtime injects a canned `fetch`, so a demo can show the anonymous
 * case and a broken `map/config` without a server. Note what it does NOT fake:
 * the picker runs for real, including the Web Mercator arithmetic and the
 * debounce/abort discipline, so what a demo shows is the genuine component.
 *
 * The tile requests go to the real OSM tile server, because a raster basemap
 * IS a grid of `<img>` tags and there is nothing to stub — a demo with fake
 * tiles would be a demo of the fake tiles. A viewer offline sees the map's
 * chrome, the pin, the attribution and every state below it, which is what
 * these demos are about.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import { GeoProvider, createGeoRuntime, registerGeoI18n } from "../src/index.js";

/** The base every mock handler mounts on (mirrors `path("geo/", …)`). */
export const DEMO_BASE = "https://geo.demo.stapel.dev/geo";

/** `GET /geo/api/v1/map/config` — the contract's own example body. */
export function demoConfig(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    tiles: {
      url_template: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      subdomains: [],
      attribution_html:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      attribution_text: "© OpenStreetMap contributors",
      policy_url: "https://operations.osmfoundation.org/policies/tiles/",
      requires_attribution: true,
      min_zoom: 2,
      max_zoom: 19,
    },
    default_center: [52.51667, 13.38333],
    default_zoom: 13,
    picked_zoom: 17,
    bbox: null,
    geolocation: true,
    search_min_chars: 3,
    search_debounce_ms: 350,
    geohash_precision: 8,
    endpoints: {
      search: "api/v1/geocoding/search",
      structured: "api/v1/geocoding/structured",
      reverse: "api/v1/geocoding/reverse",
      resolve: "api/v1/geocoding/resolve",
      locations_nearby: "api/v1/locations/nearby-by-coords",
    },
    ...overrides,
  };
}

/** A GeoJSON feature — `coordinates` is `[lon, lat]`. */
function demoFeature(
  formatted: string,
  lon: number,
  lat: number,
  id: number
): Record<string, unknown> {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: {
      formatted,
      name: formatted,
      country: "Deutschland",
      countrycode: "DE",
      city: "Berlin",
      street: "Unter den Linden",
      housenumber: "1",
      postcode: "10117",
      osm_type: "W",
      osm_id: id,
      extent: null,
    },
  };
}

/** A `FeatureCollection` of a few Berlin streets. */
export const DEMO_SEARCH: Record<string, unknown> = {
  type: "FeatureCollection",
  lang: "default",
  features: [
    demoFeature("Unter den Linden, 1, Berlin, Deutschland", 13.38333, 52.51667, 1),
    demoFeature("Alexanderplatz, Berlin, Deutschland", 13.41314, 52.52182, 2),
    demoFeature("Potsdamer Platz, Berlin, Deutschland", 13.37611, 52.50944, 3),
  ],
};

/** `GET …/geocoding/resolve` — everything a confirmation step renders. */
export const DEMO_RESOLVE: Record<string, unknown> = {
  lat: 52.51667,
  lon: 13.38333,
  geohash: "u33dc0cp",
  lang: "default",
  formatted: "Unter den Linden, 1, Berlin, Deutschland",
  address: demoFeature("Unter den Linden, 1, Berlin, Deutschland", 13.38333, 52.51667, 1)[
    "properties"
  ],
  feature: demoFeature("Unter den Linden, 1, Berlin, Deutschland", 13.38333, 52.51667, 1),
  alternatives: [],
  nearest: [],
};

/** The Stapel error envelope (contract §6). */
export function demoEnvelope(code: string, message: string): Record<string, unknown> {
  return { localizable_error: code, error: message, params: {} };
}

export type DemoResponse = unknown | readonly [number, unknown];
export type DemoHandlers = Readonly<Record<string, DemoResponse>>;

function statusAndBody(value: DemoResponse): [number, unknown] {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
    return [value[0], value[1]];
  }
  return [200, value];
}

/** Build a canned `fetch` from a suffix→response map; unmatched paths 404. */
export function mockFetch(handlers: DemoHandlers): typeof globalThis.fetch {
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let matched: DemoResponse = [404, demoEnvelope("error.404.not_found", "Not found")];
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

/** Provider frame every geo demo variant renders inside. */
export function GeoDemoHarness(props: {
  handlers?: DemoHandlers;
  children: ReactNode;
}): ReactElement {
  const { handlers } = props;
  const { runtime, queryClient, i18n } = useMemo(() => {
    const engine = createI18n({ locale: "en" });
    registerGeoI18n(engine);
    return {
      runtime: createGeoRuntime({ baseUrl: DEMO_BASE, fetch: mockFetch(handlers ?? {}) }),
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      i18n: engine,
    };
  }, [handlers]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <GeoProvider runtime={runtime}>{props.children}</GeoProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

// ── shared demo UI (token-driven; no raw colours, no literal prose) ───────────

const cardStyle: CSSProperties = {
  background: cssVar("surface-raised"),
  color: cssVar("text"),
  border: `1px solid ${cssVar("border-subtle")}`,
  borderRadius: radii.lg,
  padding: spacing["5"],
  display: "flex",
  flexDirection: "column",
  gap: spacing["3"],
  maxWidth: "34rem",
  fontSize: fontSize.md.fontSize,
};

/**
 * The token-styled frame a demo body sits in.
 *
 * Deliberately WITHOUT a heading: the showcase already renders each variant's
 * `description`, so a heading here would be a second, untranslated copy of the
 * same sentence — and a literal one, which is what `stapel/no-hardcoded-text`
 * exists to refuse. The frame's job is the surface, not the words.
 */
export function DemoFrame(props: { children: ReactNode }): ReactElement {
  return (
    <div style={cardStyle} data-theme-surface>
      {props.children}
    </div>
  );
}
