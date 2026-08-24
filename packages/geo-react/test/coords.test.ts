/**
 * `model/coords.ts` — the pure one, and the one that matters most.
 *
 * The axis swap is the single most common bug in map code precisely because it
 * cannot crash: `[13.38333, 52.51667]` read as `{lat, lon}` is a real place
 * (the Mediterranean, off Tunisia) and reading it correctly is Berlin. Nothing
 * throws either way, so the ONLY thing that can catch a transposition is an
 * assertion against a place somebody recognises. That is the first test below,
 * and it is why these fixtures are named cities rather than round numbers.
 *
 * No DOM, no React, no network — the reason the projection lives in `model/`
 * instead of inside the renderer is so this file can exist.
 */
import { describe, expect, it } from "vitest";
import {
  MERCATOR_MAX_LAT,
  TILE_SIZE,
  clampLat,
  fromGeoJson,
  panBy,
  project,
  tileUrl,
  tilesFor,
  toGeoJson,
  unproject,
  worldSize,
  wrapLon,
} from "../src/model/coords.js";

/** GeoJSON order — `[lon, lat]`. The backend's own example for Berlin. */
const BERLIN_GEOJSON = [13.38333, 52.51667] as const;
const BERLIN = { lat: 52.51667, lon: 13.38333 };

describe("the axis swap", () => {
  it("reads a GeoJSON pair as [lon, lat] — Berlin, not the Mediterranean", () => {
    const point = fromGeoJson(BERLIN_GEOJSON);
    expect(point).not.toBeNull();
    expect(point?.lat).toBeCloseTo(52.51667, 6);
    expect(point?.lon).toBeCloseTo(13.38333, 6);
    // The transposition this whole module exists to prevent: 13.4°N 52.5°E is
    // open sea in the Arabian Sea, and both numbers are legal in both slots.
    expect(point?.lat).not.toBeCloseTo(13.38333, 3);
  });

  it("round-trips through toGeoJson in the same file, so the two cannot diverge", () => {
    expect(toGeoJson(BERLIN)).toEqual([13.38333, 52.51667]);
    expect(fromGeoJson(toGeoJson(BERLIN))).toEqual(BERLIN);
  });

  it("skips a malformed geometry instead of throwing away the whole result list", () => {
    expect(fromGeoJson(undefined)).toBeNull();
    expect(fromGeoJson(null)).toBeNull();
    expect(fromGeoJson([])).toBeNull();
    expect(fromGeoJson([13.4])).toBeNull();
    expect(fromGeoJson([Number.NaN, 52.5])).toBeNull();
    expect(fromGeoJson([13.4, 91])).toBeNull();
    expect(fromGeoJson([181, 52.5])).toBeNull();
  });
});

describe("Web Mercator", () => {
  it("project/unproject round-trips a known city at several zooms", () => {
    for (const zoom of [0, 2, 8, 13, 17, 19]) {
      const back = unproject(project(BERLIN, zoom), zoom);
      expect(back.lat).toBeCloseTo(BERLIN.lat, 6);
      expect(back.lon).toBeCloseTo(BERLIN.lon, 6);
    }
  });

  it("puts the null island at the exact centre of the world square", () => {
    const size = worldSize(4);
    const origin = project({ lat: 0, lon: 0 }, 4);
    expect(origin.x).toBeCloseTo(size / 2, 6);
    expect(origin.y).toBeCloseTo(size / 2, 6);
  });

  it("grows the world by a factor of two per zoom level", () => {
    expect(worldSize(0)).toBe(TILE_SIZE);
    expect(worldSize(1)).toBe(TILE_SIZE * 2);
    expect(worldSize(10)).toBe(TILE_SIZE * 1024);
  });

  it("clamps latitude at the Mercator limit rather than running to infinity", () => {
    expect(clampLat(89)).toBeCloseTo(MERCATOR_MAX_LAT, 6);
    expect(clampLat(-89)).toBeCloseTo(-MERCATOR_MAX_LAT, 6);
    expect(Number.isFinite(project({ lat: 90, lon: 0 }, 3).y)).toBe(true);
  });

  it("wraps longitude across the date line — panning east is a normal gesture", () => {
    expect(wrapLon(190)).toBeCloseTo(-170, 9);
    expect(wrapLon(-190)).toBeCloseTo(170, 9);
    expect(wrapLon(180)).toBeCloseTo(-180, 9);
    expect(wrapLon(0)).toBe(0);
  });

  it("keeps panning past the date line instead of stopping at ±180", () => {
    const nearDateLine = { lat: 0, lon: 179.9 };
    const panned = panBy(nearDateLine, 5, -2000, 0);
    expect(panned.lon).toBeGreaterThanOrEqual(-180);
    expect(panned.lon).toBeLessThan(0);
  });

  it("moves the centre opposite to the drag — dragging right shows what is west", () => {
    const moved = panBy(BERLIN, 12, 100, 0);
    expect(moved.lon).toBeLessThan(BERLIN.lon);
    const up = panBy(BERLIN, 12, 0, 100);
    expect(up.lat).toBeGreaterThan(BERLIN.lat);
  });
});

