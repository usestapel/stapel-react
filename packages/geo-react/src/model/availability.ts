import { isStapelApiError } from "@stapel/core";

/**
 * Why the geocoder did not answer — because "it refused me" and "it is down"
 * are two different sentences, two different next actions, and only one of
 * them is a fault.
 *
 * The contract makes this a first-class design constraint rather than a nicety
 * (§5): the four geocoding verbs default to `IsAuthenticated`, so **an
 * anonymous visitor gets 401/403 as the deployment's normal configuration**.
 * If a picker treated that as an error it would tell every signed-out visitor
 * that something had broken, and — worse — most implementations would then
 * hide the map, which still works perfectly. The map and the pin do not depend
 * on the geocoder at all; only the ADDRESS does.
 */
export type GeocoderAvailability =
  /** Working, or not yet asked. */
  | "available"
  /** 401/403 — this deployment does not offer geocoding to this caller. Not a
   * fault: sign in, or the product opens it to `AllowAny`. */
  | "unauthorized"
  /** 429 — respect it and stop firing. Keep the last good suggestions on
   * screen; a rate limit is not worth a red error. */
  | "throttled"
  /** 502 `error.502.geocoder_unavailable` — the upstream provider is
   * unreachable. RETRYABLE, unlike everything a 400 means. */
  | "unavailable"
  /** Anything else: a real fault worth stating plainly. */
  | "failed";

/** The status codes that mean each thing, read off the error the transport
 * produced — never off a hand-built shape. */
export function availabilityOf(error: unknown): GeocoderAvailability {
  if (error === null || error === undefined) return "available";
  if (isStapelApiError(error)) {
    const status = error.status;
    // eslint-disable-next-line stapel/no-adhoc-401 -- Not session handling. Core's client has already run the refresh seam by the time this value exists; what is left is the deployment's PERMISSION answer for these four verbs (GEOCODER_PERMISSIONS defaults to authenticated-only), which is a configuration fact this pair must render as a state rather than a fault. Refreshing a token would not change it, and treating it as a session loss would sign a browsing visitor out of the page they are on.
    if (status === 401 || status === 403) return "unauthorized";
    if (status === 429) return "throttled";
    if (status === 502 || error.code === "error.502.geocoder_unavailable") {
      return "unavailable";
    }
    return "failed";
  }
  return "failed";
}

/** Is it worth trying again on its own? 502 is; 400 and 401 are not, and a
 * client that retried them would burn the throttle for nothing. */
export function isRetryable(availability: GeocoderAvailability): boolean {
  return availability === "unavailable" || availability === "failed";
}
