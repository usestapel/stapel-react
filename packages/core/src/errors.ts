/**
 * The Stapel backend error envelope:
 * `{ localizable_error: "auth.otp.invalid", error: "Invalid OTP", params: {...} }`
 * `localizable_error` is an i18n key; `params` feed `{param}` interpolation.
 * `language` (optional — backends are rolling this out) is the BCP-47/locale
 * tag the envelope's `error` text is actually written in, e.g. from
 * `Accept-Language`; see `formatFlowError` in `./flows/flowError.js`, which
 * only trusts `error` as a display fallback when this matches the host's
 * current locale.
 */
export interface StapelErrorEnvelope {
  readonly localizable_error?: string;
  readonly error?: string;
  readonly params?: Record<string, unknown>;
  readonly language?: string;
}

export class StapelApiError extends Error {
  /** i18n key from `localizable_error` (fallback: `stapel.http.<status>`). */
  readonly code: string;
  /** Interpolation params for the i18n key. */
  readonly params: Readonly<Record<string, unknown>>;
  /** HTTP status code. */
  readonly status: number;
  /** Raw (parsed) response body, for diagnostics and extensions. */
  readonly body: unknown;
  /** The locale tag `message` (this error's own `.message`, from the
   * envelope's `error` text) is written in, when the backend sends one. */
  readonly language: string | undefined;

