import { useCallback, useState } from "react";
import type { LatLon } from "../model/coords.js";

/**
 * What the browser's geolocation prompt answered.
 *
 * The server never sees any of this — the prompt, its refusal and its timeout
 * are entirely the component's, which is why the contract lists them under
 * "what geo-react still owns". Four outcomes, not one, because they need four
 * different sentences and three different next actions:
 *
 *  - `denied` — the person said no, or the site is blocked in browser
 *    settings. Asking again does nothing: the browser will not re-prompt. The
 *    only way forward is the search field or the map, so say that.
 *  - `unavailable` — the device has no fix (no GPS, no network positioning).
 *    Retrying can genuinely work later.
 *  - `timeout` — nothing arrived inside the budget. Retrying is the obvious
 *    thing and usually works.
 *  - `unsupported` — no `navigator.geolocation` at all (an old browser, a
 *    non-secure context). There is nothing to offer, so the control should not
 *    be on screen at all rather than disabled with an explanation.
 */
export type PositionOutcome = "denied" | "unavailable" | "timeout" | "unsupported";

export type PositionState =
  | { readonly step: "idle" }
  | { readonly step: "locating" }
  | { readonly step: "located"; readonly point: LatLon; readonly accuracyM: number | null }
  | { readonly step: "refused"; readonly outcome: PositionOutcome };

export interface BrowserPositionBag {
  readonly state: PositionState;
  /** Whether the control should exist at all. `false` where the browser has
   * no geolocation API, or where the deployment turned the offer off
   * (`map/config.geolocation === false`). */
  readonly supported: boolean;
  locate: () => void;
  reset: () => void;
}

export interface UseBrowserPositionOptions {
  /** `map/config.geolocation` — the deployment's own answer to "should this
   * product offer the prompt at all". */
  readonly offered?: boolean;
  readonly timeoutMs?: number;
  /** Seconds a cached fix stays acceptable. A picker does not need a fresh
   * satellite lock; a two-minute-old position is the same street. */
  readonly maximumAgeMs?: number;
}

function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.geolocation?.getCurrentPosition === "function";
}

/** `GeolocationPositionError` codes are 1/2/3 and the constants are on the
 * INSTANCE, which is undefined in an environment that ships no geolocation —
 * so the numbers are read directly rather than through `err.PERMISSION_DENIED`,
 * which is the idiom that throws in exactly the environments this has to
 * survive. */
function outcomeOf(error: { readonly code?: number } | undefined): PositionOutcome {
  switch (error?.code) {
    case 1:
      return "denied";
    case 2:
      return "unavailable";
    case 3:
      return "timeout";
    default:
      return "unavailable";
  }
}

export function useBrowserPosition(
  options: UseBrowserPositionOptions = {}
): BrowserPositionBag {
  const [state, setState] = useState<PositionState>({ step: "idle" });
  const supported = isGeolocationSupported() && options.offered !== false;

  const locate = useCallback(() => {
    if (!isGeolocationSupported()) {
      setState({ step: "refused", outcome: "unsupported" });
      return;
    }
    setState({ step: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          step: "located",
          point: { lat: position.coords.latitude, lon: position.coords.longitude },
          accuracyM:
            typeof position.coords.accuracy === "number" ? position.coords.accuracy : null,
        });
      },
      (error: { readonly code?: number }) => {
        setState({ step: "refused", outcome: outcomeOf(error) });
      },
      {
        enableHighAccuracy: false,
        timeout: options.timeoutMs ?? 10_000,
        maximumAge: options.maximumAgeMs ?? 120_000,
      }
    );
  }, [options.timeoutMs, options.maximumAgeMs]);

  const reset = useCallback(() => {
    setState({ step: "idle" });
  }, []);

  return { state, supported, locate, reset };
}
