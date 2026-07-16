import { StapelApiError } from "../errors.js";
import { interpolate } from "../i18n.js";
import type { I18nDictionary } from "../i18n.js";

/**
 * Normalized error shape carried by flow error states. `code` is the backend
 * `localizable_error` i18n key; `params` feed `{param}` interpolation (e.g.
 * `retry_after_minutes`, `attempts_remaining`). A flow renders `t(code, params)`
 * — it never inspects `message` directly; `message`/`language` exist only so
 * `formatFlowError` can fall back to the backend's own text when a bundle is
 * missing the key AND the backend's text is in the host's own locale.
 */
export interface FlowError {
  readonly code: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly status: number | undefined;
  /** The envelope's raw `error` text (== this error's `.message` when it came
   * from a `StapelApiError`). `undefined` for non-API faults. */
  readonly message: string | undefined;
  /** The locale tag `message` is written in, when the backend sends one
   * (rolling out — see `StapelErrorEnvelope.language`). `undefined` if the
   * backend didn't send it. */
  readonly language: string | undefined;
}

/**
 * Fold any thrown value into a {@link FlowError} for a flow error state. A
 * {@link StapelApiError} carries its own i18n key + params; anything else
 * (network fault, bug) collapses to `fallbackCode`. Pairs pass their own
 * module-scoped fallback (e.g. auth-react uses `"auth.error.unknown"`), which
 * ships an en string in the pair's i18n bundle so the raw key is never seen.
 */
export function toFlowError(
  error: unknown,
  fallbackCode = "stapel.error.unknown"
): FlowError {
  if (error instanceof StapelApiError) {
    return {
      code: error.code,
      params: error.params,
      status: error.status,
      message: error.message,
      language: error.language,
    };
  }
  return {
    code: fallbackCode,
    params: {},
    status: undefined,
    message: undefined,
    language: undefined,
  };
}

/** Convenience predicate: did this error carry a specific backend code? */
export function isErrorCode(error: FlowError, code: string): boolean {
  return error.code === code;
}

export interface FormatFlowErrorOptions {
  /**
   * The host's CURRENT locale (e.g. `i18n.locale` from `useI18n()`). Enables
   * the backend-`message` fallback ONLY when it matches `error.language` — an
   * off-locale backend string is worse than the raw code, never shown.
   */
  readonly locale?: string;
}

/**
 * Render a {@link FlowError} to display text (frontend-core-architecture: the
 * gap this closes — `toFlowError` promises "the frontend renders
 * `t(code, params)`", but nothing actually supplied that `t`; hosts were left
 * writing `bundle[code] ?? code`, so a missing key surfaced as a raw
 * "{field} must be at most {max_length} characters"-shaped code to the user).
 *
 * Three-step fallback chain, in order:
 *   1. `bundle[error.code]`, with `{param}` placeholders filled from
 *      `error.params` (the normal path — a real translated string).
 *   2. The backend's own `error.message`, but ONLY when `error.language`
 *      is set AND matches `opts.locale` — the backend wrote it in the host's
 *      current language, so it's a strictly better fallback than the code.
 *   3. `error.code` itself — the last-resort raw key (frontend-standard
 *      §4.2: a raw key at least signals "someone forgot to add this
 *      translation", rather than silently swallowing the error).
 */
export function formatFlowError(
  error: FlowError,
  bundle: I18nDictionary,
  opts: FormatFlowErrorOptions = {}
): string {
  const template = bundle[error.code];
  if (template !== undefined) return interpolate(template, error.params);
  if (
    error.message !== undefined &&
    error.language !== undefined &&
    opts.locale !== undefined &&
    error.language === opts.locale
  ) {
    return error.message;
  }
  return error.code;
}
