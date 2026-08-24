import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadFailed, loadLoading, loadReady } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { endpointsOf } from "../api/geoApi.js";
import { useGeoApi } from "../model/context.js";
import { availabilityOf } from "../model/availability.js";
import type { GeocoderAvailability } from "../model/availability.js";
import { fromGeoJson } from "../model/coords.js";
import type { LatLon } from "../model/coords.js";
import type { GeocodeFeature, MapConfig } from "../api/types.js";

/** One suggestion, with the axis swap already done and the display line the
 * SERVER built — never reassembled here (see {@link PlaceSuggestion.label}). */
export interface PlaceSuggestion {
  /** Stable within one answer: the OSM identity when the provider gave one,
   * else the position in the list. Never an array index alone — a list that
   * re-sorts under an index key re-uses the wrong row. */
  readonly id: string;
  /**
   * The line to show. `properties.formatted` off the wire, because the server
   * already ordered it for the country — street-then-number in much of
   * Europe, number-then-street in the US — and a host can change that rule
   * fleet-wide with one setting. Reassembling name/street/house/city here
   * would silently pick one country's order for all of them.
   */
  readonly label: string;
  readonly point: LatLon;
  readonly feature: GeocodeFeature;
}

export interface PlaceSearchBag {
  /** What the field currently holds. */
  readonly query: string;
  setQuery: (next: string) => void;
  /** The suggestions. `ready` with an EMPTY list is an empty state — nothing
   * matched — and is deliberately not a failure (contract §6). */
  readonly results: LoadState<readonly PlaceSuggestion[]>;
  /** Why the geocoder is not answering, when it is not. */
  readonly availability: GeocoderAvailability;
  /** The language the provider was ACTUALLY asked for, once an answer has
   * landed. Send `default`/nothing and read this back (contract §4). */
  readonly lang: string | null;
  /** Below `search_min_chars` nothing has been asked yet — which is not the
   * same as "no results", and a field that showed an empty state here would
   * be telling a person their two letters matched nothing. */
  readonly idle: boolean;
  retry: () => void;
}

export interface UsePlaceSearchOptions {
  /** The loaded map config — the source of the endpoint path and of the
   * debounce/min-chars discipline the deployment set. */
  readonly config: MapConfig | undefined;
  /** The map's current centre, sent as a soft bias so results are local. */
  readonly bias?: LatLon | undefined;
  readonly zoom?: number | undefined;
  /** See `SearchQuery.lang` — leave unset. */
  readonly lang?: string | undefined;
}

function idOf(feature: GeocodeFeature, index: number): string {
  const p = feature.properties as { osm_type?: string | null; osm_id?: number | null };
  return p.osm_type != null && p.osm_id != null
    ? `${p.osm_type}${String(p.osm_id)}`
    : `idx-${String(index)}`;
}

/**
 * Search-as-you-type, with the two disciplines the contract ships numbers for
 * and the one it does not.
 *
 * **Debounce** (`search_debounce_ms`) and **minimum length**
 * (`search_min_chars`) come off `map/config`, not off a constant here: they
 * are the deployment's operating discipline, and the reason they exist is that
 * one keystroke must not become one upstream request. A component that hard
 * codes 300ms has overridden a decision the operator made.
 *
 * **Cancellation** is the one the server cannot ship: every superseded request
 * is aborted, because otherwise the answer to a three-letter prefix can land
 * after the answer to the whole word and overwrite it — the classic
 * out-of-order autocomplete bug, which looks to a person like the field
 * ignoring what they typed.
 *
 * A 429 does NOT clear the list. Throttling is the server asking for quiet,
 * not telling the person their search failed; the last good suggestions stay
 * on screen and `availability` says why nothing new is arriving.
 */
export function usePlaceSearch(options: UsePlaceSearchOptions): PlaceSearchBag {
  const api = useGeoApi();
  const { config, bias, zoom, lang } = options;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LoadState<readonly PlaceSuggestion[]>>(
    loadReady([])
  );
  const [availability, setAvailability] = useState<GeocoderAvailability>("available");
  const [lastLang, setLastLang] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const inFlight = useRef<AbortController | null>(null);

  const path = useMemo(() => (config ? endpointsOf(config)["search"] : undefined), [config]);
  const minChars = (config as { search_min_chars?: number } | undefined)?.search_min_chars ?? 3;
  const debounceMs =
    (config as { search_debounce_ms?: number } | undefined)?.search_debounce_ms ?? 350;

  const trimmed = query.trim();
  const idle = trimmed.length < minChars;

  useEffect(() => {
    if (path === undefined) return;
    if (idle) {
      inFlight.current?.abort();
      inFlight.current = null;
      setResults(loadReady([]));
      return;
    }
    const timer = setTimeout(() => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      setResults(loadLoading());
      api
        .search(
          path,
          {
            q: trimmed,
            ...(bias !== undefined
              ? { bias: { lat: bias.lat, lon: bias.lon, ...(zoom !== undefined ? { zoom } : {}) } }
              : {}),
            ...(lang !== undefined ? { lang } : {}),
          },
          { signal: controller.signal }
        )
        .then((answer) => {
          if (controller.signal.aborted) return;
          setAvailability("available");
          setLastLang(answer.lang ?? null);
          const features = answer.features ?? [];
          const suggestions: PlaceSuggestion[] = [];
          features.forEach((feature, index) => {
            const point = fromGeoJson(feature.geometry.coordinates);
            if (point === null) return;
            const label = feature.properties.formatted;
            if (label === null || label === undefined || label === "") return;
            suggestions.push({ id: idOf(feature, index), label, point, feature });
          });
          setResults(loadReady(suggestions));
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const why = availabilityOf(error);
          setAvailability(why);
          // A rate limit is the server asking for quiet. Keeping the last good
          // suggestions is the honest thing to show; replacing them with a red
          // box would report a fault that did not happen.
          if (why !== "throttled") setResults(loadFailed(error));
        });
    }, debounceMs);
    return () => {
      clearTimeout(timer);
    };
  }, [api, path, trimmed, idle, debounceMs, bias, zoom, lang, nonce]);

  useEffect(
    () => () => {
      inFlight.current?.abort();
    },
    []
  );

  const retry = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  return { query, setQuery, results, availability, lang: lastLang, idle, retry };
}
