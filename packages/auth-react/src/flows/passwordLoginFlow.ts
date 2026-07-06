import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type { AuthResponse } from "../api/types.js";
import { isTotpChallenge } from "../api/types.js";
import { createFlowMachine } from "@stapel/core";
import type { FlowMachine } from "@stapel/core";
import { AUTH_FLOWS } from "./generated/flows.gen.js";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * Password login with the TOTP step-up branch (auth-sa.md §3 + §11). A login
 * response is a `oneOf` union — when the account has TOTP enabled the server
 * answers `TOTP_REQUIRED` with a `challenge_token` instead of a session, and
 * the flow parks in `totpRequired` until the user enters their 6-digit code
 * (or a backup code).
 *
 * A 423 during TOTP verify **invalidates the challenge** (auth-sa.md §11): the
 * machine goes to `totpLocked` and the user must log in again for a fresh
 * token — modelled as a terminal step (call `reset()` to return to `idle`).
 */
export type PasswordLoginState =
  | { readonly step: "idle" }
  | { readonly step: "authenticating"; readonly login: string }
  | {
      readonly step: "totpRequired";
      readonly challengeToken: string;
      readonly expiresIn: number;
    }
  | { readonly step: "verifyingTotp"; readonly challengeToken: string; readonly expiresIn: number }
  | { readonly step: "authenticated"; readonly result: AuthResponse }
  | { readonly step: "error"; readonly login: string; readonly error: FlowError }
  | {
      readonly step: "totpError";
      readonly challengeToken: string;
      readonly expiresIn: number;
      readonly error: FlowError;
    }
  | { readonly step: "totpLocked"; readonly error: FlowError };

export interface TotpProof {
  readonly code?: string;
  readonly backup_code?: string;
}

export interface PasswordLoginFlow {
  readonly machine: FlowMachine<PasswordLoginState>;
  login(loginId: string, password: string): Promise<void>;
  submitTotp(proof: TotpProof): Promise<void>;
  reset(): void;
}

export interface PasswordLoginFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
  readonly onAuthenticated?: (result: AuthResponse) => void;
}

const LOCKED_STATUS = 423;

export function createPasswordLoginFlow(
  deps: PasswordLoginFlowDeps
): PasswordLoginFlow {
  const machine = createFlowMachine<PasswordLoginState>({
    // Canonical id from the generated flow registry (flows.json is the source):
    // binds the analytics funnel + contract to the backend flow. Drift-gated.
    id: AUTH_FLOWS["auth.password_login"].id,
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function login(loginId: string, password: string): Promise<void> {
    await machine.run(
      { step: "authenticating", login: loginId },
      () => deps.api.passwordLogin(loginId, password),
      {
        resolve: (r): PasswordLoginState => {
          if (isTotpChallenge(r)) {
            return {
              step: "totpRequired",
              challengeToken: r.challenge_token,
              expiresIn: r.expires_in,
            };
          }
          deps.onAuthenticated?.(r);
          return { step: "authenticated", result: r };
        },
        reject: (error): PasswordLoginState => ({
          step: "error",
          login: loginId,
          error: toFlowError(error),
        }),
      }
    );
  }

  async function submitTotp(proof: TotpProof): Promise<void> {
    const s = machine.getState();
    if (s.step !== "totpRequired" && s.step !== "totpError") return;
    const { challengeToken, expiresIn } = s;
    await machine.run(
      { step: "verifyingTotp", challengeToken, expiresIn },
      () => deps.api.totpChallengeVerify(challengeToken, proof),
      {
        resolve: (result): PasswordLoginState => {
          deps.onAuthenticated?.(result);
          return { step: "authenticated", result };
        },
        reject: (error): PasswordLoginState => {
          const flowError = toFlowError(error);
          if (flowError.status === LOCKED_STATUS) {
            return { step: "totpLocked", error: flowError };
          }
          return { step: "totpError", challengeToken, expiresIn, error: flowError };
        },
      }
    );
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, login, submitTotp, reset };
}
