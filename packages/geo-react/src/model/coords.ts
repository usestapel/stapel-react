/**
 * The one place `[lon, lat]` becomes `{ lat, lon }`, and the Web Mercator
 * arithmetic a raster map is drawn with.
 *
 * ## The axis swap
 *
 * stapel-geo's own contract calls this out in bold: **every request parameter
 * is `lat, lon`, and every GeoJSON `coordinates` array is `[lon, lat]`** — the
 * opposite order, because GeoJSON is x-then-y. It is, in the backend's words,
 * the single most common bug in map code, and the reason it is so common is
 * that both numbers are plausible in both slots: 52.5, 13.4 and 13.4, 52.5 are
 * each a real place, one in Berlin and one in the Mediterranean, and nothing
 * crashes.
 *
 * So the swap happens exactly once, here, at the boundary, and NO other module
 * in this package is allowed to index a `coordinates` array. Everything
 * downstream speaks {@link LatLon}, which cannot be transposed by accident
 * because its fields are named.
 *
 * ## Why the projection lives here too
 *
 * A raster basemap is a grid of pre-rendered square tiles addressed by
 * `z/x/y`, and turning a coordinate into a tile address is Web Mercator: six
 * lines of arithmetic, exact, and identical in every map library ever written.
 * This package draws its own tiles rather than taking a dependency on one
 * (`default/TileMap.tsx` says why), so the arithmetic is here — pure, with no
 * DOM and no React, which is what lets it be tested against known fixtures
 * instead of against a screenshot.
 */

/** A geographic point, in the order a human says it and the API takes it. */
export interface LatLon {
  readonly lat: number;
  readonly lon: number;
}

/**
 * A GeoJSON `[longitude, latitude]` pair → a named point.
 *
 * Returns `null` rather than throwing for anything that is not two finite
 * numbers in range: a geocoder answering with a malformed geometry is a
 * feature to skip, not a reason to lose the whole result list.
 */
export function fromGeoJson(coordinates: readonly number[] | undefined | null): LatLon | null {
  if (coordinates === undefined || coordinates === null || coordinates.length < 2) {
    return null;
  }
  const lon = coordinates[0];
  const lat = coordinates[1];
  if (typeof lon !== "number" || typeof lat !== "number") return null;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/** A named point → the GeoJSON pair, for anything that must speak GeoJSON
 * back. The inverse of {@link fromGeoJson}, in the same file, so the two can
 * never learn different conventions. */
export function toGeoJson(point: LatLon): [number, number] {
  return [point.lon, point.lat];
}

/** Latitude clamped to the Web Mercator limit. Beyond ±85.0511° the
 * projection runs to infinity, which is why every slippy map in the world
 * stops there rather than at the pole. */
export const MERCATOR_MAX_LAT = 85.05112878;

export function clampLat(lat: number): number {
  return Math.min(MERCATOR_MAX_LAT, Math.max(-MERCATOR_MAX_LAT, lat));
}

/** Longitude wrapped into [-180, 180) — panning east past the date line is a
 * normal thing to do with a finger. */
export function wrapLon(lon: number): number {
  const wrapped = ((lon + 180) % 360 + 360) % 360 - 180;
  return wrapped;
}

/** The side of the world square, in pixels, at a zoom level. Tiles are 256px. */
export const TILE_SIZE = 256;

export function worldSize(zoom: number): number {
  return TILE_SIZE * Math.pow(2, zoom);
}

/** A point in the world pixel plane at `zoom` — the space a slippy map does
 * all of its panning arithmetic in. */
export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

/** Web Mercator forward projection. */
export function project(point: LatLon, zoom: number): WorldPoint {
  const size = worldSize(zoom);
  const lat = clampLat(point.lat);
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((wrapLon(point.lon) + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

/** Web Mercator inverse projection. */
export function unproject(point: WorldPoint, zoom: number): LatLon {
  const size = worldSize(zoom);
  const lon = (point.x / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * point.y) / size;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lon: wrapLon(lon) };
}

/** One raster tile's address. */
export interface TileRef {
  readonly z: number;
  readonly x: number;
  readonly y: number;
  /** Where its top-left corner sits inside the viewport, in CSS pixels. */
  readonly left: number;
  readonly top: number;
}

/**
 * Every tile that covers a viewport of `width x height` CSS pixels centred on
 * `center` at `zoom`, with its position inside that viewport.
 *
 * `x` is wrapped around the world so panning past the date line keeps drawing;
 * `y` is NOT — above the top tile row and below the bottom one there is no
 * map, and repeating it would draw a second Antarctica.
 */
export function tilesFor(
  center: LatLon,
  zoom: number,
  width: number,
  height: number
): TileRef[] {
  const z = Math.max(0, Math.round(zoom));
  const centerPx = project(center, z);
  const originX = centerPx.x - width / 2;
  const originY = centerPx.y - height / 2;
  const first = { x: Math.floor(originX / TILE_SIZE), y: Math.floor(originY / TILE_SIZE) };
  const last = {
    x: Math.floor((originX + width) / TILE_SIZE),
    y: Math.floor((originY + height) / TILE_SIZE),
  };
  const span = Math.pow(2, z);
  const tiles: TileRef[] = [];
  for (let y = first.y; y <= last.y; y += 1) {
    if (y < 0 || y >= span) continue;
    for (let x = first.x; x <= last.x; x += 1) {
      tiles.push({
        z,
        x: ((x % span) + span) % span,
        y,
        left: x * TILE_SIZE - originX,
        top: y * TILE_SIZE - originY,
      });
    }
  }
  return tiles;
}

/** Move the centre by a pixel delta — what a drag gesture produces. */
export function panBy(center: LatLon, zoom: number, dx: number, dy: number): LatLon {
  const p = project(center, zoom);
  return unproject({ x: p.x - dx, y: p.y - dy }, zoom);
}

/** Fill a tile URL template. `{s}` picks a subdomain shard when the layer
 * declares any; an empty list means the provider does not shard, and the
 * placeholder is simply removed rather than filled with the empty string in a
 * way that leaves a stray dot in the hostname. */
export function tileUrl(
  template: string,
  tile: TileRef,
  subdomains: readonly string[]
): string {
  let url = template
    .replace("{z}", String(tile.z))
    .replace("{x}", String(tile.x))
    .replace("{y}", String(tile.y));
  if (url.includes("{s}")) {
    if (subdomains.length === 0) {
      url = url.replace("{s}.", "").replace("{s}", "");
    } else {
      const shard = subdomains[(tile.x + tile.y) % subdomains.length] as string;
      url = url.replace("{s}", shard);
    }
  }
  return url;
}
