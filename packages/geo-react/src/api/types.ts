/**
 * Wire types for the stapel-geo HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * source of truth is `components["schemas"]` from this pair's own generated
 * schema (`./generated/schema.js`, produced by `pnpm gen:api` from
 * stapel-geo's committed `docs/schema.json`).
 *
 * ── Two things the wire says that a reader must not smooth over ────────────
 *
 * `GeocodeGeometry.coordinates` is `[longitude, latitude]` — GeoJSON order,
 * the opposite of every `lat, lon` parameter in this API. It is converted
 * exactly once, in `model/coords.ts`, and nothing else in this package indexes
 * that array. Both numbers are plausible in both slots, so a transposition
 * does not crash; it lands the pin in the Mediterranean.
 *
 * `GeocodeResponse.lang` and `PlaceResolution.lang` report the language the
 * provider was ACTUALLY asked for after the server clamped it. Photon indexes
 * only the languages its database was built with and answers HTTP 400 for any
 * other, so stapel-geo 0.4.0 clamps rather than forwarding — and says what it
 * clamped to. A component that sends `ru` and reads back `default` has been
 * clamped; that is the contract working, not a fault.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

/** `GET /geo/api/v1/map/config` — everything the picker needs before its
 * first frame, and the ONLY call that works for an anonymous visitor. */
export type MapConfig = Schemas["MapConfig"];

/** The raster basemap and its attribution obligation. */
export type TileLayer = Schemas["TileLayer"];

/** A GeoJSON FeatureCollection of places, plus the language actually used. */
export type GeocodeResponse = Schemas["GeocodeResponse"];

/** One geocoded place. */
export type GeocodeFeature = Schemas["GeocodeFeature"];

/** A place's address components and display line. */
export type GeocodeProperties = Schemas["GeocodeProperties"];

/** `GET /geo/api/v1/geocoding/resolve` — one point, everything a confirmation
 * step renders: the display line, the components, the geohash to store, the
 * alternatives to offer, and (opt-in) the nearest known Location rows. */
export type PlaceResolution = Schemas["PlaceResolution"];

/** A known `Location` row near a resolved point (reference data, opt-in). */
export type PlaceSummary = Schemas["PlaceSummary"];

/**
 * The endpoint table `map/config` hands out, mount-relative.
 *
 * Read from there rather than hardcoded, because the contract says to: the
 * mount prefix is the host's and the paths are the module's, and a client that
 * hardcodes both owns a copy of a decision it does not make. The keys are the
 * five the contract documents; the map is typed loosely because the server may
 * add one and an unknown key must not be a type error.
 */
export type GeoEndpoints = Readonly<Record<string, string>>;

/** The forward-geocoding query, as the server takes it. */
export interface SearchQuery {
  /** The raw text the person typed. */
  readonly q: string;
  /** How many results to consider. Server-clamped to 50. */
  readonly limit?: number;
  /**
   * A soft bias toward what the map is currently looking at. A street name
   * that repeats in every town in the country resolves to the one on screen
   * rather than to one 4000km away. Sent as `bias_lat` / `bias_lon` / `zoom`.
   */
  readonly bias?: { readonly lat: number; readonly lon: number; readonly zoom?: number };
  /** `min_lon,min_lat,max_lon,max_lat`. OMIT IT and the server applies the
   * deployment's own `MAP_BBOX`, which is almost always what a product wants;
   * passing one here is a hard restriction, not a preference. */
  readonly bbox?: string;
  /**
   * Leave UNSET. The contract is explicit: send `default` or nothing, never a
   * language tag the deployment's index may not carry. Present for the rare
   * deployment whose index really does carry its language.
   */
  readonly lang?: string;
}

/** The reverse/resolve query. */
export interface ResolveQuery {
  readonly lat: number;
  readonly lon: number;
  readonly limit?: number;
  /** How many known `Location` rows to return. **Default 0 — the reference
   * tree is not queried at all** unless asked, which is why a picker that does
   * not use it costs nothing. */
  readonly nearest?: number;
  readonly radiusKm?: number;
  /** See {@link SearchQuery.lang}. */
  readonly lang?: string;
}
