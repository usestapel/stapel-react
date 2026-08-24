import { toFlowError as coreToFlowError } from "@stapel/core";
import type { FlowError } from "@stapel/core";
import { classifyWebauthnError } from "../webauthn.js";
import type { WebauthnFailure } from "../webauthn.js";
import { AUTH_I18N_KEYS } from "../i18n/keys.js";

export type { FlowError } from "@stapel/core";
export { isErrorCode } from "@stapel/core";

/**
 * Fold any thrown value into a {@link FlowError}, using auth-react's own
 * module-scoped fallback key. `auth.error.unknown` ships an en string in
 * {@link authI18nBundleEn}, so a non-`StapelApiError` fault still renders real
 * copy rather than a raw key. The primitive lives in `@stapel/core`
 * (frontend-core-architecture §4b); this wrapper only pins the fallback.
 */
export function toFlowError(error: unknown): FlowError {
  return coreToFlowError(error, "auth.error.unknown");
}

/**
 * The i18n key each browser-side passkey outcome renders as.
 *
 * One generic sentence for five different situations is not an error message,
 * it is a shrug: "Something went wrong. Please try again." is wrong for a
 * person who cancelled the prompt, wrong for a browser that cannot do this at
 * all, and worst of all for a device that holds no passkey — where "try
 * again" is advice to repeat the thing that cannot work.
 */
const PASSKEY_FAILURE_KEYS: Record<WebauthnFailure, string> = {
  unsupported: AUTH_I18N_KEYS.passkeyUnsupported,
  declined: AUTH_I18N_KEYS.passkeyDeclined,
  timeout: AUTH_I18N_KEYS.passkeyTimeout,
  insecure: AUTH_I18N_KEYS.passkeyInsecure,
  already_registered: AUTH_I18N_KEYS.passkeyAlreadyOnDevice,
  failed: AUTH_I18N_KEYS.passkeyFailed,
};

/**
 * Fold a passkey ceremony rejection into a {@link FlowError} that still says
 * WHICH failure it was.
 *
 * A `navigator.credentials` rejection is a `DOMException`, not a
 * `StapelApiError`, so {@link toFlowError} collapses it to the module fallback
 * — which is right for a bug and wrong for every one of the outcomes a passkey
 * ceremony actually has. Anything this cannot classify (a rejected server
 * call, above all — it already carries its own backend code) falls straight
 * through to {@link toFlowError} unchanged.
 */
export function toPasskeyFlowError(error: unknown): FlowError {
  const failure = classifyWebauthnError(error);
  if (failure === null) {
    return toFlowError(error);
  }
  return {
    code: PASSKEY_FAILURE_KEYS[failure],
    params: {},
    status: undefined,
    message: undefined,
    language: undefined,
  };
}

/** Which browser-side outcome a {@link FlowError} describes, if any — so a
 * skin can offer the RIGHT next action (retry a timeout; pick another method
 * after a decline; nothing at all on an unsupported browser) rather than one
 * "try again" button under every outcome. */
export function passkeyFailureOf(error: FlowError): WebauthnFailure | null {
  for (const [failure, key] of Object.entries(PASSKEY_FAILURE_KEYS)) {
    if (key === error.code) return failure as WebauthnFailure;
  }
  return null;
}
