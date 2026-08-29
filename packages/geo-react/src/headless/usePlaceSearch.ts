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
  /**
   * A suggestion was taken: put its WHOLE label in the field and close the
   * list until the text moves again.
   *
   * Without this, picking a suggestion left the field holding the fragment the
   * person typed and the dropdown still open over the answer — so the next
   * render re-searched the fragment, re-opened the same list, and the only way
   * out was to click somewhere else. A chosen place is an answer, and an
   * answer closes its question.
   */
  accept: (label: string) => void;
  /**
   * The field is holding an accepted suggestion. A dropdown MUST NOT be drawn
   * while this is true — and it goes false the moment the text differs from
   * the label that was accepted, which is what makes the list come back when
   * the person edits rather than only when they clear.
   */
  readonly chosen: boolean;
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
  /**
   * The map's current centre, sent as a soft bias so results are local.
   *
   * Read BY VALUE, never by identity: `bias={{ lat, lon }}` written inline is
   * a fresh object on every render, and an effect that depended on it would
   * re-fire, re-render, and re-fire — an infinite loop in the most natural
   * way to call this hook. The two numbers are the dependency.
   */
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
  const [query, setQueryState] = useState("");
  /** The label currently sitting in the field because it was CHOSEN, not
   * typed. `null` once the two differ again. */
  const [accepted, setAccepted] = useState<string | null>(null);
  const [results, setResults] = useState<LoadState<readonly PlaceSuggestion[]>>(
    loadReady([])
  );
  const [availability, setAvailability] = useState<GeocoderAvailability>("available");
  /** The last answer that actually arrived. A 429 is the server asking for
   * quiet, not telling the person their search failed — so the suggestions
   * they are looking at have to survive it, which means remembering them
   * rather than merely declining to overwrite them with an error. */
  const lastReady = useRef<readonly PlaceSuggestion[]>([]);
  const [lastLang, setLastLang] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const inFlight = useRef<AbortController | null>(null);

  const path = useMemo(() => (config ? endpointsOf(config)["search"] : undefined), [config]);
  const minChars = (config as { search_min_chars?: number } | undefined)?.search_min_chars ?? 3;
  const debounceMs =
    (config as { search_debounce_ms?: number } | undefined)?.search_debounce_ms ?? 350;

  const trimmed = query.trim();
  const chosen = accepted !== null && accepted === query;
  // `chosen` suppresses the request as well as the list: there is nothing to
  // learn from asking the geocoder to look up the answer it just gave.
  const idle = trimmed.length < minChars || chosen;
  // By value (see `UsePlaceSearchOptions.bias`).
  const biasLat = bias?.lat;
  const biasLon = bias?.lon;

  useEffect(() => {
    if (path === undefined) return;
    if (idle) {
      inFlight.current?.abort();
      inFlight.current = null;
      lastReady.current = [];
      // A fresh `[]` every pass would be a new state value every render, which
      // is the other half of the same loop the bias-by-value note describes.
      setResults((prev) =>
        prev.status === "ready" && prev.data.length === 0 ? prev : loadReady([])
      );
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
            ...(biasLat !== undefined && biasLon !== undefined
              ? {
                  bias: {
                    lat: biasLat,
                    lon: biasLon,
                    ...(zoom !== undefined ? { zoom } : {}),
                  },
                }
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
          lastReady.current = suggestions;
          setResults(loadReady(suggestions));
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const why = availabilityOf(error);
          setAvailability(why);
          // A rate limit is the server asking for quiet. The last good
          // suggestions are PUT BACK — not merely left un-overwritten, which
          // was the bug: `loadLoading()` had already been set before the
          // request, so declining to write a failure left the bag spinning for
          // the whole throttle window while its own doc promised the previous
          // list. Replacing them with a red box would report a fault that did
          // not happen; leaving a spinner reports one that never ends.
          setResults(why === "throttled" ? loadReady(lastReady.current) : loadFailed(error));
        });
    }, debounceMs);
    return () => {
      clearTimeout(timer);
    };
  }, [api, path, trimmed, idle, debounceMs, biasLat, biasLon, zoom, lang, nonce]);

  useEffect(
    () => () => {
      inFlight.current?.abort();
    },
    []
  );

  const retry = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  const setQuery = useCallback((next: string) => {
    setQueryState(next);
    // Any edit — one character, a paste, a clear — reopens the question.
    setAccepted((current) => (current === null || current === next ? current : null));
  }, []);

  const accept = useCallback((label: string) => {
    setQueryState(label);
    setAccepted(label);
  }, []);

  return {
    query,
    setQuery,
    accept,
    results,
    availability,
    lang: lastLang,
    // `idle` folds "too short to ask" and "already answered" together, because
    // every caller of it wants the same thing: do not draw a list. `chosen`
    // is beside it for the one caller that must tell them apart — the field's
    // own "keep typing" hint, which has no business appearing under an answer
    // the person just chose.
    idle,
    chosen,
    retry,
  };
}
