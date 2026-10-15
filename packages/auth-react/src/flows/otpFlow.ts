import type { Analytics } from "@stapel/core";
import type { AuthApi } from "../api/authApi.js";
import type {
  AuthResponse,
  FirstLoginRequires,
  OtpChannel,
  SignupAttribution,
} from "../api/types.js";
import { isFirstLoginChallenge, isTotpChallenge } from "../api/types.js";
import type { TotpProof } from "./passwordLoginFlow.js";
import { createFlowMachine } from "@stapel/core";
import type { FlowMachine } from "@stapel/core";
import { AUTH_FLOWS } from "./generated/flows.gen.js";
import { toFlowError } from "./errors.js";
import type { FlowError } from "./errors.js";

/**
 * Email / Phone OTP passwordless login (auth-sa.md §1–2). One machine serves
 * both channels — the only difference is the endpoint, carried in `channel`.
 *
 * Steps:
 *  - `idle`         → nothing requested yet
 *  - `requesting`   → POST /<channel>/request/ in flight
 *  - `codeSent`     → human-wait: enter the code (or resend)
 *  - `verifying`    → POST /<channel>/verify/ in flight
 *  - `authenticated`→ terminal success (AuthResponse)
 *  - `requestError` → request failed; retry
 *  - `codeError`    → wrong/expired code; human-wait, retry or resend
 *  - `locked`       → 423 lockout with `retry_after_minutes`
 *
 * A verify answer is the login union, not always a session: an account with
 * TOTP enabled gets `TOTP_REQUIRED` (step-up, parks in `totpRequired` until
 * `submitTotp`), and an org-provisioned account with a first-login policy
 * gets `FIRST_LOGIN_REQUIRED` (parks in `passwordChangeRequired` /
 * `mfaEnrollRequired`). The TOTP steps and their 423 → `totpLocked` rule
 * mirror `passwordLoginFlow`.
 */
export type OtpState =
  | { readonly step: "idle" }
  | { readonly step: "requesting"; readonly channel: OtpChannel; readonly value: string }
  | {
      readonly step: "codeSent";
      readonly channel: OtpChannel;
      readonly value: string;
      readonly target: string;
      /** Seconds the SERVER says to wait before resending. Carried through
       *  because the skin used to count down its own hardcoded 30 while
       *  the backend's `OTP_RESEND_COOLDOWN` was a setting — two copies of
       *  one truth, and the UI's copy is the one users obey. Undefined
       *  when a backend predates the field. */
      readonly resendAfter?: number;
    }
  | { readonly step: "verifying"; readonly channel: OtpChannel; readonly value: string; readonly target: string }
  | { readonly step: "authenticated"; readonly result: AuthResponse }
  | {
      readonly step: "requestError";
      readonly channel: OtpChannel;
      readonly value: string;
      readonly error: FlowError;
    }
  | {
      readonly step: "codeError";
      readonly channel: OtpChannel;
      readonly value: string;
      readonly target: string;
      readonly error: FlowError;
    }
  | {
      readonly step: "locked";
      readonly channel: OtpChannel;
      readonly value: string;
      readonly error: FlowError;
    }
  | {
      readonly step: "totpRequired";
      readonly challengeToken: string;
      readonly expiresIn: number;
    }
  | { readonly step: "verifyingTotp"; readonly challengeToken: string; readonly expiresIn: number }
  | {
      readonly step: "totpError";
      readonly challengeToken: string;
      readonly expiresIn: number;
      readonly error: FlowError;
    }
  | { readonly step: "totpLocked"; readonly error: FlowError }
  | {
      readonly step: "passwordChangeRequired";
      readonly requires: FirstLoginRequires;
      readonly challengeToken: string;
      readonly expiresIn: number;
    }
  | {
      readonly step: "mfaEnrollRequired";
      readonly requires: FirstLoginRequires;
      readonly challengeToken: string;
      readonly expiresIn: number;
    };

export interface OtpFlow {
  readonly machine: FlowMachine<OtpState>;
  /** Request a code for the identifier. `captchaToken` when the backend needs it. */
  requestCode(channel: OtpChannel, value: string, captchaToken?: string): Promise<void>;
  /** Resend the code for the current identifier (respect the 30 s rate limit). */
  resend(captchaToken?: string): Promise<void>;
  /** Verify the entered code. */
  submitCode(code: string): Promise<void>;
  /** Answer the TOTP step-up challenge (`totpRequired` / `totpError` only). */
  submitTotp(proof: TotpProof): Promise<void>;
  /** Return to `idle`. */
  reset(): void;
}

