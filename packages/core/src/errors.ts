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
