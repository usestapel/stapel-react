import type { StapelClient } from "@stapel/core";
import type {
  GeocodeResponse,
  GeoEndpoints,
  IpLocation,
  MapConfig,
  PlaceResolution,
  ResolveQuery,
  SearchQuery,
} from "./types.js";

/**
 * The pair's typed operation surface, bound to the injected
 * {@link StapelClient} (the per-module override seam of frontend-standard
 * §7.2).
 *
 * ── One hardcoded path, and only one ───────────────────────────────────────
 *
 * `map/config` is the bootstrap: it is public, it is the first call, and its
 * answer CONTAINS the paths of the other four (`endpoints.search`,
 * `.structured`, `.reverse`, `.resolve`). The contract asks a client to read
 * them from there rather than hardcode four strings, because the mount prefix
 * belongs to the host and the paths belong to the module — a client that
 * spells both owns a copy of a decision it does not make. So every other
 * operation here takes its path as an argument, and `model/queries.ts` feeds
 * it from the config it already loaded.
 *
 * ── No trailing slash ──────────────────────────────────────────────────────
 *
 * `…/geocoding/search` is the endpoint; `…/geocoding/search/` is a 404. The
 * paths come off `endpoints` verbatim for exactly that reason: nothing here
 * appends, trims or normalizes a slash, because the server's spelling is the
 * only correct one.
 */
export interface GeoApi {
  readonly client: StapelClient;

  /** Public, always. The only call an anonymous visitor can make, and the
   * reason the map renders for one. */
  mapConfig(options?: { readonly signal?: AbortSignal }): Promise<MapConfig>;

  /**
   * Forward geocoding — search-as-you-type.
   *
   * `signal` is not optional in practice: a search field fires this on
   * keystrokes and every superseded request must be aborted, or the answer to
   * a three-letter prefix can land after the answer to the whole word and
   * overwrite it. The hook that drives this (`headless/usePlaceSearch.ts`)
   * owns that discipline.
   */
  search(
    path: string,
    query: SearchQuery,
    options?: { readonly signal?: AbortSignal }
  ): Promise<GeocodeResponse>;

  /** Reverse geocoding, raw candidates. For a picker, prefer
   * {@link GeoApi.resolve}, which answers the same round trip with the
   * display line and the geohash already assembled. */
  reverse(
    path: string,
    query: ResolveQuery,
    options?: { readonly signal?: AbortSignal }
  ): Promise<GeocodeResponse>;

  /** The picker's call: a coordinate in, everything a confirmation step
   * renders out. Used for both "the browser gave me a position" and "the
   * person moved the pin". */
  resolve(
    path: string,
    query: ResolveQuery,
    options?: { readonly signal?: AbortSignal }
  ): Promise<PlaceResolution>;

  /**
   * Where the caller appears to be, from their own IP. The centre a map opens
   * on before the browser's position prompt has been answered — or after it
   * was refused, which is a supported answer and not an error.
   *
   * `null` is the deployment saying it has no opinion at all (HTTP 204): it
   * has no locator answer AND no fallback centre. Every other outcome,
   * including "we could not place this address", is a 200 carrying the
   * fallback centre with `ip_resolved: false`.
   */
  ipLocation(
    path: string,
    options?: { readonly signal?: AbortSignal }
  ): Promise<IpLocation | null>;
}

/** The one path this package spells itself. Mount-relative, like the ones
 * `endpoints` hands back. */
export const MAP_CONFIG_PATH = "api/v1/map/config";

const signalOf = (options?: {
  readonly signal?: AbortSignal;
}): { signal?: AbortSignal } =>
  options?.signal !== undefined ? { signal: options.signal } : {};

/**
 * `lang` is omitted unless a caller explicitly set it (see
 * {@link SearchQuery.lang}). Sending a tag the deployment's Photon index was
 * not built with used to mean an HTTP 400; since 0.4.0 the server clamps
 * instead — but a clamp is still a clamp, and the honest default is to say
 * nothing and let `Accept-Language` do its job.
 */
function searchParams(query: SearchQuery): Record<string, string | number> {
  const params: Record<string, string | number> = { q: query.q };
  if (query.limit !== undefined) params["limit"] = query.limit;
  if (query.bbox !== undefined) params["bbox"] = query.bbox;
  if (query.lang !== undefined) params["lang"] = query.lang;
  if (query.bias !== undefined) {
    params["bias_lat"] = query.bias.lat;
    params["bias_lon"] = query.bias.lon;
    if (query.bias.zoom !== undefined) params["zoom"] = query.bias.zoom;
  }
  return params;
}

function pointParams(query: ResolveQuery): Record<string, string | number> {
  const params: Record<string, string | number> = { lat: query.lat, lon: query.lon };
  if (query.limit !== undefined) params["limit"] = query.limit;
  if (query.nearest !== undefined) params["nearest"] = query.nearest;
  if (query.radiusKm !== undefined) params["radius_km"] = query.radiusKm;
  if (query.lang !== undefined) params["lang"] = query.lang;
  return params;
}

export function createGeoApi(client: StapelClient): GeoApi {
  return {
    client,
    mapConfig: (options) => client.get(MAP_CONFIG_PATH, { ...signalOf(options) }),
    search: (path, query, options) =>
      client.get(path, { query: searchParams(query), ...signalOf(options) }),
    reverse: (path, query, options) =>
      client.get(path, { query: pointParams(query), ...signalOf(options) }),
    resolve: (path, query, options) =>
      client.get(path, { query: pointParams(query), ...signalOf(options) }),
    ipLocation: async (path, options) => {
      // 204 comes back as `undefined` from the client. Normalized to `null`
      // here so "the deployment declined to have an opinion" is one value a
      // caller can branch on, not the difference between two absences.
      const answer = await client.get<IpLocation | undefined>(path, {
        ...signalOf(options),
      });
      return answer ?? null;
    },
  };
}

/** The endpoint table off a loaded config, with the shape narrowed from the
 * schema's open `additionalProperties` map. */
export function endpointsOf(config: MapConfig): GeoEndpoints {
  const raw = (config as { endpoints?: unknown }).endpoints;
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