export interface OtpFlowDeps {
  readonly api: AuthApi;
  readonly analytics?: Analytics | null;
  /** Called with the session-bearing response on success (token persistence). */
  readonly onAuthenticated?: (result: AuthResponse) => void;
  /**
   * WHERE THIS SIGN-UP CAME FROM — carried on the verify call, which is the
   * request that registers an account on this channel (the request half only
   * sends a code). See {@link SignupAttribution}: it is captured on the
   * host's landing page long before this flow is mounted, so nothing in here
   * can produce it and nothing in here interprets it — the object is
   * forwarded verbatim and dropped on a login by the server.
   *
   * A function rather than only a value, because the capture may still be
   * landing when the flow is CREATED and is certainly settled by the time a
   * code is submitted: read at the moment of the call, never at mount.
   */
  readonly attribution?:
    | SignupAttribution
    | (() => SignupAttribution | undefined);
}

const LOCKED_STATUS = 423;

export function createOtpFlow(deps: OtpFlowDeps): OtpFlow {
  const machine = createFlowMachine<OtpState>({
    // Email/phone OTP IS the `auth.passwordless_login` flow in flows.json —
    // bind to the canonical id (analytics funnel = the documented flow). The
    // phone channel reuses the same machine (only the endpoint differs).
    id: AUTH_FLOWS["auth.passwordless_login"].id,
    initial: { step: "idle" },
    analytics: deps.analytics ?? null,
  });

  async function requestCode(
    channel: OtpChannel,
    value: string,
    captchaToken?: string
  ): Promise<void> {
    await machine.run(
      { step: "requesting", channel, value },
      () => deps.api.otpRequest(channel, value, captchaToken),
      {
        resolve: (r): OtpState => ({
          step: "codeSent",
          channel,
          value,
          target: r.target,
          // Read defensively rather than by the client's response type:
          // the generated type for this endpoint does not carry the field
          // even though the OpenAPI schema does, so a strict cast would
          // be a lie in the other direction.
          ...(() => {
            const sent = (r as unknown as { resend_cooldown_seconds?: unknown })
              .resend_cooldown_seconds;
            return typeof sent === "number" ? { resendAfter: sent } : {};
          })(),
        }),
        reject: (error): OtpState => {
          const flowError = toFlowError(error);
          if (flowError.status === LOCKED_STATUS) {
            return { step: "locked", channel, value, error: flowError };
          }
          return { step: "requestError", channel, value, error: flowError };
        },
      }
    );
  }

  function currentIdentifier(): { channel: OtpChannel; value: string } | null {
    const s = machine.getState();
    if (
      s.step === "codeSent" ||
      s.step === "verifying" ||
      s.step === "codeError" ||
      s.step === "requestError" ||
      s.step === "requesting"
    ) {
      return { channel: s.channel, value: s.value };
    }
    return null;
  }

  async function resend(captchaToken?: string): Promise<void> {
    const id = currentIdentifier();
    if (id === null) return;
    await requestCode(id.channel, id.value, captchaToken);
  }

  async function submitCode(code: string): Promise<void> {
    const s = machine.getState();
    if (s.step !== "codeSent" && s.step !== "codeError") return;
    const { channel, value, target } = s;
    await machine.run(
      { step: "verifying", channel, value, target },
      () => {
        const attribution =
          typeof deps.attribution === "function"
            ? deps.attribution()
            : deps.attribution;
        return attribution === undefined
          ? deps.api.otpVerify(channel, value, code)
          : deps.api.otpVerify(channel, value, code, { attribution });
      },
      {
        resolve: (r): OtpState => {
          if (isTotpChallenge(r)) {
            return {
              step: "totpRequired",
              challengeToken: r.challenge_token,
              expiresIn: r.expires_in,
            };
          }
          if (isFirstLoginChallenge(r)) {
            return {
              step:
                r.requires === "password_change"
                  ? "passwordChangeRequired"
                  : "mfaEnrollRequired",
              requires: r.requires,
              challengeToken: r.challenge_token,
              expiresIn: r.expires_in,
            };
          }
          deps.onAuthenticated?.(r);
          return { step: "authenticated", result: r };
        },
        reject: (error): OtpState => {
          const flowError = toFlowError(error);
          if (flowError.status === LOCKED_STATUS) {
            return { step: "locked", channel, value, error: flowError };
          }
          return { step: "codeError", channel, value, target, error: flowError };
        },
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
        resolve: (result): OtpState => {
          deps.onAuthenticated?.(result);
          return { step: "authenticated", result };
        },
        reject: (error): OtpState => {
          const flowError = toFlowError(error);
          // A 423 here invalidates the challenge: a fresh code is needed.
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

  return { machine, requestCode, resend, submitCode, submitTotp, reset };
}