  constructor(args: {
    code: string;
    message: string;
    params?: Record<string, unknown>;
    status: number;
    body?: unknown;
    language?: string;
  }) {
    super(args.message);
    this.name = "StapelApiError";
    this.code = args.code;
    this.params = args.params ?? {};
    this.status = args.status;
    this.body = args.body;
    this.language = args.language;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ── One dialect ─────────────────────────────────────────────────────────────
//
// A Stapel failure reaches a call site in one of TWO shapes, and the whole
// point of this section is that no call site should have to know which:
//
//   1. `StapelApiError` — what `createStapelClient` throws. Typed, carries
//      `.code` + `.status` + `.params`.
//   2. The RAW envelope — `{localizable_error, error, params}`, a plain
//      object with NO `.status`, thrown by any second transport that hands
//      back the parsed response body instead of core's error (the common
//      case: an `openapi-fetch`-style client whose `{ data, error }` result
//      is rethrown as `if (error) throw error`).
//
// The failure this closes is not academic. A component that discriminated
// states with `(e as { status?: number })?.status === 404` against dialect 2
// had a branch that could never be true — the cast silenced the one check
// that would have caught it — so "the AI found nothing" was said about a
// meeting nobody had analysed. Same shape, different consequence, in the
// default query retry predicate: `undefined` status means a doomed 4xx is
// retried.
//
// The cure, in order of preference:
//   a. The transport wraps: `throw toStapelApiError(body, response.status)`
//      at the ONE place that rethrows, so call sites only ever see dialect 1.
//   b. Call sites narrow with `isStapelApiError` / `hasErrorCode` /
//      `errorCodePredicate` — never with a cast.
// `stapel/no-raw-error-shape` (@stapel/eslint-plugin) enforces that casts and
// bare `.status`/`.code` reads on a caught value stay inside the error layer.
//
// TESTING NOTE (the honest boundary): this class does NOT fall out of unit
// tests, because the author of the mock holds the same wrong assumption as
// the author of the code — mock `{ status: 404 }`, and the test is green
// against a shape production never sends. The only test that does not
// reproduce the assumption mocks THE WIRE (HTTP interception with a real
// envelope body, through the real transport), not the module. See
// CONTRIBUTING.md "Mock the wire, not the module".

/**
 * Type guard for core's typed API error — the ONE sanctioned way to narrow a
 * caught value before reading `.status`/`.code`/`.params` off it.
 */
export function isStapelApiError(value: unknown): value is StapelApiError {
  return value instanceof StapelApiError;
}

/**
 * Type guard for the RAW backend envelope (dialect 2): a plain object with a
 * string `localizable_error`. Deliberately narrow — an arbitrary object with
 * an `error` string is not an envelope.
 */
export function isErrorEnvelope(value: unknown): value is StapelErrorEnvelope {
  return (
    isRecord(value) &&
    typeof value["localizable_error"] === "string" &&
    value["localizable_error"].length > 0
  );
}

/**
 * The i18n error code, read from EITHER dialect (`StapelApiError.code` or the
 * envelope's `localizable_error`). `undefined` when the value carries none
 * (a network fault, a bug, a non-Stapel error).
 */
export function errorCode(value: unknown): string | undefined {
  if (isStapelApiError(value)) return value.code;
  if (isErrorEnvelope(value)) return value.localizable_error;
  return undefined;
}

/**
 * Backend codes embed the HTTP status by convention: `error.<status>.<slug>`
 * (every Stapel backend's `errors.py`) and core's own
 * `stapel.http.<status>` fallback.
 */
const CODE_STATUS = /^(?:error|stapel\.http)\.(\d{3})(?:\.|$)/;

/**
 * The HTTP status of a thrown value, across both dialects:
 *
 *   1. `StapelApiError.status` — authoritative;
 *   2. a numeric `status` on a raw object (some transports do attach one);
 *   3. the status embedded in the envelope's code (`error.404.…`,
 *      `stapel.http.503`) — the only signal a bare envelope carries.
 *
 * `undefined` when unknowable — and that is a REAL case, not a formality: a
 * module-scoped code with no status segment (`auth.otp.invalid`) tells us
 * nothing about the response. Callers must treat `undefined` as "no
 * information", never as "not a 4xx".
 */
export function errorStatus(value: unknown): number | undefined {
  if (isStapelApiError(value)) return value.status;
  if (isRecord(value) && typeof value["status"] === "number") {
    return value["status"];
  }
  const code = errorCode(value);
  if (code === undefined) return undefined;
  const match = CODE_STATUS.exec(code);
  if (match === null) return undefined;
  return Number(match[1]);
}

/**
 * Does this thrown value carry one of these backend codes? Works on both
 * dialects, so a call site written against it keeps working when its
 * transport starts (or stops) wrapping.
 *
 *     if (hasErrorCode(e, "error.404.meeting_intelligence_not_found")) …
 */
export function hasErrorCode(value: unknown, ...codes: string[]): boolean {
  const code = errorCode(value);
  return code !== undefined && codes.includes(code);
}

/**
 * Factory for named, reusable state predicates — the shape products keep
 * reinventing per project, so it lives here:
 *
 *     export const isFeatureDisabled = errorCodePredicate("error.404.feature_disabled");
 *     export const isIntelligenceAbsent = errorCodePredicate(
 *       "error.404.meeting_intelligence_not_found",
 *     );
 *
 * Two DIFFERENT 404s stay two different states — which is exactly what a
 * `.status === 404` check can never express, even when it works.
 */
export function errorCodePredicate(
  ...codes: string[]
): (value: unknown) => boolean {
  return (value: unknown): boolean => hasErrorCode(value, ...codes);
}

/** Code used when a fault has no HTTP status at all (network, abort, bug). */
export const TRANSPORT_ERROR_CODE = "stapel.transport.failed";

/**
 * Fold ANY thrown value into a {@link StapelApiError} — the wrap that lets a
 * second transport speak core's dialect at its single rethrow point:
 *
 *     const { data, error, response } = await api.GET("/…");
 *     if (error) throw toStapelApiError(error, response.status);
 *
 * `fallbackStatus` is used only when the value itself carries no status
 * (see {@link errorStatus}); with neither, status is `0` and the code is
 * {@link TRANSPORT_ERROR_CODE} — an honest "never reached the backend"
 * rather than a fabricated HTTP status.
 */
export function toStapelApiError(
  value: unknown,
  fallbackStatus?: number
): StapelApiError {
  if (isStapelApiError(value)) return value;
  const status = errorStatus(value) ?? fallbackStatus ?? 0;
  // Nothing to fold from: no code, no status — a transport fault, not an
  // HTTP outcome. Keep the native message; never invent `stapel.http.0`.
  if (status === 0 && errorCode(value) === undefined) {
    return new StapelApiError({
      code: TRANSPORT_ERROR_CODE,
      message:
        value instanceof Error ? value.message : "Request failed before a response",
      status: 0,
      body: value,
    });
  }
  if (value instanceof Error) {
    return new StapelApiError({
      code: `stapel.http.${String(status)}`,
      message: value.message,
      status,
      body: value,
    });
  }
  return parseErrorEnvelope(status, value);
}

/**
 * Parse a failed response body (already JSON-decoded; may be anything) into
 * a `StapelApiError`. Tolerant of non-envelope bodies.
 */
export function parseErrorEnvelope(
  status: number,
  body: unknown
): StapelApiError {
  const fallbackCode = `stapel.http.${String(status)}`;
  if (!isRecord(body)) {
    return new StapelApiError({
      code: fallbackCode,
      message: `Request failed with status ${String(status)}`,
      status,
      body,
    });
  }
  const code =
    typeof body["localizable_error"] === "string" &&
    body["localizable_error"].length > 0
      ? body["localizable_error"]
      : fallbackCode;
  const message =
    typeof body["error"] === "string" && body["error"].length > 0
      ? body["error"]
      : code;
  const params = isRecord(body["params"]) ? body["params"] : {};
  const language =
    typeof body["language"] === "string" && body["language"].length > 0
      ? body["language"]
      : undefined;
  return new StapelApiError({
    code,
    message,
    params,
    status,
    body,
    ...(language !== undefined ? { language } : {}),
  });
}
