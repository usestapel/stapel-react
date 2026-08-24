/**
 * `<TileMap/>` — the raster basemap, drawn here, with NO map-library
 * dependency.
 *
 * ## Why this package draws its own tiles
 *
 * The obvious move is Leaflet or MapLibre. For a PICKER, what that buys is a
 * runtime dependency (Leaflet ~42 KB gzipped, MapLibre ~200 KB), a stylesheet
 * that must be imported by every host and that fights antd's reset, a CSP
 * surface (workers, blob: URLs and `style-src` for MapLibre's GL pipeline),
 * and an imperative instance whose lifecycle has to be married to React's by
 * hand. What it is asked to DO here is: put a grid of `<img>` tags on screen,
 * move them when a finger moves, and swap them when the zoom changes.
 *
 * The arithmetic that turns a coordinate into a tile address is Web Mercator —
 * exact, six lines, identical in every map library ever written — and it
 * already lives in `model/coords.ts` (`project`, `unproject`, `tilesFor`,
 * `panBy`, `tileUrl`), pure and unit-tested against known fixtures. So the
 * whole basemap is that arithmetic plus positioned images, and the honest cost
 * of a dependency here is larger than the thing it would replace.
 *
 * The trade is stated rather than hidden: this is a PICKER's map. It has no
 * vector styling, no clustering, no GeoJSON overlays, no rotation and no
 * inertia. A product that needs a real mapping surface should mount a real map
 * library and drive this pair's headless hooks from it — which is exactly why
 * those hooks are exported.
 *
 * ## The centre pin
 *
 * The pin is FIXED at the centre and the map moves under it. The alternative —
 * a draggable marker — means that on a phone the thing being positioned is
 * covered by the finger positioning it, and the last 20 px of the gesture are
 * done blind. A fixed crosshair is always visible, is always exactly at the
 * point that will be saved, and turns "place a pin" into "move the map", which
 * is the gesture a person already knows. It also removes an entire class of
 * hit-testing code, since there is no marker to grab.
 *
 * ## Measurement
 *
 * The tile grid is sized from the ELEMENT's rendered box, via this component's
 * own `ResizeObserver` — never from the viewport. `@stapel/image`'s
 * `useImageSlot` does the same job for images, and is deliberately NOT taken
 * as a dependency: it is a peer this package does not otherwise need, it
 * answers a different question (which ladder rung of a variant set to request
 * for a box) and it debounces upward-only, which is right for an image whose
 * source must not thrash and wrong for a map that must re-tile on every frame
 * of a resize. Fifteen lines of `ResizeObserver` is the smaller honest cost.
 *
 * ## Attribution is a licence obligation
 *
 * OpenStreetMap data is ODbL and the tile policy requires visible credit, so
 * `attribution_html` is rendered ALWAYS and there is no prop that removes it —
 * `requires_attribution` is not treated as an opt-out, because a map with the
 * credit suppressed is a licence violation, not a style choice. The HTML is
 * fed through `dangerouslySetInnerHTML` on purpose and on the same footing as
 * `auth-react`'s `ChannelIcon` with `icon_svg`: the value is server-controlled
 * and sanitized upstream, arrives from the deployment's own `map/config`, and
 * carries the `<a>` the licence requires — which is precisely what escaping it
 * would destroy.
 *
 * ## Copy
 *
 * The four labels are PROPS, resolved by the caller, not `useT()` calls here.
 * Same rule `SkinDialog` follows with `dismissLabel`: a component that renders
 * chrome for somebody else's surface takes that somebody's words rather than
 * reaching into a key registry, so a host embedding this map in its own screen
 * names it in its own copy without this file learning about a second registry.
 * `LocationPickerField` — which DOES own the geo keys — supplies them.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  RefObject,
} from "react";
import { Button, theme as antdTheme } from "antd";
import { spacing } from "@stapel/tokens";
import { TILE_SIZE, clampLat, panBy, tileUrl, tilesFor, wrapLon } from "../model/coords.js";
import type { LatLon } from "../model/coords.js";
import type { TileLayer } from "../api/types.js";

/** How far one arrow-key press moves the map, in CSS pixels. Roughly a
 * quarter tile: large enough to be progress, small enough to aim with. */
