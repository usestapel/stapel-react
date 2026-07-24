import type { Analytics } from "@stapel/core";
import { createFlowMachine } from "@stapel/core";
import type { FlowMachine } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type {
  AuthResponse,
  AuthTokens,
  MfaEnrollSessionResponse,
} from "../api/types.js";
import { isFirstLoginChallenge, isTotpChallenge } from "../api/types.js";
import { AUTH_FLOWS } from "./generated/flows.gen.js";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * First login of an org-provisioned account (flows.json `auth.first_login`,
 * org-program §C2). The password login answered `FIRST_LOGIN_REQUIRED
 * {requires, challenge_token}` instead of a session; these two machines drive
 * the two `requires` branches against that challenge token:
 *
 *  - {@link createForcedPasswordChangeFlow} — `requires="password_change"`:
 *    `POST /password/forced-change/` replaces the org-set password and
 *    returns a full session — or CHAINS into the next challenge
 *    (`requires="mfa_enroll"`) when the account has both policy flags. A
 *    rejected password does NOT consume the challenge (retry in place); an
 *    invalid/expired token (400 `first_login_challenge_invalid`) is terminal
 *    — the user logs in again for a fresh challenge.
 *
 *  - {@link createMfaEnrollFlow} — `requires="mfa_enroll"`:
 *    `POST /mfa/enroll/exchange/` mints a LIMITED enroll-only session (access
 *    token only, JWT claim `enroll_only`) in which only TOTP setup/confirm,
 *    passkey registration and logout work. The actual enrollment runs the
 *    pair's EXISTING TotpSetup / PasskeyRegistration journeys against that
 *    access token (see `headless/MfaEnrollGate.tsx`, which scopes a client to
 *    it); activating the strong factor returns the full-session `tokens` pair
 *    from the confirm/complete endpoint itself, and `complete(tokens)` here
 *    settles the machine so the host can commit them through the runtime
 *    (`session.setTokens`).
 */

// ── Forced password change (requires=password_change) ───────────────────────

export type ForcedPasswordChangeState =
  | { readonly step: "idle" }
  | { readonly step: "submitting" }
  | { readonly step: "error"; readonly error: FlowError }
  | { readonly step: "authenticated"; readonly result: AuthResponse }
  /** Both policy flags were set: the password change succeeded and chained
   * straight into the mfa_enroll challenge (a FRESH challenge token). */
  | {
      readonly step: "mfaEnrollRequired";
      readonly challengeToken: string;
      readonly expiresIn: number;
    };

export interface ForcedPasswordChangeFlow {
  readonly machine: FlowMachine<ForcedPasswordChangeState>;
  submit(newPassword: string): Promise<void>;
  reset(): void;
}

export interface ForcedPasswordChangeFlowDeps {
  readonly api: AuthApi;
  /** The `challenge_token` from `FIRST_LOGIN_REQUIRED` (requires=password_change). */
  readonly challengeToken: string;
  readonly analytics?: Analytics | null;
  /** Commit the session (wire to `session.adopt`). */
  readonly onAuthenticated?: (result: AuthResponse) => void;
}

