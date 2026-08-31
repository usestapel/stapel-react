import { useCallback, useEffect, useRef, useState } from "react";
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
  /**
   * How long an UNANSWERED browser prompt is waited on before this attempt is
   * given up on. Default 20s — see {@link DECISION_TIMEOUT_MS}.
   *
   * It must be longer than {@link UseBrowserPositionOptions.timeoutMs}: a
   * prompt that WAS answered with "allow" is bounded by the Geolocation API's
   * own `timeout` (which fires `code: 3`), and this deadline exists only for
   * the case where no callback will ever come.
   */
  readonly decisionTimeoutMs?: number;
}

/**
 * How long an unanswered prompt is waited on.
 *
 * The Geolocation spec STOPS the `timeout` clock while the permission
 * decision is pending, so a person who swipes the browser's prompt away —
 * or whose browser blocks the site without telling the page — leaves
 * `getCurrentPosition` hanging for as long as the page is open: neither the
 * success nor the error callback ever fires, `timeout` or no `timeout`.
 *
 * The button on top of that spun for as long as it was watched (measured
 * on a live classified deployment: >30s of "Finding you…" over a live map,
 * with no way out but a reload). `@stapel/core`'s `usePermission` had
 * carried this bound for four releases — `decisionTimeoutMs`, the same 20s —
 * but the picker's button does not go through it: it calls the browser
 * directly, and so it needed the same deadline of its own.
 *
 * 20s and not 10s because the geolocation call's OWN `timeout` is 10s: a
 * fix that is merely slow must be allowed to fail as `code: 3` first, so
 * that "we could not place you" and "you never answered" stay two different
 * sentences.
 */
export const DECISION_TIMEOUT_MS = 20_000;

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

/**
 * What the Permissions API says about geolocation RIGHT NOW, for the one
 * moment it decides something: the deadline.
 *
 * A silent prompt has two causes that read identically from
 * `getCurrentPosition` — the person walked away from it, and the browser
 * refused on their behalf without a callback — and they deserve different
 * sentences. Everything about this read is optional: Safari throws on the
 * descriptor, Firefox may not know the name, and a page can be in a context
 * with no `navigator` at all. Any of those is simply "we do not know", which
 * is what the timeout outcome already says.
 */
async function deniedByPermissionsApi(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined") return false;
    const permissions = (navigator as Navigator & { permissions?: Permissions })
      .permissions;
    if (permissions?.query === undefined) return false;
    const result = await permissions.query({
      name: "geolocation",
    } as unknown as PermissionDescriptor);
    return result.state === "denied";
  } catch {
    return false;
  }
}

export function useBrowserPosition(
  options: UseBrowserPositionOptions = {}
): BrowserPositionBag {
  const [state, setState] = useState<PositionState>({ step: "idle" });
  const supported = isGeolocationSupported() && options.offered !== false;
  const decisionTimeoutMs = options.decisionTimeoutMs ?? DECISION_TIMEOUT_MS;

  // Which attempt is the live one. A callback that arrives after its attempt
  // was given up on (or after another `locate()` replaced it) must not repaint
  // the control, and neither must anything at all after unmount.
  const attempt = useRef(0);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      attempt.current += 1;
      if (deadline.current !== undefined) clearTimeout(deadline.current);
    },
    []
  );

  const locate = useCallback(() => {
    if (!isGeolocationSupported()) {
      setState({ step: "refused", outcome: "unsupported" });
      return;
    }
    attempt.current += 1;
    const generation = attempt.current;
    if (deadline.current !== undefined) clearTimeout(deadline.current);
    /** Only the live attempt writes, and only once. */
    const settle = (next: PositionState): void => {
      if (generation !== attempt.current) return;
      attempt.current += 1;
      if (deadline.current !== undefined) clearTimeout(deadline.current);
      deadline.current = undefined;
      setState(next);
    };
    setState({ step: "locating" });
    // The prompt is under no obligation to be answered, and an unanswered one
    // never calls back — so the spinner needs an end that does not depend on
    // the browser having one. See DECISION_TIMEOUT_MS.
    deadline.current = setTimeout(() => {
      void deniedByPermissionsApi().then((denied) => {
        settle({ step: "refused", outcome: denied ? "denied" : "timeout" });
      });
    }, decisionTimeoutMs);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        settle({
          step: "located",
          point: { lat: position.coords.latitude, lon: position.coords.longitude },
          accuracyM:
            typeof position.coords.accuracy === "number" ? position.coords.accuracy : null,
        });
      },
      (error: { readonly code?: number }) => {
        settle({ step: "refused", outcome: outcomeOf(error) });
      },
      {
        enableHighAccuracy: false,
        timeout: options.timeoutMs ?? 10_000,
        maximumAge: options.maximumAgeMs ?? 120_000,
      }
    );
  }, [options.timeoutMs, options.maximumAgeMs, decisionTimeoutMs]);

  const reset = useCallback(() => {
    attempt.current += 1;
    if (deadline.current !== undefined) clearTimeout(deadline.current);
    deadline.current = undefined;
    setState({ step: "idle" });
  }, []);

  return { state, supported, locate, reset };
}