describe("tilesFor", () => {
  it("covers a viewport with contiguous tiles positioned around its centre", () => {
    const tiles = tilesFor(BERLIN, 12, 512, 384);
    expect(tiles.length).toBeGreaterThan(0);
    // 512x384 needs at least 3x2 tiles of 256px once the centre is off-grid.
    expect(tiles.length).toBeGreaterThanOrEqual(6);
    const xs = new Set(tiles.map((tile) => tile.x));
    const ys = new Set(tiles.map((tile) => tile.y));
    expect(xs.size).toBeGreaterThanOrEqual(3);
    expect(ys.size).toBeGreaterThanOrEqual(2);
    // Every tile overlaps the viewport it was asked for.
    for (const tile of tiles) {
      expect(tile.left).toBeLessThan(512);
      expect(tile.top).toBeLessThan(384);
      expect(tile.left + TILE_SIZE).toBeGreaterThan(0);
      expect(tile.top + TILE_SIZE).toBeGreaterThan(0);
      expect(tile.z).toBe(12);
    }
  });

  it("the tile under the centre of the viewport is the tile the centre is in", () => {
    const zoom = 10;
    const centerPx = project(BERLIN, zoom);
    const expected = {
      x: Math.floor(centerPx.x / TILE_SIZE),
      y: Math.floor(centerPx.y / TILE_SIZE),
    };
    const tiles = tilesFor(BERLIN, zoom, 512, 512);
    expect(tiles.some((tile) => tile.x === expected.x && tile.y === expected.y)).toBe(true);
  });

  it("wraps x around the date line but never repeats y — there is one Antarctica", () => {
    const span = 2 ** 3;
    const tiles = tilesFor({ lat: 0, lon: 179.99 }, 3, 768, 256);
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThan(span);
    }
    // Crossing the seam means both the last column and the first appear.
    const xs = new Set(tiles.map((tile) => tile.x));
    expect(xs.has(span - 1)).toBe(true);
    expect(xs.has(0)).toBe(true);

    // Above the top row and below the bottom one there is no map at all.
    const polar = tilesFor({ lat: 85, lon: 0 }, 2, 512, 1024);
    for (const tile of polar) {
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeLessThan(2 ** 2);
    }
  });

  it("draws nothing for a viewport with no size", () => {
    expect(tilesFor(BERLIN, 12, 0, 0)).toHaveLength(1);
  });
});

describe("tileUrl", () => {
  const tile = { z: 12, x: 2200, y: 1343, left: 0, top: 0 };

  it("fills z/x/y in a template with no {s}", () => {
    expect(tileUrl("https://tile.openstreetmap.org/{z}/{x}/{y}.png", tile, [])).toBe(
      "https://tile.openstreetmap.org/12/2200/1343.png"
    );
  });

  it("shards deterministically across the subdomains a layer declares", () => {
    const template = "https://{s}.tile.example.org/{z}/{x}/{y}.png";
    const url = tileUrl(template, tile, ["a", "b", "c"]);
    // (2200 + 1343) % 3 === 0 → the first shard, and the same every time.
    expect(url).toBe("https://a.tile.example.org/12/2200/1343.png");
    expect(tileUrl(template, tile, ["a", "b", "c"])).toBe(url);
    const other = tileUrl(template, { ...tile, x: 2201 }, ["a", "b", "c"]);
    expect(other).toBe("https://b.tile.example.org/12/2201/1343.png");
  });

  it("removes {s} entirely when the provider does not shard — no stray dot", () => {
    const url = tileUrl("https://{s}.tile.example.org/{z}/{x}/{y}.png", tile, []);
    expect(url).toBe("https://tile.example.org/12/2200/1343.png");
    expect(url).not.toContain("{s}");
    expect(url).not.toContain("//.");
  });
});