const KEY_PAN_PX = 64;

/** The zoom the layer serves when it declines to say. */
const FALLBACK_MIN_ZOOM = 0;
const FALLBACK_MAX_ZOOM = 19;

/** Resolved copy this component renders. See the module doc for why these are
 * props rather than `useT()` calls. */
export interface TileMapLabels {
  /** The map's accessible name — it is a control, not a picture. */
  readonly map: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  /** The centre crosshair's accessible name. */
  readonly pin: string;
}

export interface TileMapProps {
  /** The basemap and its attribution obligation, straight off `map/config`. */
  readonly layer: TileLayer;
  readonly center: LatLon;
  readonly zoom: number;
  /** Every pan, zoom and keyboard nudge reports the new camera here. The
   * component is fully controlled: it stores no centre of its own, so the
   * picker's pin and the map can never drift apart. */
  readonly onChange: (center: LatLon, zoom: number) => void;
  /** `map/config.bbox` — `[min_lon, min_lat, max_lon, max_lat]`. The map will
   * not pan its centre outside it. A wrapping box (`min_lon > max_lon`, legal
   * per the contract) constrains latitude only. */
  readonly bbox?: readonly number[] | null | undefined;
  /** CSS height of the map box. Width is always the container's. */
  readonly height?: number | string;
  readonly labels: TileMapLabels;
  readonly "data-testid"?: string;
}

interface Box {
  readonly width: number;
  readonly height: number;
}

/**
 * The element's rendered box, from a `ResizeObserver` on the element itself.
 *
 * The initial synchronous read matters: without it the first paint has a zero
 * box and draws no tiles, and in an environment that never fires the observer
 * (a `display: none` ancestor that is revealed by a CSS class rather than a
 * remount) it would stay that way.
 */