export function createForcedPasswordChangeFlow(
  deps: ForcedPasswordChangeFlowDeps
): ForcedPasswordChangeFlow {
  const machine = createFlowMachine<ForcedPasswordChangeState>({
    // Canonical id from the generated flow registry (flows.json is the
    // source) — the whole first-login journey shares ONE funnel id; the
    // password-change and enroll machines are its steps.
    id: AUTH_FLOWS["auth.first_login"].id,
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function submit(newPassword: string): Promise<void> {
    const s = machine.getState();
    if (s.step !== "idle" && s.step !== "error") return;
    await machine.run(
      { step: "submitting" },
      () =>
        deps.api.completeForcedPasswordChange({
          challengeToken: deps.challengeToken,
          newPassword,
        }),
      {
        resolve: (r): ForcedPasswordChangeState => {
          if (isFirstLoginChallenge(r)) {
            // Contract: forced-change can only chain into mfa_enroll.
            return {
              step: "mfaEnrollRequired",
              challengeToken: r.challenge_token,
              expiresIn: r.expires_in,
            };
          }
          if (isTotpChallenge(r)) {
            // Not a contract branch of /password/forced-change/ (a provisioned
            // account owing a first login cannot already have TOTP active) —
            // fold defensively rather than crash the mapper.
            return { step: "error", error: toFlowError(new Error(r.status)) };
          }
          deps.onAuthenticated?.(r);
          return { step: "authenticated", result: r };
        },
        reject: (error): ForcedPasswordChangeState => ({
          step: "error",
          error: toFlowError(error),
        }),
      }
    );
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, submit, reset };
}

// ── MFA enroll (requires=mfa_enroll) ────────────────────────────────────────

/** The strong factors an enroll-only session may activate (org-program §C2). */
export type MfaEnrollMethod = "totp" | "passkey";

export type MfaEnrollState =
  | { readonly step: "idle" }
  | { readonly step: "exchanging" }
  /** The limited enroll-only session is live — run TotpSetup / passkey
   * registration against `session.access` (see `MfaEnrollGate`). */
  | { readonly step: "enrolling"; readonly session: MfaEnrollSessionResponse }
  | { readonly step: "completing"; readonly session: MfaEnrollSessionResponse }
  | { readonly step: "authenticated"; readonly tokens: AuthTokens }
  /** The exchange failed (invalid/expired challenge) — terminal: log in again. */
  | { readonly step: "exchangeError"; readonly error: FlowError }
  /** `complete()` was called without the full-session pair the enroll-mode
   * confirm/complete endpoint always returns — a wiring error, not a user
   * mistake. Terminal (log in again; the factor itself may well be active). */
  | { readonly step: "completeError"; readonly error: FlowError };

export interface MfaEnrollFlow {
  readonly machine: FlowMachine<MfaEnrollState>;
  /** Exchange the first-login challenge for the limited enroll session. */
  exchange(): Promise<void>;
  /**
   * Finish the journey with the full-session pair the TOTP confirm / passkey
   * complete endpoint returned (`TotpSetupState.done.tokens` /
   * `PasskeyRegisterState.registered.passkey.tokens`).
   */
  complete(tokens: AuthTokens | null | undefined): void;
  reset(): void;
}

export interface MfaEnrollFlowDeps {
  readonly api: AuthApi;
  /** The `challenge_token` from `FIRST_LOGIN_REQUIRED` (requires=mfa_enroll). */
  readonly challengeToken: string;
  readonly analytics?: Analytics | null;
  /** Commit the full session (wire to `session.setTokens`). */
  readonly onAuthenticated?: (tokens: AuthTokens) => void;
}

/** Fallback key rendered when `complete()` lacked the token pair. */
const ENROLL_INCOMPLETE_KEY = "auth.mfaEnroll.error.no_tokens";

export function createMfaEnrollFlow(deps: MfaEnrollFlowDeps): MfaEnrollFlow {
  const machine = createFlowMachine<MfaEnrollState>({
    id: AUTH_FLOWS["auth.first_login"].id,
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function exchange(): Promise<void> {
    const s = machine.getState();
    if (s.step !== "idle" && s.step !== "exchangeError") return;
    await machine.run(
      { step: "exchanging" },
      () => deps.api.mfaEnrollExchange(deps.challengeToken),
      {
        resolve: (session): MfaEnrollState => ({ step: "enrolling", session }),
        reject: (error): MfaEnrollState => ({
          step: "exchangeError",
          error: toFlowError(error),
        }),
      }
    );
  }

  function complete(tokens: AuthTokens | null | undefined): void {
    const s = machine.getState();
    if (s.step !== "enrolling") return;
    if (!tokens) {
      machine.to({
        step: "completeError",
        error: {
          code: ENROLL_INCOMPLETE_KEY,
          params: {},
          status: undefined,
          message: undefined,
          language: undefined,
        },
      });
      return;
    }
    machine.to({ step: "completing", session: s.session });
    deps.onAuthenticated?.(tokens);
    machine.to({ step: "authenticated", tokens });
  }

  function reset(): void {
    machine.to({ step: "idle" });
  }

  return { machine, exchange, complete, reset };
}
