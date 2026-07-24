import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { AuthTokens, TotpSetupRequest } from "../api/types.js";
import { createFlowMachine } from "@stapel/core";
import type { FlowMachine } from "@stapel/core";
import { isErrorCode, toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/** Backend error code `TOTPService.setup()` raises when replacing an active
 * device without a valid `code`/`backup_code` (stapel-auth ≥0.9.0). */
const TOTP_PROOF_REQUIRED_CODE = "error.400.totp_proof_required";

/**
 * TOTP enrollment on the security-settings screen (auth-sa.md §11 "TOTP
 * setup"). `start()` mints a pending secret + `otpauth://` URI (render as a
 * QR); `confirm(code)` proves the authenticator and returns the one-time
 * backup codes (shown ONCE — host must surface a copy/warn affordance).
 *
 * REPLACE (stapel-auth ≥0.9.0): if an active device already exists, `start()`
 * needs a `proof` (current `code` or `backup_code`) — call it bare first (or
 * whenever the caller doesn't yet know a device is active) and a 400
 * `totp_proof_required` response lands in the `"proofRequired"` step instead
 * of `"startError"`, so the host can render a proof-collection form and retry
 * `start(proof)`. `error` is only set on `"proofRequired"` when a proof WAS
 * supplied and was still rejected (wrong code) — absent on the first,
 * un-proved attempt, so the host doesn't flash a spurious error on the very
 * first render of that form.
 */
export type TotpSetupState =
  | { readonly step: "idle" }
  | { readonly step: "starting" }
  | { readonly step: "proofRequired"; readonly error?: FlowError }
  | {
      readonly step: "enrolling";
      readonly secret: string;
      readonly qrUri: string;
      readonly expiresIn: number;
    }
  | { readonly step: "confirming"; readonly secret: string; readonly qrUri: string; readonly expiresIn: number }
  // `tokens` (stapel-auth ≥0.12.0): the full-session pair, present ONLY when
  // the confirmation was made from a limited enroll-only session (first-login
  // mfa_enroll policy, org-program §C2) — `MfaEnrollGate` reads it to upgrade
  // the session. Null on an ordinary security-settings enrollment.
  | {
      readonly step: "done";
      readonly backupCodes: readonly string[];
      readonly tokens: AuthTokens | null;
    }
  | { readonly step: "startError"; readonly error: FlowError }
  | {
      readonly step: "confirmError";
      readonly secret: string;
      readonly qrUri: string;
      readonly expiresIn: number;
      readonly error: FlowError;
    };

export interface TotpSetupFlow {
  readonly machine: FlowMachine<TotpSetupState>;
  start(proof?: TotpSetupRequest): Promise<void>;
  confirm(code: string): Promise<void>;
  reset(): void;
}

export interface TotpSetupFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
}

export function createTotpSetupFlow(deps: TotpSetupFlowDeps): TotpSetupFlow {
  const machine = createFlowMachine<TotpSetupState>({
    id: "auth.totp_setup",
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function start(proof?: TotpSetupRequest): Promise<void> {
    await machine.run({ step: "starting" }, () => deps.api.totpSetup(proof), {
      resolve: (r): TotpSetupState => ({
        step: "enrolling",
        secret: r.secret,
        qrUri: r.qr_uri,
        expiresIn: r.expires_in,
      }),
      reject: (error): TotpSetupState => {
        const flowError = toFlowError(error);
        if (isErrorCode(flowError, TOTP_PROOF_REQUIRED_CODE)) {
          return proof
            ? { step: "proofRequired", error: flowError }
            : { step: "proofRequired" };
        }
        return { step: "startError", error: flowError };
      },
    });
  }

  async function confirm(code: string): Promise<void> {
    const s = machine.getState();
    if (s.step !== "enrolling" && s.step !== "confirmError") return;
    const { secret, qrUri, expiresIn } = s;
    await machine.run(
      { step: "confirming", secret, qrUri, expiresIn },
      () => deps.api.totpSetupConfirm(code),
      {
        resolve: (r): TotpSetupState => ({
          step: "done",
          backupCodes: r.backup_codes,
          tokens: r.tokens ?? null,
        }),
        reject: (error): TotpSetupState => ({
          step: "confirmError",
          secret,
          qrUri,
          expiresIn,
          error: toFlowError(error),
        }),
      }
    );
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, start, confirm, reset };
}
