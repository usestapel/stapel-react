/**
 * The wire, as the backend actually sends it.
 *
 * House law (CONTRIBUTING.md, "Mock the wire, not the module"): nothing here
 * hand-shapes a value that crosses the network boundary. Every fixture below
 * is a BODY copied from `stapel-geo/docs/frontend-contract.md`, served over
 * MSW, and folded into the value the code catches by the REAL transport — so
 * a `GeocoderAvailability` of `"unauthorized"` in a test is produced by a real
 * 401 response travelling through `@stapel/core`'s client, exactly as it is in
 * production. `vi.mock` of the api module would prove nothing: the author of
 * the mock holds the same belief as the author of the code.
 */
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { createGeoRuntime } from "../src/model/runtime.js";
import { GeoProvider } from "../src/headless/GeoProvider.js";
import { registerGeoI18n } from "../src/i18n/keys.js";

/** The host's mount: `path("geo/", include("stapel_geo.urls"))`. */
export const BASE = "https://geo.test/geo";

export const CONFIG_URL = `${BASE}/api/v1/map/config`;
export const SEARCH_URL = `${BASE}/api/v1/geocoding/search`;
export const RESOLVE_URL = `${BASE}/api/v1/geocoding/resolve`;

/**
 * `GET /geo/api/v1/map/config` — the contract's own example, with the debounce
 * dropped to something a test can wait through. The numbers are the
 * deployment's operating discipline and the component reads them from here,
 * which is exactly why a test can turn them down without touching the code.
 */
export function mapConfig(overrides?: Record<string, unknown>): Record<string, unknown> {
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
    search_debounce_ms: 5,
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

/** One GeoJSON `Feature` — note `coordinates` is `[lon, lat]`. */
export function feature(
  formatted: string,
  lon: number,
  lat: number,
  osmId: number
): Record<string, unknown> {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: {
      formatted,
      name: formatted,
      country: "Deutschland",
      countrycode: "DE",
      state: "Berlin",
      county: null,
      city: "Berlin",
      district: "Mitte",
      street: "Unter den Linden",
      housenumber: "1",
      postcode: "10117",
      osm_key: "place",
      osm_value: "house",
      osm_type: "W",
      osm_id: osmId,
      extent: null,
    },
  };
}

/** A `FeatureCollection` — what all four geocoding verbs answer with. */
export function features(
  rows: readonly (readonly [string, number, number, number])[]
): Record<string, unknown> {
  return {
    type: "FeatureCollection",
    lang: "default",
    features: rows.map(([formatted, lon, lat, id]) => feature(formatted, lon, lat, id)),
  };
}

/** `GET …/geocoding/resolve` — everything a confirmation step renders. */
export function resolution(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    lat: 52.51667,
    lon: 13.38333,
    geohash: "u33dc0cp",
    lang: "default",
    formatted: "Unter den Linden, 1, Berlin, Deutschland",
    address: feature("Unter den Linden, 1, Berlin, Deutschland", 13.38333, 52.51667)[
      "properties"
    ],
    feature: feature("Unter den Linden, 1, Berlin, Deutschland", 13.38333, 52.51667),
    alternatives: [],
    nearest: [],
    ...overrides,
  };
}

/**
 * A resolve over the middle of a lake: a SUCCESSFUL call that matched nothing.
 * `geohash` is still there, because the coordinate is still real.
 */
export function nowhere(): Record<string, unknown> {
  return resolution({ formatted: null, address: null, feature: null, alternatives: [] });
}

/** The Stapel error envelope (contract §6) — the body, verbatim. */
export function envelope(code: string, message: string): Record<string, unknown> {
  return { localizable_error: code, error: message, params: {} };
}

/** Providers every skin test renders inside. */
export function wrap(children: ReactNode, locale = "en"): ReactElement {
  const runtime = createGeoRuntime({ baseUrl: BASE });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const i18n = createI18n({ locale });
  registerGeoI18n(i18n);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <GeoProvider runtime={runtime}>{children}</GeoProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/**
 * Install a fake `navigator.geolocation`. Returns a restore function.
 *
 * `answer` is called with the two callbacks the real API takes, so a test
 * drives the SAME code path the browser does — including the fact that the
 * error object carries a numeric `code` and nothing else worth reading.
 */
export function withGeolocation(
  answer: (
    onSuccess: (position: { coords: { latitude: number; longitude: number; accuracy?: number } }) => void,
    onError: (error: { code: number }) => void
  ) => void
): () => void {
  const original = Object.getOwnPropertyDescriptor(navigator, "geolocation");
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (
        onSuccess: (position: {
          coords: { latitude: number; longitude: number; accuracy?: number };
        }) => void,
        onError: (error: { code: number }) => void
      ) => {
        answer(onSuccess, onError);
      },
    },
  });
  return () => {
    if (original === undefined) {
      Reflect.deleteProperty(navigator, "geolocation");
    } else {
      Object.defineProperty(navigator, "geolocation", original);
    }
  };
}

/** Remove the API entirely — the `unsupported` outcome, where the control
 * must not be on screen at all rather than disabled. */
export function withoutGeolocation(): () => void {
  const original = Object.getOwnPropertyDescriptor(navigator, "geolocation");
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
  return () => {
    if (original === undefined) {
      Reflect.deleteProperty(navigator, "geolocation");
    } else {
      Object.defineProperty(navigator, "geolocation", original);
    }
  };
}
