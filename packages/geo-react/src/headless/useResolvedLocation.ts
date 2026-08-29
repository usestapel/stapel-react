/**
 * `useResolvedLocation` — where to open, before anyone has chosen anything.
 *
 * Every location surface in a product has the same chicken-and-egg problem: it
 * needs a centre before it has a location. There are exactly three answers to
 * it, in descending order of how much they are worth, and a product that
 * stops at the first one is broken for everybody who says no:
 *
 *  1. **the browser's position** — precise, and gated behind a one-shot prompt
 *     whose refusal is permanent. `denied` is a supported answer, not an
 *     error.
 *  2. **the caller's IP** (`GET geo/api/v1/ip`) — city-at-best, wrong behind a
 *     VPN and wrong behind a carrier's NAT, and still the difference between a
 *     map that opens on your city and a map that opens on the Gulf of Guinea.
 *  3. **the deployment's own `default_center`** — where this product lives.
 *
 * The server already collapses (2) into (3) — the IP verb answers the fallback
 * centre with `ip_resolved: false` rather than failing — so this hook is the
 * one place the FIRST rung is added, and the one place the three are named
 * apart. `source` is that name, and a UI that shows "we found you" over a
 * `default` is lying.
 *
 * ## The prompt is fired once, and it is the position request
 *
 * There is no "request geolocation permission" API: the prompt appears because
 * you asked for a position. So this hook hands `usePermission` its own
 * requester — the `getCurrentPosition` call it wanted to make anyway — and the
 * browser is asked exactly once. A hook that used `usePermission`'s default
 * requester and then called `getCurrentPosition` again would prompt once and
 * locate twice.
 *
 * Nothing here renders. The pre-prompt that has to come BEFORE the browser's
 * own is `PermissionSheet` in `@stapel/tokens-antd/skin`, and `LocationField`
 * is the default skin that wires the two together.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@stapel/core";
import type { PermissionBag } from "@stapel/core";
import { useGeoApi } from "../model/context.js";
import { geoKeys } from "../model/queryKeys.js";
import { endpointsOf } from "../api/geoApi.js";
import type { IpLocation, MapConfig } from "../api/types.js";
import type { LatLon } from "../model/coords.js";

/**
 * Which rung answered.
 *
 * - `browser` — the person's own device said so. The only precise one.
 * - `ip` — their address places them in a city. Coarse, and honest about it.
 * - `default` — nobody knows; this is where the product lives.
 * - `none` — not even that. The deployment declared no centre and the IP verb
 *   answered 204, so there is nothing to open on and a UI must ask.
 */
export type ResolvedLocationSource = "browser" | "ip" | "default" | "none";

export interface ResolvedLocation {
  readonly point: LatLon;
  readonly source: ResolvedLocationSource;
  /**
   * A place name to show, when there is one to show — the IP verb's city
   * line. `null` for a browser fix (a coordinate has no name until the
   * geocoder is asked) and for a bare configured centre.
   *
   * It is a LABEL, not an address: never store it, and never show it as the
   * answer to "where is this thing".
   */
  readonly label: string | null;
  /** The zoom that matches how much this rung actually knows. */
  readonly zoom: number;
}

export interface UseResolvedLocationOptions {
  /** The loaded `map/config`. Until it lands there is no endpoint table and
   * no `default_center`, so the bag stays empty rather than guessing. */
  readonly config: MapConfig | undefined;
  /**
   * Ask the browser immediately when permission is ALREADY granted. Default
   * `true`: a person who said yes once has answered the question, and asking
   * them to press a button to re-state it is a worse product.
   *
   * It never triggers a prompt — `granted` is the only status it acts on.
   */
  readonly autoLocate?: boolean;
  /** Skip the IP round trip entirely (a host that has its own answer). */
  readonly ip?: boolean;
  readonly timeoutMs?: number;
  readonly maximumAgeMs?: number;
}

export interface ResolvedLocationBag {
  /**
   * Where to open. `undefined` while the config is still loading; a
   * `source: "none"` location never exists — the absence IS the answer, so a
   * caller branches on `undefined` once and not on a fourth string.
   */
  readonly location: ResolvedLocation | undefined;
  /** The browser is being asked right now. */
  readonly locating: boolean;
  /** The geolocation permission, for the pre-prompt that must come first. */
  readonly permission: PermissionBag;
  /**
   * Ask the browser for a precise fix now — call this AFTER a pre-prompt has
   * been answered, or when the status is already `granted`. Resolves with the
   * rung that ended up answering, so a caller can open its picker on the
   * result without re-reading state that has not re-rendered yet.
   */
  readonly locate: () => Promise<ResolvedLocationSource>;
  /** Forget the browser fix and re-read the permission (a settings visit). */
  readonly reset: () => void;
}