function useElementBox(ref: RefObject<HTMLDivElement | null>): Box {
  const [box, setBox] = useState<Box>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const commit = (width: number, height: number): void => {
      setBox((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height }
      );
    };
    const measure = (): void => {
      const rect = element.getBoundingClientRect();
      commit(rect.width, rect.height);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      const { width, height } = entry.contentRect;
      if (width > 0 || height > 0) commit(width, height);
      else measure();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return box;
}

function zoomRange(layer: TileLayer): readonly [number, number] {
  const min = layer.min_zoom ?? FALLBACK_MIN_ZOOM;
  const max = layer.max_zoom ?? FALLBACK_MAX_ZOOM;
  return min <= max ? [min, max] : [max, min];
}

function clampZoom(zoom: number, layer: TileLayer): number {
  const [min, max] = zoomRange(layer);
  return Math.min(max, Math.max(min, Math.round(zoom)));
}

/**
 * Keep the centre inside the deployment's operating area.
 *
 * A wrapping box — `min_lon > max_lon`, which the contract calls legal because
 * a country can straddle the date line — describes two lon intervals, not one,
 * and clamping into it with `Math.min/max` would teleport the map to the
 * wrong side of the planet. Latitude is still constrained; longitude is left
 * to wrap.
 */
export function clampToBbox(point: LatLon, bbox?: readonly number[] | null): LatLon {
  const lat = clampLat(point.lat);
  const lon = wrapLon(point.lon);
  if (bbox === undefined || bbox === null || bbox.length < 4) return { lat, lon };
  const minLon = bbox[0];
  const minLat = bbox[1];
  const maxLon = bbox[2];
  const maxLat = bbox[3];
  if (
    typeof minLon !== "number" ||
    typeof minLat !== "number" ||
    typeof maxLon !== "number" ||
    typeof maxLat !== "number"
  ) {
    return { lat, lon };
  }
  const boundedLat = Math.min(Math.max(lat, Math.min(minLat, maxLat)), Math.max(minLat, maxLat));
  const boundedLon = minLon <= maxLon ? Math.min(Math.max(lon, minLon), maxLon) : lon;
  return { lat: clampLat(boundedLat), lon: wrapLon(boundedLon) };
}

/** A pointer landing on a button or a link is that control's, not a pan. The
 * zoom buttons and the attribution's licence links live inside the map box. */
function isChrome(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("button, a") !== null;
}

export function TileMap(props: TileMapProps): ReactElement {
  const { layer, center, zoom, onChange, labels } = props;
  const { token } = antdTheme.useToken();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const box = useElementBox(containerRef);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  const commit = useCallback(
    (nextCenter: LatLon, nextZoom: number): void => {
      onChange(clampToBbox(nextCenter, props.bbox), clampZoom(nextZoom, layer));
    },
    [onChange, props.bbox, layer]
  );

  const panPixels = useCallback(
    (dx: number, dy: number): void => {
      commit(panBy(center, zoom, dx, dy), zoom);
    },
    [commit, center, zoom]
  );

  const zoomBy = useCallback(
    (delta: number): void => {
      commit(center, zoom + delta);
    },
    [commit, center, zoom]
  );

  // The wheel listener is attached natively with `passive: false`. React's own
  // `onWheel` is registered at the root as PASSIVE, so `preventDefault()`
  // inside it does nothing but print a console warning — and without it the
  // page scrolls away underneath the map the person is zooming.
  useEffect(() => {
    const element = containerRef.current;
    if (element === null) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1 : -1);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
    };
  }, [zoomBy]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.isPrimary === false) return;
    if (isChrome(event.target)) return;
    drag.current = { x: event.clientX, y: event.clientY };
    setGrabbing(true);
    // Guarded: jsdom and some webviews ship pointer events with no capture
    // API, and an unguarded call throws out of the handler, losing the gesture.
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }, []);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const from = drag.current;
      if (from === null) return;
      const dx = event.clientX - from.x;
      const dy = event.clientY - from.y;
      if (dx === 0 && dy === 0) return;
      drag.current = { x: event.clientX, y: event.clientY };
      panPixels(dx, dy);
    },
    [panPixels]
  );

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    drag.current = null;
    setGrabbing(false);
    if (
      typeof event.currentTarget.hasPointerCapture === "function" &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  /** A map that can only be used with a pointer is not usable. Arrows pan,
   * `+`/`-` zoom, and the container is in the tab order with a name. */
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>): void => {
      if (isChrome(event.target)) return;
      switch (event.key) {
        case "ArrowUp":
          panPixels(0, KEY_PAN_PX);
          break;
        case "ArrowDown":
          panPixels(0, -KEY_PAN_PX);
          break;
        case "ArrowLeft":
          panPixels(KEY_PAN_PX, 0);
          break;
        case "ArrowRight":
          panPixels(-KEY_PAN_PX, 0);
          break;
        case "+":
        case "=":
          zoomBy(1);
          break;
        case "-":
        case "_":
          zoomBy(-1);
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [panPixels, zoomBy]
  );

  const effectiveZoom = clampZoom(zoom, layer);
  const subdomains = useMemo(() => layer.subdomains ?? [], [layer.subdomains]);
  const tiles = useMemo(
    () =>
      box.width > 0 && box.height > 0
        ? tilesFor(center, effectiveZoom, box.width, box.height)
        : [],
    [center, effectiveZoom, box.width, box.height]
  );

  const [min, max] = zoomRange(layer);

  const controlStyle: CSSProperties = {
    position: "absolute",
    top: spacing[2],
    right: spacing[2],
    display: "flex",
    flexDirection: "column",
    gap: spacing[1],
    zIndex: 2,
  };

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={labels.map}
      tabIndex={0}
      data-geo-map="ready"
      data-geo-zoom={String(effectiveZoom)}
      data-analytics="none"
      data-analytics-reason="local-ui-map-camera; the picker reports the chosen place, not each pan"
      {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={(event) => {
        if (isChrome(event.target)) return;
        zoomBy(1);
      }}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: props.height ?? 320,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
        // The gesture owns panning here; without it a real phone scrolls the
        // page instead and the map never moves. It does NOT fight the bottom
        // sheet this picker opens in: `SkinDialog`'s sheet is dragged from its
        // header/handle only (see `tokens-antd/src/skin/dialog.tsx`), so the
        // map's own surface never competes with drag-to-dismiss.
        touchAction: "none",
        cursor: grabbing ? "grabbing" : "grab",
        userSelect: "none",
      }}
    >
      <div aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
        {tiles.map((tile) => (
          <img
            // Keyed by tile ADDRESS, which is also what the url is derived
            // from — so the element and its src can never come apart, and the
            // `onError` hiding below stays attached to the right tile.
            key={`${String(tile.z)}/${String(tile.x)}/${String(tile.y)}`}
            src={tileUrl(layer.url_template, tile, subdomains)}
            alt=""
            draggable={false}
            width={TILE_SIZE}
            height={TILE_SIZE}
            style={{
              position: "absolute",
              left: tile.left,
              top: tile.top,
              width: TILE_SIZE,
              height: TILE_SIZE,
              pointerEvents: "none",
            }}
            onError={(event) => {
              // A tile that 404s must not draw the broken-image glyph: a
              // missing tile at the edge of coverage is normal, and a grid of
              // torn-page icons reads as a broken product. `visibility` rather
              // than unmounting, so nothing re-tiles and no state churns.
              event.currentTarget.style.visibility = "hidden";
            }}
            onLoad={(event) => {
              event.currentTarget.style.visibility = "visible";
            }}
          />
        ))}
      </div>

      {/* The pin is FIXED at the centre and the map moves under it — see the
          module doc. Not a drag target, so it takes no pointer events. */}
      <div
        role="img"
        aria-label={labels.pin}
        data-geo-pin=""
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: spacing[6],
          height: spacing[6],
          marginLeft: -spacing[4],
          // The point is the tip of the pin, not the centre of its head.
          marginTop: -spacing[6],
          pointerEvents: "none",
          zIndex: 3,
        }}
      >
        <svg viewBox="0 0 24 24" width="100%" height="100%" focusable="false">
          <path
            d="M12 23c0 0-8-9.1-8-14a8 8 0 1 1 16 0c0 4.9-8 14-8 14z"
            fill={token.colorPrimary}
            stroke={token.colorBgContainer}
            strokeWidth="1.5"
          />
          <circle cx="12" cy="9" r="3" fill={token.colorBgContainer} />
        </svg>
      </div>

      <div style={controlStyle}>
        <Button
          size="small"
          aria-label={labels.zoomIn}
          disabled={effectiveZoom >= max}
          // The reason is the map itself: it is already at the deepest zoom
          // this layer serves, which the tiles on screen say better than a
          // sentence would.
          data-disabled-reason="already at the layer's max_zoom"
          data-testid="geo-zoom-in"
          data-analytics="none"
          data-analytics-reason="local-ui-map-camera"
          onClick={() => {
            zoomBy(1);
          }}
        >
          <span aria-hidden="true">+</span>
        </Button>
        <Button
          size="small"
          aria-label={labels.zoomOut}
          disabled={effectiveZoom <= min}
          data-disabled-reason="already at the layer's min_zoom"
          data-testid="geo-zoom-out"
          data-analytics="none"
          data-analytics-reason="local-ui-map-camera"
          onClick={() => {
            zoomBy(-1);
          }}
        >
          <span aria-hidden="true">&minus;</span>
        </Button>
      </div>

      {/* Always. There is no prop that removes this — see the module doc. */}
      <div
        data-geo-attribution=""
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          zIndex: 2,
          maxWidth: "100%",
          padding: `${String(spacing[1])}px ${String(spacing[2])}px`,
          background: token.colorBgContainer,
          color: token.colorTextSecondary,
          fontSize: token.fontSizeSM,
          borderTopLeftRadius: token.borderRadius,
          pointerEvents: "auto",
        }}
        // Server-controlled, sanitized upstream, and the licence requires the
        // anchor it carries — escaping it would destroy the credit it exists
        // to give. Same footing as auth-react's ChannelIcon with `icon_svg`.
        dangerouslySetInnerHTML={{ __html: layer.attribution_html }}
      />
    </div>
  );
}
