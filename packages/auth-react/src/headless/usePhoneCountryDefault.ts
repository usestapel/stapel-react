import { useEffect, useRef, useState } from "react";

/**
 * A small built-in ISO 3166-1 alpha-2 → E.164 dial-code table covering the
 * common cases. Deliberately NOT exhaustive — a host with fuller coverage
 * needs supplies its own via `dialCodes` (merged over this default).
 */
export const DEFAULT_DIAL_CODES: Readonly<Record<string, string>> = {
  US: "+1",
  CA: "+1",
  GB: "+44",
  IE: "+353",
  FR: "+33",
  DE: "+49",
  ES: "+34",
  IT: "+39",
  PT: "+351",
  NL: "+31",
  BE: "+32",
  CH: "+41",
  AT: "+43",
  SE: "+46",
  NO: "+47",
  DK: "+45",
  FI: "+358",
  PL: "+48",
  UA: "+380",
  RU: "+7",
  KZ: "+7",
  TR: "+90",
  IL: "+972",
  AE: "+971",
  SA: "+966",
  IN: "+91",
  CN: "+86",
  JP: "+81",
  KR: "+82",
  SG: "+65",
  AU: "+61",
  NZ: "+64",
  BR: "+55",
  MX: "+52",
  AR: "+54",
  ZA: "+27",
};

export interface UsePhoneCountryDefaultOptions {
  /**
   * Turn the lookup on. **Default `false`.** This hook is OFF by default on
   * purpose: resolving a visitor's country from their IP is a privacy-
   * sensitive network call the host must opt into explicitly, not something
   * `@stapel/auth-react` does behind anyone's back. Flipping it on is a
   * one-line change: `usePhoneCountryDefault({ enabled: true, endpoint })`.
   */
  readonly enabled?: boolean;
  /**
   * URL of a JSON endpoint returning `{ "country": "US" }` (ISO 3166-1
   * alpha-2) for the caller's IP — point this at your own backend (a
   * stapel-auth deployment can expose one backed by core's `netintel`
   * `IpProfile.country`) or a third-party geo-IP service. Required when
   * `enabled` is true; the hook no-ops without it.
   */
  readonly endpoint?: string;
  /** Merged OVER `DEFAULT_DIAL_CODES` — supply just the countries you need to
   * add or correct. */
  readonly dialCodes?: Readonly<Record<string, string>>;
  /** Injectable for tests / non-browser runtimes. Default global `fetch`. */
  readonly fetchImpl?: typeof fetch;
  /** Parse the endpoint's response into an ISO alpha-2 country code. Default
   * reads `body.country`. */
  readonly parseResponse?: (body: unknown) => string | null;
}

export interface PhoneCountryDefault {
  /** ISO 3166-1 alpha-2, e.g. `"US"`. `null` before resolution / on error / when disabled. */
  readonly countryCode: string | null;
  /** E.164 dial code for `countryCode`, e.g. `"+1"`. `null` when unresolved
   * or the country isn't in the (possibly host-extended) table. */
  readonly dialCode: string | null;
  readonly isLoading: boolean;
  readonly error: unknown;
}

const IDLE: PhoneCountryDefault = {
  countryCode: null,
  dialCode: null,
  isLoading: false,
  error: null,
};

function defaultParse(body: unknown): string | null {
  if (body && typeof body === "object" && "country" in body) {
    const c = (body as { country: unknown }).country;
    return typeof c === "string" && c.length > 0 ? c.toUpperCase() : null;
  }
  return null;
}

/**
 * Resolve a visitor's likely phone-input country from an IP→country lookup,
 * for pre-filling the phone channel's dial-code prefix. **Off by default** —
 * see `enabled` above. Not wired into `<AuthPanel/>`'s phone panel
 * automatically for the same reason; a host composes it in:
 *
 * ```tsx
 * const { dialCode } = usePhoneCountryDefault({ enabled: true, endpoint: "/geo/country" });
 * <Input addonBefore={dialCode ?? "+1"} … />
 * ```
 */
export function usePhoneCountryDefault(
  options: UsePhoneCountryDefaultOptions = {}
): PhoneCountryDefault {
  const { enabled = false, endpoint } = options;
  const [state, setState] = useState<PhoneCountryDefault>(IDLE);

  // `dialCodes`/`fetchImpl`/`parseResponse` are read via a ref, NOT put in the
  // effect's dependency array: a caller passing an inline object/function
  // literal (the common case — `usePhoneCountryDefault({ dialCodes: {...} })`)
  // would otherwise get a new reference every render, re-running the fetch
  // effect every render → setState → re-render → new reference → infinite
  // fetch loop. Only `enabled`/`endpoint` (primitives) legitimately restart
  // the lookup.
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    if (!enabled || !endpoint) {
      setState(IDLE);
      return;
    }
    let cancelled = false;
    const doFetch =
      latest.current.fetchImpl ?? (typeof fetch !== "undefined" ? fetch : undefined);
    if (!doFetch) {
      setState({ ...IDLE, error: new Error("No fetch implementation available") });
      return;
    }
    setState({ ...IDLE, isLoading: true });
    void (async () => {
      try {
        const res = await doFetch(endpoint);
        if (!res.ok) throw new Error(`Country lookup failed: ${res.status}`);
        const body: unknown = await res.json();
        const parse = latest.current.parseResponse ?? defaultParse;
        const countryCode = parse(body);
        if (cancelled) return;
        const table = { ...DEFAULT_DIAL_CODES, ...latest.current.dialCodes };
        setState({
          countryCode,
          dialCode: countryCode ? (table[countryCode] ?? null) : null,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        setState({ ...IDLE, error });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately NOT exhaustive — see the `latest` ref comment above.
  }, [enabled, endpoint]);

  return state;
}
