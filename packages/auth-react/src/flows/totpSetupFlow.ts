import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import { createFlowMachine } from "./createFlowMachine.js";
import type { FlowMachine } from "./createFlowMachine.js";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * TOTP enrollment on the security-settings screen (auth-sa.md §11 "TOTP
 * setup"). `start()` mints a pending secret + `otpauth://` URI (render as a
 * QR); `confirm(code)` proves the authenticator and returns the one-time
 * backup codes (shown ONCE — host must surface a copy/warn affordance).
 */
export type TotpSetupState =
  | { readonly step: "idle" }
  | { readonly step: "starting" }
  | {
      readonly step: "enrolling";
      readonly secret: string;
      readonly qrUri: string;
      readonly expiresIn: number;
    }
  | { readonly step: "confirming"; readonly secret: string; readonly qrUri: string; readonly expiresIn: number }
  | { readonly step: "done"; readonly backupCodes: readonly string[] }
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
  start(): Promise<void>;
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

  async function start(): Promise<void> {
    await machine.run({ step: "starting" }, () => deps.api.totpSetup(), {
      resolve: (r): TotpSetupState => ({
        step: "enrolling",
        secret: r.secret,
        qrUri: r.qr_uri,
        expiresIn: r.expires_in,
      }),
      reject: (error): TotpSetupState => ({
        step: "startError",
        error: toFlowError(error),
      }),
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