function centerOfConfig(config: MapConfig | undefined): LatLon | undefined {
  // `default_center` is `[lat, lon]` — NOT GeoJSON order. The one field in
  // this contract that looks like a coordinates array and is not.
  const declared = config?.default_center;
  if (!Array.isArray(declared) || declared.length < 2) return undefined;
  const [lat, lon] = declared;
  if (typeof lat !== "number" || typeof lon !== "number") return undefined;
  return { lat, lon };
}

/** The IP verb, cached for the session. */
function useIpLocation(
  config: MapConfig | undefined,
  enabled: boolean
): IpLocation | null | undefined {
  const api = useGeoApi();
  const path = useMemo(
    () => (config ? endpointsOf(config)["ip"] : undefined),
    [config]
  );
  const query = useQuery({
    queryKey: geoKeys.ipLocation(),
    queryFn: ({ signal }) => api.ipLocation(path as string, { signal }),
    enabled: enabled && path !== undefined,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    // One coarse guess is not worth a retry ladder: the fallback below it is
    // already the answer, and a failed IP read must not delay a first frame.
    retry: false,
  });
  // A server that never shipped the verb (an older stapel-geo, or a mount
  // without it) has no `endpoints.ip`, which is the same outcome as a 204.
  if (path === undefined) return null;
  return query.data;
}

export function useResolvedLocation(
  options: UseResolvedLocationOptions
): ResolvedLocationBag {
  const { config } = options;
  const [browserPoint, setBrowserPoint] = useState<LatLon | undefined>(undefined);
  const asked = useRef(false);
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maximumAgeMs = options.maximumAgeMs ?? 120_000;

  // The requester IS the position request: one prompt, one fix. See the
  // module doc.
  const requester = useCallback(
    () =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setBrowserPoint({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            });
            resolve(position);
          },
          reject,
          {
            enableHighAccuracy: false,
            timeout: timeoutMs,
            maximumAge: maximumAgeMs,
          }
        );
      }),
    [timeoutMs, maximumAgeMs]
  );

  const permission = usePermission("geolocation", {
    requester,
    // The deployment's own answer to "should this product offer the prompt".
    offered: config?.geolocation !== false,
  });

  const ip = useIpLocation(config, options.ip !== false);

  const { request } = permission;
  const locate = useCallback(async (): Promise<ResolvedLocationSource> => {
    asked.current = true;
    const status = await request();
    if (status === "granted") return "browser";
    return "ip";
  }, [request]);

  // Already granted: the question has been answered, so answer it. This
  // cannot raise a prompt — `granted` is the only status it acts on.
  const autoLocate = options.autoLocate !== false;
  useEffect(() => {
    if (!autoLocate || asked.current) return;
    if (permission.status !== "granted") return;
    asked.current = true;
    void request();
  }, [autoLocate, permission.status, request]);

  const reset = useCallback(() => {
    asked.current = false;
    setBrowserPoint(undefined);
    permission.refresh();
  }, [permission]);

  const location = ((): ResolvedLocation | undefined => {
    if (config === undefined) return undefined;
    if (browserPoint !== undefined) {
      return {
        point: browserPoint,
        source: "browser",
        label: null,
        zoom: config.picked_zoom,
      };
    }
    if (ip !== null && ip !== undefined) {
      return {
        point: { lat: ip.lat, lon: ip.lon },
        // The server collapses "could not place you" into the fallback centre
        // and says so in-band. Re-reading that flag here is what keeps a UI
        // from announcing a city it was never told.
        source: ip.ip_resolved === true ? "ip" : "default",
        label: ip.label ?? null,
        // A city is not a street: neither rung earns `picked_zoom`.
        zoom: config.default_zoom,
      };
    }
    const declared = centerOfConfig(config);
    if (declared !== undefined) {
      return { point: declared, source: "default", label: null, zoom: config.default_zoom };
    }
    return undefined;
  })();

  return { location, locating: permission.asking, permission, locate, reset };
}
