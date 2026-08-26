import { StapelApiError } from "../errors.js";
import { interpolate } from "../i18n.js";
import {
  DETAIL_ERROR_FALLBACK,
  DETAIL_ERROR_KEY,
  codeCarriesTechnicalDetail,
  coreErrorKeyCandidates,
} from "../i18n/coreErrors.js";
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
 * Is this value already a folded {@link FlowError}?
 *
 * `Error` instances are excluded on purpose: {@link StapelApiError} carries
 * `code`/`params`/`status` too, and it must go down the real fold so its
 * `message` and `language` are read the way {@link toFlowError} reads them.
 */
export function isFlowError(value: unknown): value is FlowError {
  if (typeof value !== "object" || value === null) return false;
  if (value instanceof Error) return false;
  const candidate = value as Partial<FlowError>;
  return (
    typeof candidate.code === "string" &&
    "params" in value &&
    "status" in value &&
    "message" in value
  );
}

/**
 * Fold any thrown value into a {@link FlowError} for a flow error state. A
 * {@link StapelApiError} carries its own i18n key + params; anything else
 * (network fault, bug) collapses to `fallbackCode`. Pairs pass their own
 * module-scoped fallback (e.g. auth-react uses `"auth.error.unknown"`), which
 * ships an en string in the pair's i18n bundle so the raw key is never seen.
 *
 * **Idempotent**: a `FlowError` passes through unchanged. A flow machine's
 * `refused` state carries a `FlowError`, not the thrown value, so anything
 * reading a refusal OFF A MACHINE hands a folded error back in. Without the
 * pass-through the second fold erased the very `code` the refusal predicates
 * exist to read: every `isErrorCode(...)` downstream of a machine answered
 * `false` and the screen fell back to the generic sentence instead of the one
 * written for that situation (found by moderation-react, wave D — invisible
 * wherever a pair's copy reads like the backend's own).
 */
export function toFlowError(
  error: unknown,
  fallbackCode = "stapel.error.unknown"
): FlowError {
  if (isFlowError(error)) return error;
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
 * Fallback chain, in order:
 *   1. `bundle[error.code]`, with `{param}` placeholders filled from
 *      `error.params` (the normal path — a real translated string).
 *   1b. For core's OWN synthesized `stapel.http.<status>` codes only, the
 *      class-wide entry (`stapel.http.5xx`) — see `coreErrorKeyCandidates`.
 *      A real backend code is never widened: `error.404.a` and
 *      `error.404.b` are two different states and must not collapse.
 *   2. The backend's own `error.message`, but ONLY when `error.language`
 *      is set AND matches `opts.locale` — the backend wrote it in the host's
 *      current language, so it's a strictly better fallback than the code.
 *      NOT reached for a bodiless failure: there `message` is the transport's
 *      own `"Request failed with status 500"` and `language` is `undefined`,
 *      which is precisely why this guard exists.
 *   3. `error.code` itself — the last-resort raw key (frontend-standard
 *      §4.2: a raw key at least signals "someone forgot to add this
 *      translation", rather than silently swallowing the error).
 *
 * `{status}` is available to every template on top of `error.params` (a
 * backend param of the same name still wins) — but NO core floor sentence
 * spends it any more; see {@link describeFlowError} for where the status went
 * and why. This function returns the human sentence and nothing else, which
 * is why every existing call site stayed correct across that move.
 */
export function formatFlowError(
  error: FlowError,
  bundle: I18nDictionary,
  opts: FormatFlowErrorOptions = {}
): string {
  return describeFlowError(error, bundle, opts).message;
}

/**
 * What an error surface puts on screen: a human sentence, and — separately —
 * the technical detail a support agent needs.
 */
export interface FlowErrorDisplay {
  /**
   * The sentence a person reads. Complete on its own: a skin that renders
   * only this is correct, just harder to support. Never carries a protocol
   * number.
   */
  readonly message: string;
  /**
   * The secondary, plainly-technical line — `"HTTP 500"`. Render it in muted,
   * small type beside {@link message}: something a person's eye skips and a
   * support agent reads back. `undefined` whenever there is nothing worth
   * quoting (no status, or a specific backend code whose sentence already
   * says what happened).
   */
  readonly detail: string | undefined;
}

/**
 * {@link formatFlowError}, plus the technical detail that used to be spliced
 * into the sentence.
 *
 * Core's floor copy carried the status inline — every 5xx sentence ended in a
 * bare `" (500)"` — and the owner rejected it (2026-08-09): a product writes a
 * human sentence, it does not read a protocol number out to a person.
 * Deleting the number instead would have silently thrown away the ONLY
 * correlation handle the fleet has (no Stapel backend emits a request id yet
 * — grep-confirmed across the python fleet that day), so it moved out of the
 * copy and into this second field.
 *
 * The split is here, at the pure formatting layer, rather than at the hook:
 * the status, the code's provenance and the interpolation the detail template
 * needs are all already in scope here, and a non-React caller gets the same
 * answer. The hook layer stayed additive on purpose — `useErrorText` still
 * returns the sentence alone, so the ~20 fleet skins that render only a
 * message kept compiling AND kept reading correctly; `useErrorDisplay` is the
 * opt-in for a skin with somewhere to put the detail.
 */
export function describeFlowError(
  error: FlowError,
  bundle: I18nDictionary,
  opts: FormatFlowErrorOptions = {}
): FlowErrorDisplay {
  const params = { status: error.status, ...error.params };
  // `status: 0` is `toStapelApiError`'s "never reached a backend" marker, not
  // an HTTP outcome — quoting `HTTP 0` back at support would be a lie about
  // what the server said.
  const quotable =
    error.status !== undefined && error.status > 0 && codeCarriesTechnicalDetail(error.code);
  return {
    message: flowErrorMessage(error, bundle, opts, params),
    detail: quotable
      ? interpolate(bundle[DETAIL_ERROR_KEY] ?? DETAIL_ERROR_FALLBACK, params)
      : undefined,
  };
}

function flowErrorMessage(
  error: FlowError,
  bundle: I18nDictionary,
  opts: FormatFlowErrorOptions,
  params: Record<string, unknown>
): string {
  for (const key of coreErrorKeyCandidates(error.code)) {
    const template = bundle[key];
    if (template !== undefined) return interpolate(template, params);
  }
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
