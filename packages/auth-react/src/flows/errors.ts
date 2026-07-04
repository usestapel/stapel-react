import { StapelApiError } from "@stapel/core";

/**
 * Normalized error shape carried by flow error states. `code` is the backend
 * `localizable_error` i18n key (auth-sa.md "Error reference"); `params` feed
 * `{param}` interpolation (e.g. `retry_after_minutes`, `attempts_remaining`).
 */
export interface FlowError {
  readonly code: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly status: number | undefined;
}

/** Fold any thrown value into a {@link FlowError} for a flow error state. */
export function toFlowError(error: unknown): FlowError {
  if (error instanceof StapelApiError) {
    return { code: error.code, params: error.params, status: error.status };
  }
  return {
    code: "auth.error.unknown",
    params: {},
    status: undefined,
  };
}

/** Convenience predicate: did this error carry a specific backend code? */
export function isErrorCode(error: FlowError, code: string): boolean {
  return error.code === code;
}
