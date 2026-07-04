/**
 * The Stapel backend error envelope:
 * `{ localizable_error: "auth.otp.invalid", error: "Invalid OTP", params: {...} }`
 * `localizable_error` is an i18n key; `params` feed `{param}` interpolation.
 */
export interface StapelErrorEnvelope {
  readonly localizable_error?: string;
  readonly error?: string;
  readonly params?: Record<string, unknown>;
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

  constructor(args: {
    code: string;
    message: string;
    params?: Record<string, unknown>;
    status: number;
    body?: unknown;
  }) {
    super(args.message);
    this.name = "StapelApiError";
    this.code = args.code;
    this.params = args.params ?? {};
    this.status = args.status;
    this.body = args.body;
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
  return new StapelApiError({ code, message, params, status, body });
}
