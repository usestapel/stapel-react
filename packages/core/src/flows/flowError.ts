import { StapelApiError } from "../errors.js";

/**
 * Normalized error shape carried by flow error states. `code` is the backend
 * `localizable_error` i18n key; `params` feed `{param}` interpolation (e.g.
 * `retry_after_minutes`, `attempts_remaining`). A flow renders `t(code, params)`
 * — it never inspects the message text.
 */
export interface FlowError {
  readonly code: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly status: number | undefined;
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
    return { code: error.code, params: error.params, status: error.status };
  }
  return { code: fallbackCode, params: {}, status: undefined };
}

/** Convenience predicate: did this error carry a specific backend code? */
export function isErrorCode(error: FlowError, code: string): boolean {
  return error.code === code;
}
