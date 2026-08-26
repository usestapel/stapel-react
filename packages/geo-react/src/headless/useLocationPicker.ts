import { useCallback, useEffect, useRef, useState } from "react";
import { endpointsOf } from "../api/geoApi.js";
import { useGeoApi } from "../model/context.js";
import { availabilityOf } from "../model/availability.js";
import type { GeocoderAvailability } from "../model/availability.js";
import type { LatLon } from "../model/coords.js";
import type { MapConfig, PlaceResolution } from "../api/types.js";

/**
 * What a product gets back when someone finishes choosing a place.
 *
 * `geohash` and `address` are `null` whenever the geocoder could not be
 * reached — an anonymous caller under the default permissions, a throttled
 * one, a 502. That is deliberate and it is the honest shape: the coordinate is
 * the person's own answer and is always real, while the geohash is computed
 * SERVER-side at the deployment's configured precision and the address is the
 * geocoder's. Computing a geohash here to fill the hole would put a second,
 * unreconciled implementation of the deployment's precision in the browser.
 */
export interface PickedLocation {
  readonly point: LatLon;
  readonly geohash: string | null;
  /** The one-line label the SERVER built. `null` when unresolved, and `""` is
   * a real answer meaning "there is no address here" (the middle of a lake). */
  readonly address: string | null;
  readonly resolution: PlaceResolution | null;
}

export type ResolveState =
  | { readonly step: "idle" }
  | { readonly step: "resolving" }
  | { readonly step: "resolved"; readonly resolution: PlaceResolution }
  /** A SUCCESSFUL call that matched nothing. An empty state, not a failure —
   * the middle of a lake has coordinates too (contract §2.5). */
  | { readonly step: "nowhere"; readonly resolution: PlaceResolution }
  | { readonly step: "refused"; readonly availability: GeocoderAvailability };

export interface LocationPickerBag {
  /** Where the pin is. Always present once the map has a centre — this is the
   * value that never depends on the geocoder. */
  readonly point: LatLon | undefined;
  readonly resolve: ResolveState;
  /** The answer to hand a product, or `undefined` before a pin exists. */
  readonly picked: PickedLocation | undefined;
  /** Move the pin. Debounced resolution follows; a drag that passes over
   * fifty coordinates must not become fifty reverse-geocoding calls. */
  moveTo: (point: LatLon) => void;
  retry: () => void;
}

export interface UseLocationPickerOptions {
  readonly config: MapConfig | undefined;
  readonly initial?: LatLon | undefined;
  /**
   * The answer this pair ALREADY has for {@link UseLocationPickerOptions.initial}
   * — the address a product stored the last time someone picked this point.
   *
   * Supplying it does two things, and the second is the reason it exists.
   * The pin opens with its address on screen instead of a blank line that
   * fills in half a second later; and the first reverse-geocode is SKIPPED,
   * because asking the geocoder to re-answer a question whose answer is in the
   * form is one authenticated call per mount of every edit screen. Under the
   * deployment's default permissions it is worse than wasteful: a signed-out
   * visitor opening a stored location would be told the address is
   * unavailable while it sits in the field above.
   *
   * A `PlaceResolution` with no `feature` and no `formatted` is a stored
   * "there is no address here" and opens on `nowhere` — the middle of a lake
   * was a successful answer then and is a successful answer now. Any move of
   * the pin re-resolves as usual; this seeds the opening state only.
   */
  readonly initialResolution?: PlaceResolution | undefined;
  /** How many known `Location` rows to ask for. **0 by default — the
   * reference tree is not queried at all**, per the contract, so a picker that
   * does not use them costs nothing. */
  readonly nearest?: number;
  /** Idle time before a moved pin becomes a request. */
  readonly settleMs?: number;
  readonly lang?: string | undefined;
}

/**
 * The pin, and the address that follows it.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO.
 *
 * It does not move the pin to the geocoder's answer. `feature.geometry` can
 * differ from the `lat`/`lon` asked about — the geocoder snaps to whatever
 * object it matched, which for a building-level pin can be tens of metres
 * away. The contract says to decide deliberately which one is stored and to
 * show the same one; this pair stores and shows THE PERSON'S PIN, because the
 * person put it there and watching it jump after a pause is the single most
 * disorienting thing a map picker can do.
 *
 * It does not treat an empty answer as a failure. A successful call with no
 * feature means "no address here", which is a sentence to render, not a red
 * box (`"nowhere"`).
 */
/** A resolution is `nowhere` when the call SUCCEEDED and matched nothing —
 * the same test the network answer goes through, so a stored answer and a
 * fresh one cannot be classified two different ways. */
function stateForResolution(resolution: PlaceResolution): ResolveState {
  const formatted = resolution.formatted;
  const nothing =
    (resolution.feature === null || resolution.feature === undefined) &&
    (formatted === null || formatted === undefined);
  return nothing ? { step: "nowhere", resolution } : { step: "resolved", resolution };
}

/** Identity of a pin, for "have we already been handed this one's answer". */
function pointKey(point: LatLon): string {
  return `${String(point.lat)},${String(point.lon)}`;
}

export function useLocationPicker(options: UseLocationPickerOptions): LocationPickerBag {
  const api = useGeoApi();
  const { config, initial, initialResolution, nearest = 0, settleMs = 400, lang } = options;
  const [point, setPoint] = useState<LatLon | undefined>(initial);
  const [resolve, setResolve] = useState<ResolveState>(() =>
    initialResolution !== undefined && initial !== undefined
      ? stateForResolution(initialResolution)
      : { step: "idle" }
  );
  const [nonce, setNonce] = useState(0);
  const inFlight = useRef<AbortController | null>(null);
  /**
   * The one pin whose answer arrived with the props. Cleared the moment the
   * pin moves or a retry is asked for, so this suppresses exactly one request
   * — the redundant one — and never a real question.
   */
  const seededFor = useRef<string | null>(
    initialResolution !== undefined && initial !== undefined ? pointKey(initial) : null
  );

  const path = config ? endpointsOf(config)["resolve"] : undefined;

  useEffect(() => {
    if (point === undefined || path === undefined) return;
    if (seededFor.current !== null) {
      if (seededFor.current === pointKey(point) && nonce === 0) return;
      seededFor.current = null;
    }
    const timer = setTimeout(() => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      setResolve({ step: "resolving" });
      api
        .resolve(
          path,
          {
            lat: point.lat,
            lon: point.lon,
            nearest,
            ...(lang !== undefined ? { lang } : {}),
          },
          { signal: controller.signal }
        )
        .then((resolution) => {
          if (controller.signal.aborted) return;
          setResolve(stateForResolution(resolution));
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setResolve({ step: "refused", availability: availabilityOf(error) });
        });
    }, settleMs);
    return () => {
      clearTimeout(timer);
    };
  }, [api, path, point, nearest, settleMs, lang, nonce]);

  useEffect(
    () => () => {
      inFlight.current?.abort();
    },
    []
  );

  const moveTo = useCallback((next: LatLon) => {
    setPoint(next);
  }, []);

  const retry = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  const resolution =
    resolve.step === "resolved" || resolve.step === "nowhere" ? resolve.resolution : null;

  const picked: PickedLocation | undefined =
    point === undefined
      ? undefined
      : {
          point,
          geohash: resolution?.geohash ?? null,
          address: resolution === null ? null : resolution.formatted ?? null,
          resolution,
        };

  return { point, resolve, picked, moveTo, retry };
}
