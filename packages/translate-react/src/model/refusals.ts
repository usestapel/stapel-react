/**
 * Folding a refusal of `POST text/` into the one sentence a reader needs, and
 * the one thing they can do next.
 *
 * stapel-translate 0.7.0 gave this module its own error codes, so the fold is
 * BY CODE and not by guessing at prose (before 0.7.0 every refusal here was an
 * English literal in `{"error": "…"}` — nothing a consumer could localize).
 * Each arm answers two questions the skin asks: which key to render, and
 * whether the button comes back.
 *
 *   text_too_long          the reader's own text is over the ceiling — the
 *                          limit is IN the sentence, because "too long" with
 *                          no number is not actionable. Not retryable.
 *   batch_too_large/_long  a batch ceiling. The batcher chunks below both, so
 *                          this only appears when a deployment tightened its
 *                          settings under a running page: retryable, because
 *                          the next batch will be smaller.
 *   unsupported_language   the deployment does not carry that language.
 *   429                    a rate limit — WAIT, do not hammer. Retryable, and
 *                          the button says so rather than looking broken.
 *   502 provider_unavailable   the LLM is down. Retryable: this is the one
 *                          failure where trying again in a moment is right.
 *   401                    the endpoint's guard is per-deployment; on a
 *                          storefront that kept the default it means "sign in
 *                          first", which is a door, not an error.
 */
import { errorCode, errorStatus, hasErrorCode, isStapelApiError } from "@stapel/core";
import { TRANSLATE_I18N_KEYS } from "../i18n/keys.js";

export interface TranslateRefusal {
  /** The i18n key of the sentence to render. */
  readonly key: string;
  /** Interpolation params for it (the limit, the language code). */
  readonly params: Readonly<Record<string, unknown>>;
  /** Whether offering "try again" is honest. */
  readonly retryable: boolean;
  /** Whether the way out is signing in rather than retrying. */
  readonly requiresSignIn: boolean;
}

const TOO_LONG = "error.400.translate.text_too_long";
const BATCH_TOO_LARGE = "error.400.translate.batch_too_large";
const BATCH_TOO_LONG = "error.400.translate.batch_too_long";
const UNSUPPORTED = "error.400.translate.unsupported_language";
const PROVIDER_DOWN = "error.502.translate.provider_unavailable";
/** The two codes that mean "this reader may not use the endpoint at all". The
 * guard is a per-deployment setting (`TEXT_PERMISSIONS`), so on a storefront
 * that kept the default this is a DOOR — sign in — and not a fault. Matched by
 * CODE, not by status: reading a status code here would be ad hoc auth
 * handling, which lives once, in core's client (§43.2). */
const NOT_ALLOWED = [
  "error.401.unauthorized",
  "error.403.forbidden",
] as const;

/** Fold any thrown value from the text endpoint into {@link TranslateRefusal}. */
export function foldTranslateRefusal(error: unknown): TranslateRefusal {
  const code = errorCode(error);
  const status = errorStatus(error);
  const params = isStapelApiError(error) ? error.params : {};

  if (code === TOO_LONG) {
    return {
      key: TRANSLATE_I18N_KEYS.buttonTooLong,
      params,
      retryable: false,
      requiresSignIn: false,
    };
  }
  if (code === BATCH_TOO_LARGE || code === BATCH_TOO_LONG) {
    return {
      key: TRANSLATE_I18N_KEYS.buttonBatchRefused,
      params,
      retryable: true,
      requiresSignIn: false,
    };
  }
  if (code === UNSUPPORTED) {
    return {
      key: TRANSLATE_I18N_KEYS.buttonUnsupported,
      params,
      retryable: false,
      requiresSignIn: false,
    };
  }
  if (status === 429) {
    return {
      key: TRANSLATE_I18N_KEYS.buttonThrottled,
      params,
      retryable: true,
      requiresSignIn: false,
    };
  }
  if (code === PROVIDER_DOWN || status === 502 || status === 503) {
    return {
      key: TRANSLATE_I18N_KEYS.buttonFailed,
      params,
      retryable: true,
      requiresSignIn: false,
    };
  }
  if (hasErrorCode(error, ...NOT_ALLOWED)) {
    return {
      key: TRANSLATE_I18N_KEYS.buttonSignIn,
      params,
      retryable: false,
      requiresSignIn: true,
    };
  }
  return {
    key: TRANSLATE_I18N_KEYS.unknownError,
    params,
    retryable: true,
    requiresSignIn: false,
  };
}
